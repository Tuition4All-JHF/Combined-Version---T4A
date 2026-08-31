from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import (
    LiveClass, Attendance, Course, Category, Assignment, Project, CourseNote, RecordedClass, WhiteboardState, ClassSummaryNote
)
from accounts.models import StudentProfile

def course_list(request):
    valid_categories = Course.objects.filter(status='approved', is_frozen=False).values_list('category', flat=True).distinct()
    categories = Category.objects.filter(id__in=valid_categories).order_by('name')
    
    query = request.GET.get('q')
    if query:
        categories = categories.filter(name__icontains=query)
        
    return render(request, 'courses/list.html', {'categories': categories, 'query': query})

def category_detail(request, category_id):
    category = get_object_or_404(Category, id=category_id)
    courses = Course.objects.filter(category=category, status='approved', is_frozen=False).order_by('price')
    return render(request, 'courses/category_detail.html', {'category': category, 'courses': courses})

def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    is_enrolled = False
    parent_children = None
    
    if request.user.is_authenticated:
        if request.user.role == 'student':
            is_enrolled = course.enrollments.filter(student=request.user.student_profile).exists()
        elif request.user.role == 'parent':
            parent_children = request.user.parent_profile.children.all()
        
    features_list = []
    if course.features:
        features_list = [f.strip() for f in course.features.split('\n') if f.strip()]
        
    calculated_hourly_rate = course.get_hourly_rate
    
    # Safely sort live classes by recurring_group_id and start_time
    from django.utils import timezone
    now = timezone.now()
    live_classes_qs = course.live_classes.filter(start_time__gte=now)
    live_classes = list(live_classes_qs)
    live_classes.sort(key=lambda x: (x.recurring_group_id or '', x.start_time or now))
        
    return render(request, 'courses/detail.html', {
        'course': course, 
        'live_classes': live_classes,
        'is_enrolled': is_enrolled, 
        'parent_children': parent_children,
        'features_list': features_list,
        'calculated_hourly_rate': round(calculated_hourly_rate, 2)
    })

@login_required
def enroll_course(request, course_id):
    from .models import Enrollment, LiveClassBooking, LiveClass, Course
    from django.utils import timezone
    import datetime
    from datetime import timedelta
    from django.shortcuts import get_object_or_404, redirect, render
    from django.contrib import messages
    
    course = get_object_or_404(Course, id=course_id)
    
    if request.user.role not in ['student', 'parent']:
        messages.error(request, 'Only students and parents can enroll in courses.')
        return redirect('courses:detail', course_id=course_id)
    
    if request.user.role == 'student':
        student = request.user.student_profile
    else:
        student_id = request.POST.get('student_id')
        if not student_id:
            student_id = request.GET.get('student_id')
        if not student_id:
            messages.error(request, 'Please select a child to book for.')
            return redirect('courses:detail', course_id=course_id)
        from accounts.models import StudentProfile
        student = get_object_or_404(StudentProfile, id=student_id)
        if not request.user.parent_profile.children.filter(id=student.id).exists():
            messages.error(request, 'Unauthorized to book for this student.')
            return redirect('courses:detail', course_id=course_id)

    if request.method == 'POST':
        group_id = request.POST.get('recurring_group_id')
        if group_id:
            slots = list(LiveClass.objects.filter(recurring_group_id=group_id, course=course).order_by('start_time'))
            if not slots:
                # Fallback: maybe it's an individual slot ID?
                try:
                    slot = LiveClass.objects.get(id=int(group_id), course=course)
                    slots = [slot]
                except (ValueError, LiveClass.DoesNotExist):
                    pass
            if not slots:
                messages.error(request, 'Package no longer available.')
                return redirect('courses:detail', course_id=course_id)
            
            # Check if already booked
            for s in slots:
                if s.bookings.filter(student=student).exists():
                    messages.error(request, 'You have already booked this package!')
                    return redirect('courses:detail', course_id=course_id)

            from django.db import transaction
            try:
                with transaction.atomic():
                    is_private = (slots[0].class_type == 'private')
                    if is_private:
                        for s in slots:
                            if s.bookings.exists():
                                messages.error(request, 'Package already booked by someone else.')
                                return redirect('courses:detail', course_id=course_id)
                        
                        now = timezone.now()
                        past_slots = [s for s in slots if s.start_time < now]
                        if past_slots:
                            num_past = len(past_slots)
                            last_slot = slots[-1]
                            days_of_week = set([timezone.localtime(s.start_time).weekday() for s in slots])
                            current_date = timezone.localtime(last_slot.start_time).date() + timedelta(days=1)
                            
                            added = 0
                            while added < num_past:
                                if current_date.weekday() in days_of_week:
                                    ref_slot = next(s for s in slots if timezone.localtime(s.start_time).weekday() == current_date.weekday())
                                    ref_local_start = timezone.localtime(ref_slot.start_time)
                                    ref_local_end = timezone.localtime(ref_slot.end_time)
                                    
                                    slot_start = timezone.make_aware(datetime.datetime.combine(current_date, ref_local_start.time()))
                                    slot_end = timezone.make_aware(datetime.datetime.combine(current_date, ref_local_end.time()))
                                    if slot_end <= slot_start:
                                        slot_end += timedelta(days=1)
                                    
                                    new_lc = LiveClass.objects.create(
                                        course=course,
                                        title=ref_slot.title,
                                        description=ref_slot.description,
                                        start_time=slot_start,
                                        end_time=slot_end,
                                        max_capacity=ref_slot.max_capacity,
                                        class_type=ref_slot.class_type,
                                        status=ref_slot.status,
                                        teacher_requested_price=ref_slot.teacher_requested_price,
                                        recurring_group_id=group_id
                                    )
                                    slots.append(new_lc)
                                    added += 1
                                current_date += timedelta(days=1)
                            
                            for s in past_slots:
                                slots.remove(s)
                                s.delete()
                    
                    # Check for overlaps with student's other bookings
                    for s in slots:
                        overlapping = LiveClassBooking.objects.filter(
                            student=student,
                            status='confirmed',
                            live_class__start_time__lt=s.end_time,
                            live_class__end_time__gt=s.start_time
                        ).exists()
                        if overlapping:
                            messages.error(request, f"Schedule conflict: You already have a class scheduled that overlaps with {timezone.localtime(s.start_time).strftime('%b %d, %Y %I:%M %p')}.")
                            # Rollback private slot shifting if any overlap
                            transaction.set_rollback(True)
                            return redirect('courses:detail', course_id=course_id)
                    
                    enrollment, _ = Enrollment.objects.get_or_create(student=student, course=course)
                    
                    for s in slots:
                        if s.bookings.count() >= s.max_capacity:
                            continue
                        LiveClassBooking.objects.create(live_class=s, student=student, status='confirmed')
                        
            except Exception as e:
                messages.error(request, f"An error occurred: {str(e)}")
                return redirect('courses:detail', course_id=course_id)
                
            messages.success(request, 'Successfully booked the package!')
            return redirect('core:dashboard')

    return render(request, 'courses/enroll_course.html', {
        'course': course, 
        'student': student
    })


def teacher_create_course(request):
    if request.user.role != 'teacher':
        return redirect('core:home')
    
    categories = Category.objects.all().order_by('name')
    
    if request.method == 'POST':
        teacher_profile = request.user.teacher_profile
        from accounts.models import TeacherCertificate
        
        category_ids = request.POST.getlist('category[]')
        descriptions = request.POST.getlist('course_description[]')
        about_teachings = request.POST.getlist('about_teaching[]')
        skills_list = request.POST.getlist('skills[]')
        experiences = request.POST.getlist('experience[]')
        hourly_fees = request.POST.getlist('hourly_fee[]')
        total_duration_hours = request.POST.getlist('total_duration_hours[]')
        
        created_count = 0
        for i in range(len(category_ids)):
            if not category_ids[i]:
                continue
                
            intro_vid = request.FILES.get(f'intro_video_{i}')
            category = Category.objects.get(id=category_ids[i])
            
            h_fee = float(hourly_fees[i]) if i < len(hourly_fees) and hourly_fees[i] else 0.00
            t_dur = int(total_duration_hours[i]) if i < len(total_duration_hours) and total_duration_hours[i] else 0
            tot_amt = h_fee * t_dur
            
            course = Course.objects.create(
                title=f"{category.name} by {request.user.get_full_name() or request.user.username}",
                description=descriptions[i] if i < len(descriptions) else '',
                teacher=teacher_profile,
                category=category,
                about_teaching=about_teachings[i] if i < len(about_teachings) else '',
                skills=skills_list[i] if i < len(skills_list) else '',
                experience=experiences[i] if i < len(experiences) else '',
                hourly_fee=h_fee,
                total_duration_hours=t_dur,
                total_amount=tot_amt,
                teacher_price=tot_amt,
                price=tot_amt,  # Base price is teacher price until admin overrides
                intro_video=intro_vid,
                is_approved=False
            )
            created_count += 1
            
            # Save certificates
            cert_titles = request.POST.getlist(f'cert_title_{i}[]')
            cert_files = request.FILES.getlist(f'cert_file_{i}[]')
            for title, f in zip(cert_titles, cert_files):
                if f:
                    TeacherCertificate.objects.create(
                        teacher=teacher_profile,
                        title=title or f.name,
                        file=f
                    )
        
        if created_count > 0:
            messages.success(request, f'Successfully submitted {created_count} course(s) for Admin approval.')
        else:
            messages.error(request, 'No valid courses were submitted.')
            
        return redirect('core:dashboard')
        
    return render(request, 'courses/teacher_course_form.html', {'categories': categories, 'action': 'Create'})

@login_required
def teacher_edit_course(request, course_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
    
    course = get_object_or_404(Course, id=course_id, teacher=request.user.teacher_profile)
    categories = Category.objects.all().order_by('name')
    
    if request.method == 'POST':
        category_ids = request.POST.getlist('category[]')
        descriptions = request.POST.getlist('course_description[]')
        about_teachings = request.POST.getlist('about_teaching[]')
        skills_list = request.POST.getlist('skills[]')
        experiences = request.POST.getlist('experience[]')
        hourly_fees = request.POST.getlist('hourly_fee[]')
        total_duration_hours = request.POST.getlist('total_duration_hours[]')
        
        if category_ids and category_ids[0]:
            category = Category.objects.get(id=category_ids[0])
            course.category = category
            course.title = f"{category.name} by {request.user.get_full_name() or request.user.username}"
            course.description = descriptions[0] if descriptions else course.description
            course.about_teaching = about_teachings[0] if about_teachings else course.about_teaching
            course.skills = skills_list[0] if skills_list else course.skills
            course.experience = experiences[0] if experiences else course.experience
            
            if hourly_fees and hourly_fees[0]:
                course.hourly_fee = float(hourly_fees[0])
            if total_duration_hours and total_duration_hours[0]:
                course.total_duration_hours = int(total_duration_hours[0])
                
            course.total_amount = float(course.hourly_fee) * int(course.total_duration_hours)
            course.teacher_price = course.total_amount
            course.price = course.total_amount
                
            intro_vid = request.FILES.get('intro_video_0')
            if intro_vid:
                course.intro_video = intro_vid
                
            course.is_approved = False # Re-requires admin approval
            course.status = 'pending'
            course.save()
            
            # Save new certificates if any
            cert_titles = request.POST.getlist('cert_title_0[]')
            cert_files = request.FILES.getlist('cert_file_0[]')
            from accounts.models import TeacherCertificate
            for title, f in zip(cert_titles, cert_files):
                if f:
                    TeacherCertificate.objects.create(
                        teacher=request.user.teacher_profile,
                        title=title or f.name,
                        file=f
                    )
            
            messages.success(request, 'Course updated and sent for Admin approval.')
            return redirect('core:dashboard')
            
    return render(request, 'courses/teacher_course_form.html', {'course': course, 'categories': categories, 'action': 'Edit'})

@login_required
def teacher_delete_course(request, course_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
    course = get_object_or_404(Course, id=course_id, teacher=request.user.teacher_profile)
    course.delete()
    messages.success(request, 'Course deleted successfully.')
    return redirect('core:dashboard')

@login_required
def join_live_class(request, class_id):
    live_class = get_object_or_404(LiveClass, id=class_id)
    
    # If teacher, mark actual_start_time
    if request.user.role == 'teacher' and getattr(request.user, 'teacher_profile', None) == live_class.course.teacher:
        if not live_class.actual_start_time:
            from django.utils import timezone
            live_class.actual_start_time = timezone.now()
            live_class.save()

    # If student, mark attendance automatically
    if request.user.role == 'student':
        try:
            student_profile = request.user.student_profile
            # Only record if enrolled, but we can just mark it for simplicity
            att, created = Attendance.objects.get_or_create(
                student=student_profile,
                live_class=live_class,
                defaults={'status': 'present'}
            )
            if not created:
                att.status = 'present'
                if att.exited_at:
                    att.exited_at = None
                att.save()
        except StudentProfile.DoesNotExist:
            pass

    from django.conf import settings
    jitsi_domain = getattr(settings, 'JITSI_DOMAIN', 'meet.jit.si')
    return render(request, 'courses/live_class.html', {
        'live_class': live_class,
        'jitsi_domain': jitsi_domain,
    })

@login_required
def teacher_end_live_class(request, class_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
        
    live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
    live_class.is_ended = True
    
    from django.utils import timezone
    if not live_class.actual_end_time:
        live_class.actual_end_time = timezone.now()
    live_class.save()
    
    # Auto close all open attendances
    open_attendances = live_class.attendances.filter(exited_at__isnull=True)
    for att in open_attendances:
        att.exited_at = live_class.actual_end_time
        if att.joined_at and att.exited_at:
            att.duration = att.exited_at - att.joined_at
        att.save()
        
    # Calculate Partial / Present based on duration
    total_duration = None
    if live_class.actual_end_time and live_class.actual_start_time:
        total_duration = (live_class.actual_end_time - live_class.actual_start_time).total_seconds()
    
    if total_duration and total_duration > 0:
        for att in live_class.attendances.all():
            if att.duration:
                att_sec = att.duration.total_seconds()
                percentage = (att_sec / total_duration) * 100
                if percentage >= 50:
                    att.status = 'present'
                elif percentage > 0:
                    att.status = 'partial'
                else:
                    att.status = 'absent'
                att.save()
    
    messages.success(request, 'Live class has been ended successfully.')
    return redirect('courses:post_class_summary', class_id=live_class.id)

@login_required
def post_class_summary(request, class_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
    
    live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
    recorded_class = live_class.course.recorded_classes.filter(title__contains=live_class.title).last()
    
    if request.method == 'POST':
        # Handle notes
        notes_content = request.POST.getlist('note_content[]')
        files = request.FILES.getlist('note_file[]')
        
        extracted_materials = []
        import PyPDF2
        
        for i in range(len(notes_content)):
            content = notes_content[i].strip()
            file_obj = files[i] if i < len(files) else None
            
            if content or file_obj:
                note = ClassSummaryNote.objects.create(
                    live_class=live_class,
                    content=content,
                    visibility='everyone',
                    note_type='regular',
                    file=file_obj
                )
                
                extracted_text = content + "\n"
                if file_obj and file_obj.name.lower().endswith('.pdf'):
                    try:
                        # Read PDF in memory
                        pdf_reader = PyPDF2.PdfReader(file_obj)
                        for page in pdf_reader.pages:
                            extracted_text += page.extract_text() + "\n"
                    except Exception as e:
                        print(f"Error parsing PDF: {e}")
                extracted_materials.append(extracted_text)
                    
        # Generate AI Summary from extracted materials
        if extracted_materials:
            from .ai_utils import generate_class_ai_summary
            combined_materials = "\n\n---\n\n".join(extracted_materials)
            live_class.ai_summary = generate_class_ai_summary(combined_materials)
            live_class.save()
                
        # Handle recording visibility and expiry
        if recorded_class:
            from django.utils.dateparse import parse_datetime
            is_visible = request.POST.get('recording_visible') == 'on'
            expiry_str = request.POST.get('recording_expires_at')
            
            recorded_class.is_visible_to_students = is_visible
            if expiry_str:
                recorded_class.expires_at = parse_datetime(expiry_str)
            else:
                recorded_class.expires_at = None
                
            # Handle assign to specific students
            assign_type = request.POST.get('assign_type_recording')
            if assign_type == 'specific':
                recorded_class.assigned_to_all = False
                student_ids = request.POST.getlist('assigned_students_recording')
                recorded_class.assigned_students.set(student_ids)
            else:
                recorded_class.assigned_to_all = True
                recorded_class.assigned_students.clear()
                
            recorded_class.save()
            
        # Handle transcript visibility and expiry
        is_transcript_visible = request.POST.get('transcript_visible') == 'on'
        transcript_expiry_str = request.POST.get('transcript_expires_at')
        
        live_class.transcript_visible = is_transcript_visible
        if transcript_expiry_str:
            from django.utils.dateparse import parse_datetime
            live_class.transcript_expires_at = parse_datetime(transcript_expiry_str)
        else:
            live_class.transcript_expires_at = None
        live_class.save()
            
        messages.success(request, 'Class summary saved successfully.')
        return redirect('courses:teacher_manage_course', course_id=live_class.course.id)
        
    return render(request, 'courses/post_class_summary.html', {
        'live_class': live_class,
        'recorded_class': recorded_class
    })

@login_required
def toggle_live_class_break(request, class_id):
    if request.user.role != 'teacher':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
    from django.utils import timezone
    
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'start':
            live_class.is_on_break = True
            live_class.break_started_at = timezone.now()
        elif action == 'end':
            live_class.is_on_break = False
            live_class.break_started_at = None
        live_class.save()
        return JsonResponse({'status': 'success', 'is_on_break': live_class.is_on_break})
    
    return JsonResponse({'error': 'Invalid request'}, status=400)

@login_required
def teacher_manage_course(request, course_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
    course = get_object_or_404(Course, id=course_id, teacher=request.user.teacher_profile)
    
    from .models import LiveClassBooking, Attendance
    from django.utils import timezone
    
    bookings = LiveClassBooking.objects.filter(live_class__course=course, status='confirmed').select_related('student', 'student__user', 'live_class')
    booked_class_map = {b.live_class_id: b for b in bookings}
    booked_class_ids = set(booked_class_map.keys())
    booked_groups = set(course.live_classes.filter(id__in=booked_class_ids).exclude(recurring_group_id=None).values_list('recurring_group_id', flat=True))

    # 1. Package Progress
    packages = {}
    for lc in course.live_classes.order_by('start_time'):
        if lc.recurring_group_id:
            group_id = lc.recurring_group_id
            if group_id not in packages:
                packages[group_id] = {
                    'group_id': group_id,
                    'title': lc.title,
                    'total': 0,
                    'completed': 0,
                    'start_time': lc.start_time,
                    'student_name': None
                }
            packages[group_id]['total'] += 1
            if lc.has_ended:
                packages[group_id]['completed'] += 1
                
            if lc.id in booked_class_map and not packages[group_id]['student_name']:
                user = booked_class_map[lc.id].student.user
                packages[group_id]['student_name'] = user.get_full_name() or user.username

    package_progress = []
    for pkg in packages.values():
        pkg['progress_percentage'] = int((pkg['completed'] / pkg['total']) * 100) if pkg['total'] > 0 else 0
        package_progress.append(pkg)
    
    # Sort package progress to have incomplete ones first
    package_progress.sort(key=lambda x: x['progress_percentage'])

    # 2. Student Attendance Data
    # Pre-fetch all attendances for this course
    attendances = Attendance.objects.filter(live_class__course=course).select_related('student', 'live_class')
    attendance_map = {(a.student_id, a.live_class_id): a.status for a in attendances}
    
    students_attendance = {}
    for b in bookings:
        student = b.student
        if student.id not in students_attendance:
            students_attendance[student.id] = {
                'student': student,
                'total_booked': 0,
                'total_attended': 0,
                'records': []
            }
            
        students_attendance[student.id]['total_booked'] += 1
        status = attendance_map.get((student.id, b.live_class_id), 'absent')
        
        if status == 'present':
            students_attendance[student.id]['total_attended'] += 1
            
        students_attendance[student.id]['records'].append({
            'live_class': b.live_class,
            'status': status
        })
        
    student_attendance_data = []
    for sa in students_attendance.values():
        if sa['total_booked'] > 0:
            sa['percentage'] = int((sa['total_attended'] / sa['total_booked']) * 100)
        else:
            sa['percentage'] = 0
            
        # Sort records by date descending
        sa['records'].sort(key=lambda x: x['live_class'].start_time or timezone.now(), reverse=True)
        student_attendance_data.append(sa)

    # 3. Smart Upcoming Classes (show only next upcoming class per package)
    upcoming_classes = []
    seen_groups = set()
    


    for lc in course.live_classes.order_by('start_time'):
        if not lc.has_ended:
            # Check if this class or its group is booked
            if lc.recurring_group_id:
                lc.has_bookings = lc.recurring_group_id in booked_groups
                if lc.recurring_group_id not in seen_groups:
                    upcoming_classes.append(lc)
                    seen_groups.add(lc.recurring_group_id)
            else:
                lc.has_bookings = lc.id in booked_class_ids
                upcoming_classes.append(lc)

    context = {
        'course': course,
        'package_progress': package_progress,
        'student_attendance_data': student_attendance_data,
        'upcoming_classes': upcoming_classes
    }
    return render(request, 'courses/teacher_manage_course.html', context)

@login_required
def teacher_add_course_content(request, course_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
    course = get_object_or_404(Course, id=course_id, teacher=request.user.teacher_profile)
    
    if request.method == 'POST':
        content_type = request.POST.get('content_type')
        if content_type == 'live_class':
            date_str = request.POST.get('date')
            time_str = request.POST.get('time')
            duration = int(request.POST.get('duration', 60))
            max_capacity = int(request.POST.get('max_capacity', 1))
            
            time_str = time_str[:5] if time_str else "00:00"
            dt_str = f"{date_str} {time_str}"
            start_time = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
            start_time = timezone.make_aware(start_time, timezone.get_current_timezone())
            end_time = start_time + timedelta(minutes=duration)
            
            LiveClass.objects.create(
                course=course,
                title=request.POST.get('title'),
                start_time=start_time,
                end_time=end_time,
                max_capacity=max_capacity,
                description=request.POST.get('description')
            )
        else:
            # Common assignment logic
            assigned_to_all = request.POST.get(f'assign_type_{content_type}') != 'specific'
            assigned_students = request.POST.getlist(f'assigned_students_{content_type}')
            
            if content_type == 'recorded_class':
                obj = RecordedClass.objects.create(
                    course=course,
                    title=request.POST.get('title'),
                    description=request.POST.get('description'),
                    video=request.FILES.get('video'),
                    attachment1=request.FILES.get('attachment1'),
                    attachment2=request.FILES.get('attachment2'),
                    assigned_to_all=assigned_to_all
                )
            elif content_type == 'assignment':
                obj = Assignment.objects.create(
                    course=course,
                    title=request.POST.get('title'),
                    description=request.POST.get('description'),
                    file=request.FILES.get('file'),
                    due_date=request.POST.get('due_date'),
                    assigned_to_all=assigned_to_all
                )
            elif content_type == 'project':
                obj = Project.objects.create(
                    course=course,
                    title=request.POST.get('title'),
                    description=request.POST.get('description'),
                    file=request.FILES.get('file'),
                    due_date=request.POST.get('due_date'),
                    assigned_to_all=assigned_to_all
                )
            elif content_type == 'note':
                obj = CourseNote.objects.create(
                    course=course,
                    title=request.POST.get('title'),
                    file=request.FILES.get('file'),
                    assigned_to_all=assigned_to_all
                )
            
            if content_type in ['recorded_class', 'assignment', 'project', 'note'] and not assigned_to_all:
                obj.assigned_students.set(assigned_students)
                
        messages.success(request, 'Content added successfully.')
        
    return redirect('courses:teacher_manage_course', course_id=course.id)

from django.http import JsonResponse
import json

@login_required
def save_whiteboard(request, class_id):
    if request.method == 'POST' and request.user.role == 'teacher':
        live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
        data = json.loads(request.body)
        state, created = WhiteboardState.objects.get_or_create(live_class=live_class)
        state.drawing_data = data.get('drawing_data', '')
        state.save()
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
def get_whiteboard(request, class_id):
    live_class = get_object_or_404(LiveClass, id=class_id)
    try:
        state = live_class.whiteboard
        return JsonResponse({'status': 'success', 'drawing_data': state.drawing_data})
    except WhiteboardState.DoesNotExist:
        return JsonResponse({'status': 'success', 'drawing_data': ''})

@login_required
def student_submit_work(request):
    if request.method == 'POST' and request.user.role == 'student':
        item_type = request.POST.get('item_type')
        item_id = request.POST.get('item_id')
        file = request.FILES.get('file')
        student_notes = request.POST.get('student_notes', '')
        
        if not file:
            messages.error(request, 'Please upload a file.')
            return redirect('core:dashboard')
            
        student_profile = request.user.student_profile
        
        from .models import StudentSubmission
        
        if item_type == 'assignment':
            assignment = get_object_or_404(Assignment, id=item_id)
            submission, created = StudentSubmission.objects.get_or_create(
                student=student_profile,
                assignment=assignment,
                defaults={'file': file, 'student_notes': student_notes}
            )
            if not created:
                submission.file = file
                submission.student_notes = student_notes
                submission.status = 'submitted'
                submission.save()
            messages.success(request, 'Assignment submitted successfully!')
            
        elif item_type == 'project':
            project = get_object_or_404(Project, id=item_id)
            submission, created = StudentSubmission.objects.get_or_create(
                student=student_profile,
                project=project,
                defaults={'file': file, 'student_notes': student_notes}
            )
            if not created:
                submission.file = file
                submission.student_notes = student_notes
                submission.status = 'submitted'
                submission.save()
            messages.success(request, 'Project submitted successfully!')
            
    return redirect('core:dashboard')

@login_required
def teacher_view_submissions(request, item_type, item_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
        
    from .models import StudentSubmission
    
    if item_type == 'assignment':
        item = get_object_or_404(Assignment, id=item_id)
        if item.course.teacher != request.user.teacher_profile:
            return redirect('core:home')
        submissions = StudentSubmission.objects.filter(assignment=item).order_by('-submitted_at')
    elif item_type == 'project':
        item = get_object_or_404(Project, id=item_id)
        if item.course.teacher != request.user.teacher_profile:
            return redirect('core:home')
        submissions = StudentSubmission.objects.filter(project=item).order_by('-submitted_at')
    else:
        return redirect('core:home')
        
    context = {
        'item': item,
        'item_type': item_type,
        'submissions': submissions
    }
    return render(request, 'courses/teacher_view_submissions.html', context)

@login_required
def teacher_grade_submission(request, submission_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
        
    from .models import StudentSubmission
    submission = get_object_or_404(StudentSubmission, id=submission_id)
    
    # Check permissions
    if submission.assignment:
        item = submission.assignment
    else:
        item = submission.project
        
    if item.course.teacher != request.user.teacher_profile:
        return redirect('core:home')
        
    if request.method == 'POST':
        status = request.POST.get('status')
        comments = request.POST.get('comments')
        
        if status in [choice[0] for choice in StudentSubmission.STATUS_CHOICES]:
            submission.status = status
        submission.teacher_comments = comments
        submission.save()
        
        messages.success(request, 'Submission graded successfully.')
        
    item_type = 'assignment' if submission.assignment else 'project'
    return redirect('courses:teacher_view_submissions', item_type=item_type, item_id=item.id)

@login_required
def teacher_student_detail(request, student_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
        
    student = get_object_or_404(StudentProfile, id=student_id)
    teacher = request.user.teacher_profile
    
    # Get courses the student is enrolled in that belong to this teacher
    enrolled_courses = Course.objects.filter(teacher=teacher, enrollments__student=student)
    
    if not enrolled_courses.exists():
        messages.error(request, 'This student is not enrolled in any of your courses.')
        return redirect('core:dashboard')
        
    course_id = request.GET.get('course_id')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    target_courses = enrolled_courses
    if course_id and course_id != 'all':
        target_courses = enrolled_courses.filter(id=course_id)

    # Get attendance for these courses
    attendances = Attendance.objects.filter(student=student, live_class__course__in=target_courses)
    
    if start_date:
        attendances = attendances.filter(live_class__start_time__date__gte=start_date)
    if end_date:
        attendances = attendances.filter(live_class__start_time__date__lte=end_date)
        
    attendances = attendances.order_by('-joined_at')
    
    # Get submissions for these courses
    from .models import StudentSubmission
    submissions = StudentSubmission.objects.filter(
        student=student
    ).filter(
        models.Q(assignment__course__in=target_courses) | 
        models.Q(project__course__in=target_courses)
    )
    
    if start_date:
        submissions = submissions.filter(submitted_at__date__gte=start_date)
    if end_date:
        submissions = submissions.filter(submitted_at__date__lte=end_date)
        
    submissions = submissions.order_by('-submitted_at')
    
    from core.utils import get_attendance_analytics
    analytics_context = get_attendance_analytics(request, attendances)
    
    context = {
        'student': student,
        'enrolled_courses': enrolled_courses,
        'attendances': attendances,
        'submissions': submissions,
        **analytics_context
    }
    return render(request, 'courses/teacher_student_detail.html', context)

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
@login_required
def mark_attendance_exit(request, class_id):
    if request.method == 'POST' and request.user.role == 'student':
        try:
            live_class = LiveClass.objects.get(id=class_id)
            att = Attendance.objects.get(student=request.user.student_profile, live_class=live_class)
            from django.utils import timezone
            att.exited_at = timezone.now()
            if att.joined_at:
                att.duration = att.exited_at - att.joined_at
            att.save()
            return JsonResponse({'status': 'success'})
        except Exception:
            pass
    return JsonResponse({'status': 'error'})

@login_required
def teacher_delete_live_class(request, class_id):
    if request.user.role != 'teacher':
        return redirect('core:home')
    
    live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
    course_id = live_class.course.id
    
    if live_class.bookings.exists():
        messages.error(request, 'Cannot delete a class that has student bookings.')
    else:
        live_class.delete()
        messages.success(request, 'Live class deleted successfully.')
        
    # Redirect back to the active tab via URL hash
    return redirect(f"{reverse('courses:teacher_manage_course', args=[course_id])}#live_classes")

@login_required
def upload_recording_and_transcript(request, class_id):
    if request.method == 'POST' and request.user.role == 'teacher':
        live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
        
        transcript = request.POST.get('transcript', '')
        video = request.FILES.get('video')
        
        if transcript:
            live_class.transcript = transcript
            live_class.save()
            
        if video:
            from django.utils import timezone
            session_date = live_class.start_time.date() if live_class.start_time else timezone.now().date()
            rc = RecordedClass.objects.create(
                course=live_class.course,
                title=f"Recording of: {live_class.title}",
                description=f"Auto-recorded session from {session_date}",
                video=video,
                live_class=live_class
            )
            
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)

@login_required
def toggle_recording_visibility(request, rc_id):
    if request.method == 'POST' and request.user.role == 'teacher':
        recorded_class = get_object_or_404(RecordedClass, id=rc_id, course__teacher=request.user.teacher_profile)
        
        # Toggle visibility
        recorded_class.is_visible_to_students = request.POST.get('recording_visible') == 'on'
        
        from django.utils.dateparse import parse_datetime
        expiry_str = request.POST.get('recording_expires_at')
        if expiry_str:
            recorded_class.expires_at = parse_datetime(expiry_str)
        else:
            recorded_class.expires_at = None
            
        assign_type = request.POST.get(f'assign_type_recording_{rc_id}')
        if assign_type == 'specific':
            recorded_class.assigned_to_all = False
            student_ids = request.POST.getlist(f'assigned_students_recording_{rc_id}')
            recorded_class.assigned_students.set(student_ids)
        else:
            recorded_class.assigned_to_all = True
            recorded_class.assigned_students.clear()
            
        recorded_class.save()
        messages.success(request, f'Settings for "{recorded_class.title}" updated.')
        
        return redirect(f"{reverse('courses:teacher_manage_course', args=[recorded_class.course.id])}#recorded_classes")
    return redirect('core:home')

@login_required
def delete_recorded_class(request, rc_id):
    if request.method == 'POST' and request.user.role == 'teacher':
        recorded_class = get_object_or_404(RecordedClass, id=rc_id, course__teacher=request.user.teacher_profile)
        course_id = recorded_class.course.id
        recorded_class.delete()
        messages.success(request, 'Recorded class deleted successfully.')
        return redirect(f"{reverse('courses:teacher_manage_course', args=[course_id])}#recorded_classes")
    return redirect('core:home')

@login_required
def update_transcript_settings(request, class_id):
    if request.method == 'POST' and request.user.role == 'teacher':
        live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
        
        live_class.transcript_visible = request.POST.get('transcript_visible') == 'on'
        
        from django.utils.dateparse import parse_datetime
        expiry_str = request.POST.get('transcript_expires_at')
        if expiry_str:
            live_class.transcript_expires_at = parse_datetime(expiry_str)
        else:
            live_class.transcript_expires_at = None
            
        live_class.save()
        messages.success(request, f'Transcript settings for "{live_class.title}" updated.')
        return redirect(f"{reverse('courses:teacher_manage_course', args=[live_class.course.id])}#recorded_classes")
    return redirect('core:home')

@login_required
def delete_transcript(request, class_id):
    if request.method == 'POST' and request.user.role == 'teacher':
        live_class = get_object_or_404(LiveClass, id=class_id, course__teacher=request.user.teacher_profile)
        live_class.transcript = None
        live_class.transcript_visible = False
        live_class.transcript_expires_at = None
        live_class.ai_summary = None
        live_class.save()
        messages.success(request, 'Transcript deleted successfully.')
        return redirect(f"{reverse('courses:teacher_manage_course', args=[live_class.course.id])}#recorded_classes")
    return redirect('core:home')

@login_required
def view_class_transcript(request, class_id):
    live_class = get_object_or_404(LiveClass, id=class_id)
    
    role = request.user.role
    # Exclude complaints from normal summary views
    all_notes = live_class.summary_notes.exclude(note_type='complaint').order_by('-created_at')
    
    if role == 'teacher':
        manual_notes = all_notes
    elif role == 'parent':
        manual_notes = all_notes.filter(visibility__in=['everyone', 'parents_only'])
    elif role == 'student':
        has_booked = live_class.bookings.filter(student=request.user.student_profile, status='confirmed').exists()
        if has_booked:
            manual_notes = all_notes.filter(visibility__in=['everyone', 'students_only'])
        else:
            manual_notes = all_notes.filter(visibility='everyone')
    else:
        manual_notes = all_notes.filter(visibility='everyone')
        
    return render(request, 'courses/class_transcript.html', {
        'live_class': live_class,
        'manual_notes': manual_notes
    })

from django.utils.dateparse import parse_datetime
from .models import LiveClassBooking

@login_required
def teacher_schedule_view(request):
    if request.user.role != 'teacher':
        return redirect('core:home')
    courses = Course.objects.filter(teacher=request.user.teacher_profile)
    live_classes = LiveClass.objects.filter(
        course__teacher=request.user.teacher_profile
    ).select_related('course').prefetch_related(
        'bookings__student__user'
    ).order_by('start_time')
    
    # Filter out ended classes and group by package (recurring_group_id)
    seen_groups_booked = set()
    seen_groups_unbooked = set()
    
    booked_classes = []
    unbooked_classes = []
    
    for lc in live_classes:
        if lc.has_ended:
            continue
            
        if lc.bookings.exists():
            if lc.recurring_group_id:
                if lc.recurring_group_id not in seen_groups_booked:
                    booked_classes.append(lc)
                    seen_groups_booked.add(lc.recurring_group_id)
            else:
                booked_classes.append(lc)
        else:
            if lc.recurring_group_id:
                if lc.recurring_group_id not in seen_groups_unbooked:
                    unbooked_classes.append(lc)
                    seen_groups_unbooked.add(lc.recurring_group_id)
            else:
                unbooked_classes.append(lc)
            
    return render(request, 'courses/teacher_schedule.html', {
        'courses': courses,
        'booked_classes': booked_classes,
        'unbooked_classes': unbooked_classes,
    })

@login_required
def teacher_calendar_view(request):
    if not hasattr(request.user, 'teacher_profile'):
        messages.error(request, 'Only teachers can access the calendar.')
        return redirect('core:home')
        
    teacher = request.user.teacher_profile
    courses = Course.objects.filter(teacher=teacher)
    
    # Compute Analytics
    live_classes = LiveClass.objects.filter(course__teacher=teacher)
    total_slots = live_classes.count()
    
    # Classes with at least one booking
    booked_slots = live_classes.filter(bookings__status='confirmed').distinct().count()
    available_slots = total_slots - booked_slots
    
    booking_rate = (booked_slots / total_slots * 100) if total_slots > 0 else 0.0
    
    # Total Hours
    total_seconds = 0
    for lc in live_classes:
        if lc.start_time and lc.end_time:
            total_seconds += (lc.end_time - lc.start_time).total_seconds()
    total_hours = round(total_seconds / 3600, 1)
    
    # Upcoming slots list for table sorting
    from django.utils import timezone
    upcoming_classes = live_classes.filter(start_time__gte=timezone.now()).order_by('start_time')
    
    context = {
        'courses': courses,
        'total_slots': total_slots,
        'booked_slots': booked_slots,
        'available_slots': available_slots,
        'booking_rate': round(booking_rate, 1),
        'total_hours': total_hours,
        'upcoming_classes': upcoming_classes,
    }
    return render(request, 'courses/teacher_calendar.html', context)

@login_required
def teacher_slots_list_view(request):
    if not hasattr(request.user, 'teacher_profile'):
        messages.error(request, 'Only teachers can access the slots list.')
        return redirect('core:home')
        
    teacher = request.user.teacher_profile
    courses = Course.objects.filter(teacher=teacher)
    
    # Get filters
    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')
    status_filter = request.GET.get('status')
    
    import datetime
    from django.utils import timezone
    
    today = timezone.now().date()
    if start_date_str:
        try:
            start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            start_date = today
    else:
        start_date = today
        
    if end_date_str:
        try:
            end_date = datetime.datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            end_date = today + datetime.timedelta(days=7)
    else:
        end_date = today + datetime.timedelta(days=7)
        
    # Query live classes in range
    live_classes = LiveClass.objects.filter(
        course__teacher=teacher,
        start_time__date__gte=start_date,
        start_time__date__lte=end_date
    ).select_related('course').prefetch_related('bookings__student__user')
    
    # Generate slots based on actual LiveClasses
    slots = []
    for lc in live_classes.order_by('start_time'):
        if not lc.start_time or not lc.end_time:
            continue
            
        confirmed_bookings = lc.bookings.filter(status='confirmed')
        booked_count = confirmed_bookings.count()
        
        status = 'busy' if booked_count > 0 else 'free'
        
        if status_filter == 'free' and status != 'free':
            continue
        if status_filter == 'busy' and status != 'busy':
            continue
            
        details = {
            'class_id': lc.id,
            'title': lc.title,
            'course': lc.course.title if lc.course else 'No Course',
            'booked_count': booked_count,
            'max_capacity': lc.max_capacity,
            'students': [b.student.user.get_full_name() or b.student.user.username for b in confirmed_bookings],
        }
            
        slots.append({
            'date': lc.start_time.date(),
            'start_time': lc.start_time,
            'end_time': lc.end_time,
            'status': status,
            'details': details
        })
        
    return render(request, 'courses/teacher_slots_list.html', {
        'slots': slots,
        'start_date': start_date.strftime("%Y-%m-%d"),
        'end_date': end_date.strftime("%Y-%m-%d"),
        'status_filter': status_filter or '',
        'courses': courses,
    })

@login_required
def api_teacher_calendar_events(request):
    if not hasattr(request.user, 'teacher_profile'):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    teacher_profile = request.user.teacher_profile
    live_classes = LiveClass.objects.filter(course__teacher=teacher_profile)
    
    events = []
    for lc in live_classes:
        if not lc.start_time or not lc.end_time:
            continue
            
        booked_count = lc.bookings.filter(status='confirmed').count()
        is_full = booked_count >= lc.max_capacity
        
        # Color logic
        if lc.class_type == 'public':
            color = "#0ea5e9" if not is_full else "#64748b"
            title = f"[GROUP] {lc.title} ({booked_count}/{lc.max_capacity})"
        else:
            color = "#10b981"  # green = available private
            if is_full:
                color = "#ef4444"  # red = taken
            elif booked_count > 0:
                color = "#f59e0b"  # amber = partially booked
            course_name = lc.course.title if lc.course else "No Course"
            title = f"[1-on-1] {course_name} ({booked_count}/{lc.max_capacity})"
            
        if lc.has_ended:
            color = "#64748b" # slate gray for past classes
            
        student_names = ", ".join([b.student.user.get_full_name() or b.student.user.username for b in lc.bookings.filter(status='confirmed')])
        if student_names:
            title += f" - {student_names}"
            
        events.append({
            'id': lc.id,
            'title': title,
            'start': lc.start_time.isoformat(),
            'end': lc.end_time.isoformat(),
            'color': color,
            'textColor': '#ffffff',
            'display': 'block',  # Forces solid blocks in Month View

            'extendedProps': {
                'course': lc.course.title if lc.course else '',
                'bookedCount': booked_count,
                'maxCapacity': lc.max_capacity,
                'students': student_names,
                'isEnded': lc.has_ended,
            }
        })
        
    return JsonResponse(events, safe=False)

def api_get_teacher_slots(request):
    teacher_id = request.GET.get('teacher_id')
    course_id = request.GET.get('course_id')
    class_type_filter = request.GET.get('class_type')  # 'private', 'public', or None for all
    
    teacher_profile = None
    if course_id:
        course = get_object_or_404(Course, id=course_id)
        teacher_profile = course.teacher
    elif teacher_id:
        from accounts.models import TeacherProfile
        teacher_profile = get_object_or_404(TeacherProfile, id=teacher_id)
    elif request.user.is_authenticated and getattr(request.user, 'role', '') == 'teacher':
        teacher_profile = request.user.teacher_profile
    else:
        return JsonResponse({'error': 'Missing teacher or course info'}, status=400)
        
    live_classes = LiveClass.objects.filter(course__teacher=teacher_profile)
    if course_id:
        live_classes = live_classes.filter(course_id=course_id)
    
    # Everyone except the teacher themselves should only see private classes, or APPROVED public classes.
    if not (request.user.is_authenticated and getattr(request.user, 'role', '') == 'teacher' and teacher_profile == getattr(request.user, 'teacher_profile', None)):
        from django.db.models import Q
        live_classes = live_classes.filter(Q(class_type='private') | Q(class_type='public', status='approved'))
    
    if class_type_filter:
        live_classes = live_classes.filter(class_type=class_type_filter)
        
    student_profile_id = None
    if request.user.is_authenticated:
        if getattr(request.user, 'role', '') == 'student':
            student_profile_id = request.user.student_profile.id
        elif getattr(request.user, 'role', '') == 'parent':
            student_id = request.GET.get('student_id')
            if student_id:
                student_profile_id = student_id
                
    total_purchased_hours = 0
    already_booked_dates = []
    global_student_bookings = []
    
    if student_profile_id:
        from .models import LiveClassBooking
        all_student_bookings = LiveClassBooking.objects.filter(
            student_id=student_profile_id,
            status='confirmed'
        ).select_related('live_class', 'live_class__course')
        global_student_bookings = list(all_student_bookings)
        
        if course_id:
            course_bookings = [b for b in all_student_bookings if str(b.live_class.course_id) == str(course_id)]
            total_purchased_hours = len(course_bookings)
            for b in course_bookings:
                if b.live_class.start_time:
                    already_booked_dates.append(b.live_class.start_time.date().isoformat())
                
    events = []
    for lc in live_classes:
        has_time_overlap = False
        overlap_course_name = ''
        if not lc.has_ended and global_student_bookings:
            for b in global_student_bookings:
                if b.live_class.id == lc.id:
                    continue
                if lc.start_time and lc.end_time and b.live_class.start_time and b.live_class.end_time:
                    if lc.start_time < b.live_class.end_time and lc.end_time > b.live_class.start_time:
                        has_time_overlap = True
                        overlap_course_name = b.live_class.course.title if b.live_class.course else 'Another Course'
                        break

        if not lc.start_time or not lc.end_time:
            continue
            
        booked_count = lc.bookings.filter(status='confirmed').count()
        course_name = lc.course.title if lc.course else "No Course"
        
        is_full = booked_count >= lc.max_capacity
        is_teacher_owner = (request.user.is_authenticated and getattr(request.user, 'role', '') == 'teacher' and teacher_profile == getattr(request.user, 'teacher_profile', None))
        if is_full and not is_teacher_owner:
            continue
            
        has_booked = False
        if student_profile_id:
            has_booked = lc.bookings.filter(student_id=student_profile_id, status='confirmed').exists()
                
        if has_booked:
            continue
        
        # Color logic
        if lc.class_type == 'public':
            color = "#4cc9f0" if not is_full else "#adb5bd"
            if has_booked:
                color = "#0d6efd"
            title = f"[GROUP] {lc.title} ({booked_count}/{lc.max_capacity})"
        else:
            color = "#28a745"  # green = available private
            if is_full:
                color = "#dc3545"  # red = taken
            elif booked_count > 0:
                color = "#ffc107"  # yellow = partially booked
            title = f"[1-on-1] {course_name} ({booked_count}/{lc.max_capacity})"
            if has_booked:
                color = "#6f42c1"  # purple = booked by me
        
        if request.user.is_authenticated and getattr(request.user, 'role', '') == 'teacher':
            student_names = ", ".join([b.student.user.username for b in lc.bookings.filter(status='confirmed')])
            title = f"{lc.title} ({booked_count}/{lc.max_capacity})"
            if student_names:
                title += f" - {student_names}"
                
        events.append({
            'id': lc.id,
            'title': title,
            'start': lc.start_time.isoformat(),
            'end': lc.end_time.isoformat(),
            'color': color,
            'is_booked': is_full,
            'has_booked': has_booked,
            'max_capacity': lc.max_capacity,
            'booked_count': booked_count,
            'course_id': lc.course_id,
            'class_type': lc.class_type,
            'status': lc.status,
            'recurring_group_id': lc.recurring_group_id,
            'description': lc.description or '',
            'price': str(lc.price),
            'total_purchased_hours': total_purchased_hours,
            'already_booked_dates': already_booked_dates,
            'has_time_overlap': has_time_overlap,
            'overlap_course_name': overlap_course_name,
        })
    return JsonResponse(events, safe=False)

@csrf_exempt
@login_required
def api_manage_slot(request):
    if request.user.role != 'teacher':
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    teacher = request.user.teacher_profile
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        
        course_id = data.get('course_id')
        if not course_id:
            return JsonResponse({'error': 'Course is required'}, status=400)
            
        course = get_object_or_404(Course, id=course_id, teacher=teacher)
        
        class_type = data.get('class_type', 'private')
        schedule_type = data.get('schedule_type', 'demo')
        days_of_week = data.get('days_of_week', [])
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        demo_date_str = data.get('demo_date')
        times = data.get('times', [])
        if not times:
            start_time_str = data.get('start_time')
            end_time_str = data.get('end_time')
            if start_time_str and end_time_str:
                times = [{'start': start_time_str, 'end': end_time_str}]
            else:
                return JsonResponse({'error': 'Time slots are required'}, status=400)
                
        from django.utils import timezone
        import datetime
        from datetime import timedelta
        import uuid
        import math
        
        total_created_count = 0
        
        for time_slot in times:
            start_time_str = time_slot.get('start')
            end_time_str = time_slot.get('end')
            
            try:
                start_time = datetime.datetime.strptime(start_time_str, "%H:%M").time()
                end_time = datetime.datetime.strptime(end_time_str, "%H:%M").time()
            except:
                return JsonResponse({'error': f'Invalid time format: {start_time_str} - {end_time_str}'}, status=400)
                
            total_slots_needed = 1
            if schedule_type == 'demo':
                total_slots_needed = 1
            elif schedule_type == 'monthly':
                total_slots_needed = 9999
            elif schedule_type == 'full':
                course_hours = float(course.total_duration_hours or 0)
                today = datetime.datetime.today()
                dt_start = datetime.datetime.combine(today, start_time)
                dt_end = datetime.datetime.combine(today, end_time)
                if dt_end <= dt_start:
                    dt_end += timedelta(days=1)
                slot_duration_hours = (dt_end - dt_start).total_seconds() / 3600.0
                
                if slot_duration_hours > 0 and course_hours > 0:
                    total_slots_needed = math.ceil(course_hours / slot_duration_hours)
                else:
                    total_slots_needed = 4 * max(1, len(days_of_week))
                    
            if total_slots_needed <= 0:
                total_slots_needed = 1
                
            recurring_group_id = str(uuid.uuid4())
            
            if class_type == 'public':
                title = data.get('title') or f"Public Session: {course.title}"
                description = data.get('description', '')
                teacher_requested_price = 0.00
                mc_val = data.get('max_capacity')
                max_capacity = int(mc_val) if mc_val else 10
                status = 'pending'
            else:
                title = f"1-on-1: {course.title}"
                description = ''
                teacher_requested_price = 0.00
                max_capacity = 1
                status = 'approved'
                
            current_date = timezone.now().date()
            if timezone.now().time() > start_time:
                current_date += timedelta(days=1)
                
            end_date_limit = None
            if schedule_type == 'monthly':
                if start_date_str and end_date_str:
                    try:
                        current_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d").date()
                        end_date_limit = datetime.datetime.strptime(end_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        return JsonResponse({'error': 'Invalid date format'}, status=400)
                    if current_date > end_date_limit:
                        return JsonResponse({'error': 'Start date must be before end date'}, status=400)
                else:
                    total_slots_needed = 4 * max(1, len(days_of_week))
            elif schedule_type == 'demo':
                if demo_date_str:
                    try:
                        current_date = datetime.datetime.strptime(demo_date_str, "%Y-%m-%d").date()
                        end_date_limit = current_date
                    except ValueError:
                        return JsonResponse({'error': 'Invalid demo date'}, status=400)
                else:
                    return JsonResponse({'error': 'Demo date is required'}, status=400)
                
            created_count = 0
            safety_limit = 365
            days_checked = 0
            created_ids = []
            
            while created_count < total_slots_needed and days_checked < safety_limit:
                if end_date_limit and current_date > end_date_limit:
                    break
                if schedule_type == 'demo' or current_date.weekday() in days_of_week:
                    slot_start = timezone.make_aware(datetime.datetime.combine(current_date, start_time))
                    slot_end = timezone.make_aware(datetime.datetime.combine(current_date, end_time))
                    if slot_end <= slot_start:
                        slot_end += timedelta(days=1)
                        
                    overlap = LiveClass.objects.filter(
                        course__teacher=teacher,
                        start_time__lt=slot_end,
                        end_time__gt=slot_start
                    ).first()
                    
                    if overlap:
                        LiveClass.objects.filter(id__in=created_ids).delete()
                        return JsonResponse({'error': f"Time overlap with existing class: {overlap.title} on {current_date}"}, status=400)

                    lc = LiveClass.objects.create(
                        course=course,
                        title=title,
                        description=description,
                        start_time=slot_start, 
                        end_time=slot_end,
                        max_capacity=max_capacity,
                        class_type=class_type,
                        status=status,
                        teacher_requested_price=teacher_requested_price,
                        recurring_group_id=recurring_group_id,
                        is_free=(schedule_type == 'demo')
                    )
                    created_ids.append(lc.id)
                    created_count += 1
                    total_created_count += 1
                    
                current_date += timedelta(days=1)
                days_checked += 1

        return JsonResponse({'status': 'success', 'created': total_created_count})
        
    elif request.method == 'DELETE':
        data = json.loads(request.body)
        group_id = data.get('recurring_group_id')
        slot_id = data.get('id')
        
        if group_id:
            slots = LiveClass.objects.filter(recurring_group_id=group_id, course__teacher=teacher)
            has_bookings = False
            for s in slots:
                if s.bookings.exists():
                    has_bookings = True
                    break
            if has_bookings:
                return JsonResponse({'error': 'Cannot delete set. One or more classes are already booked by students.'}, status=400)
            slots.delete()
            return JsonResponse({'status': 'success'})
        elif slot_id:
            try:
                lc = LiveClass.objects.get(id=slot_id, course__teacher=teacher)
                if lc.bookings.exists():
                    return JsonResponse({'error': 'Cannot delete slot. It is booked.'}, status=400)
                lc.delete()
                return JsonResponse({'status': 'success'})
            except LiveClass.DoesNotExist:
                return JsonResponse({'error': 'Not found'}, status=404)
                
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
@login_required
def api_check_recurring_slots(request):
    """
    Checks how many future slots are available that match the weekday and time
    of the currently selected slots, up to the course's total duration.
    """
    if request.user.role not in ['student', 'parent']:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            slot_ids = data.get('slot_ids', [])
            if not slot_ids:
                return JsonResponse({'error': 'No slots selected'}, status=400)
                
            selected_slots = list(LiveClass.objects.filter(id__in=slot_ids))
            if not selected_slots:
                return JsonResponse({'error': 'Invalid slots'}, status=400)
                
            course = selected_slots[0].course
            required_hours = course.total_duration_hours
            
            # Build target (weekday, time) pairs
            # Use local time representation assuming that's what the teacher intended
            from django.utils import timezone
            target_patterns = []
            for s in selected_slots:
                local_dt = timezone.localtime(s.start_time)
                target_patterns.append((local_dt.weekday(), local_dt.time()))
            
            now = timezone.now()
            all_future_slots = LiveClass.objects.filter(course=course, start_time__gte=now).order_by('start_time')
            
            matching_slots = []
            other_available_slots = []
            
            student_id = data.get('student_id')
            student = None
            if student_id:
                from accounts.models import StudentProfile
                student = StudentProfile.objects.filter(student_id=student_id).first()
            elif request.user.role == 'student':
                student = request.user.student_profile
                
            existing_bookings = []
            if student:
                from courses.models import LiveClassBooking
                existing_bookings = list(LiveClassBooking.objects.filter(
                    student=student, 
                    status='confirmed'
                ).select_related('live_class'))
            
            for s in all_future_slots:
                local_dt = timezone.localtime(s.start_time)
                
                # Check for overlap with student's other bookings
                has_overlap = False
                for b in existing_bookings:
                    if b.live_class.id == s.id:
                        continue # Already booked this exact class
                    # Check time overlap
                    if s.start_time < b.live_class.end_time and s.end_time > b.live_class.start_time:
                        has_overlap = True
                        break
                
                # Check if slot is fully booked or if student has already purchased it, or overlap
                already_booked_by_student = s.bookings.filter(student=student, status='confirmed').exists() if student else False
                
                if s.bookings.filter(status='confirmed').count() < s.max_capacity and not already_booked_by_student and not has_overlap:
                    if (local_dt.weekday(), local_dt.time()) in target_patterns:
                        matching_slots.append(s)
                    else:
                        other_available_slots.append({
                            'id': s.id,
                            'title': s.title,
                            'date': local_dt.strftime('%b %d, %Y'),
                            'time': local_dt.strftime('%I:%M %p')
                        })
            
            found_count = len(matching_slots)
            rate = float(course.price) / float(course.total_duration_hours) if course.total_duration_hours else 0.0
            
            if found_count >= required_hours:
                return JsonResponse({
                    'status': 'success',
                    'found_slots': required_hours,
                    'required_slots': required_hours,
                    'price': float(required_hours * rate)
                })
            else:
                return JsonResponse({
                    'status': 'shortfall',
                    'found_slots': found_count,
                    'required_slots': required_hours,
                    'price': float(found_count * rate),
                    'other_available_slots': other_available_slots
                })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
@login_required
def api_book_slot(request):
    if request.user.role not in ['student', 'parent']:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method == 'POST':
        data = json.loads(request.body)
        lc = get_object_or_404(LiveClass, id=data.get('slot_id'))
        book_recurring = data.get('book_recurring', False)
        
        if request.user.role == 'student':
            student = request.user.student_profile
        else:
            student_id = data.get('student_id')
            if not student_id:
                return JsonResponse({'error': 'Student ID required'}, status=400)
            from accounts.models import StudentProfile
            student = get_object_or_404(StudentProfile, id=student_id)
            if not request.user.parent_profile.children.filter(id=student.id).exists():
                return JsonResponse({'error': 'Unauthorized to book for this student'}, status=403)
        
        # Check already booked exactly this slot
        if lc.bookings.filter(student=student, status='confirmed').exists():
            return JsonResponse({'error': 'You have already booked this session'}, status=400)
            
        # Check capacity
        if lc.bookings.filter(status='confirmed').count() >= lc.max_capacity:
            return JsonResponse({'error': 'Session is full'}, status=400)

        # Helper to check constraints for a given slot
        from django.utils import timezone
        from datetime import timedelta
        
        def check_booking_constraints(slot_to_check, current_student):
            if not slot_to_check.start_time:
                return None
            
            # Rule 1: One subject per day
            class_date = slot_to_check.start_time.date()
            existing_same_day = LiveClassBooking.objects.filter(
                student=current_student,
                live_class__course=slot_to_check.course,
                live_class__start_time__date=class_date,
                status='confirmed'
            ).exists()
            if existing_same_day:
                return 'Student already has a booking for this subject on this date.'

            return None

        # Calculate remaining hours to fill (Rule 2)
        total_hours = lc.course.total_duration_hours or 0
        slot_duration_hours = 0
        if lc.start_time and lc.end_time:
            slot_duration_hours = (lc.end_time - lc.start_time).total_seconds() / 3600.0
        slot_duration_hours = slot_duration_hours or 1
        
        already_booked_hours = LiveClassBooking.objects.filter(
            student=student, live_class__course=lc.course, status='confirmed'
        ).count() * slot_duration_hours
        remaining_hours = total_hours - already_booked_hours
        slots_to_book = int(remaining_hours / slot_duration_hours) if slot_duration_hours > 0 else 0

        # ---- RECURRING PRIVATE CLASS BOOKING ----
        if book_recurring and lc.class_type == 'private' and lc.recurring_group_id:
            enrollment = lc.course.enrollments.filter(student=student, status='active').first()
            if not enrollment:
                return JsonResponse({'error': 'You are not enrolled in this course'}, status=403)
            
            if slots_to_book <= 0:
                return JsonResponse({'error': 'Cannot exceed the maximum purchased hours for this course.'}, status=400)
            
            # Get all future recurring slots in this group
            now = timezone.now()
            future_slots = LiveClass.objects.filter(
                recurring_group_id=lc.recurring_group_id,
                start_time__gte=now,
                class_type='private',
                status='approved'
            ).order_by('start_time')
            
            booked = []
            skipped = []
            booked_count = 0
            
            for slot in future_slots:
                if booked_count >= slots_to_book:
                    break
                # Check capacity
                if slot.bookings.filter(status='confirmed').count() >= slot.max_capacity:
                    skipped.append({'date': slot.start_time.strftime('%A, %b %d %Y'), 'reason': 'Already booked by another student'})
                    continue
                # Check if already booked by this student
                if slot.bookings.filter(student=student, status='confirmed').exists():
                    booked_count += 1
                    continue
                
                # Check constraints (daily, weekly)
                constraint_error = check_booking_constraints(slot, student)
                if constraint_error:
                    skipped.append({'date': slot.start_time.strftime('%A, %b %d %Y'), 'reason': constraint_error})
                    continue

                LiveClassBooking.objects.create(student=student, live_class=slot, status='confirmed')
                booked.append(slot.start_time.strftime('%A, %b %d %Y at %I:%M %p'))
                booked_count += 1
            
            return JsonResponse({
                'status': 'success',
                'booked': booked,
                'skipped': skipped,
                'message': f'Booked {len(booked)} session(s). {len(skipped)} slot(s) skipped.'
            })

        # ---- SINGLE BOOKING (private one-off or public class) ----
        if slots_to_book <= 0:
            return JsonResponse({'error': 'Cannot exceed the maximum purchased hours for this course.'}, status=400)

        constraint_error = check_booking_constraints(lc, student)
        if constraint_error:
            return JsonResponse({'error': constraint_error}, status=400)

        LiveClassBooking.objects.create(student=student, live_class=lc, status='confirmed')
        return JsonResponse({'status': 'success', 'message': 'Session booked successfully!'})
        
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
@login_required
def api_cancel_booking(request):
    if request.user.role != 'student':
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method == 'POST':
        data = json.loads(request.body)
        booking_id = data.get('booking_id')
        reason = data.get('reason', '')
        
        booking = get_object_or_404(LiveClassBooking, id=booking_id, student=request.user.student_profile)
        booking.status = 'cancelled'
        booking.cancellation_reason = reason
        booking.save()
            
        return JsonResponse({'status': 'success'})
        
    return JsonResponse({'error': 'Method not allowed'}, status=405)





@login_required
def parent_schedule_view(request):
    if request.user.role != 'parent':
        return redirect('core:home')
        
    children = request.user.parent_profile.children.all()
    bookings = LiveClassBooking.objects.filter(student__in=children, status='confirmed').select_related('live_class', 'live_class__course', 'student', 'student__user').order_by('live_class__start_time')
    
    from itertools import groupby
    from django.utils import timezone
    
    def get_group_id(b):
        return b.live_class.recurring_group_id
    
    bookings_list = list(bookings)
    bookings_list.sort(key=get_group_id)
    
    upcoming_packages = []
    ended_packages = []
    
    for group_id, group_bookings in groupby(bookings_list, key=get_group_id):
        group_bookings = list(group_bookings)
        if not group_bookings: continue
        
        def get_student_id(b):
            return b.student.id
        group_bookings.sort(key=get_student_id)
        
        for student_id, student_bookings in groupby(group_bookings, key=get_student_id):
            student_bookings = list(student_bookings)
            student_bookings.sort(key=lambda b: b.live_class.start_time)
            
            first_booking = student_bookings[0]
            last_booking = student_bookings[-1]
            
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            days_set = sorted(list(set([timezone.localtime(b.live_class.start_time).weekday() for b in student_bookings])))
            days_str = ", ".join([day_names[d] for d in days_set])
            
            pkg = {
                'group_id': group_id,
                'student': first_booking.student,
                'title': first_booking.live_class.title,
                'course': first_booking.live_class.course,
                'class_type': first_booking.live_class.class_type,
                'start_time': first_booking.live_class.start_time,
                'end_time': first_booking.live_class.end_time,
                'days_str': days_str,
                'total_classes': len(student_bookings),
                'bookings': student_bookings,
                'has_ended': last_booking.live_class.has_ended,
            }
            
            if pkg['has_ended']:
                ended_packages.append(pkg)
            else:
                upcoming_packages.append(pkg)
                
    upcoming_packages.sort(key=lambda p: p['start_time'])
    ended_packages.sort(key=lambda p: p['start_time'], reverse=True)
    
    return render(request, 'courses/parent_schedule.html', {
        'children': children,
        'upcoming_packages': upcoming_packages,
        'ended_packages': ended_packages,
    })

@login_required


@login_required
def api_get_bookable_slots_for_student(request, student_id):
    if request.user.role != 'parent':
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    from accounts.models import StudentProfile
    from django.shortcuts import get_object_or_404
    student = get_object_or_404(StudentProfile, id=student_id)
    if not request.user.parent_profile.children.filter(id=student.id).exists():
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    enrolled_courses = [enrollment.course for enrollment in student.enrollments.all()]
    from courses.models import LiveClass
    live_classes = LiveClass.objects.filter(course__in=enrolled_courses)
    
    events = []
    from django.utils import timezone
    now = timezone.now()
    
    for lc in live_classes:
        if not lc.start_time or not lc.end_time: continue
        if lc.is_ended or lc.end_time < now: continue
        
        booked_count = lc.bookings.filter(status='confirmed').count()
        if booked_count >= lc.max_capacity: continue
        if lc.bookings.filter(student=student, status='confirmed').exists(): continue
        
        events.append({
            'id': lc.id,
            'title': f"Available: {lc.course.title if lc.course else 'Session'} with {lc.course.teacher.user.get_full_name()}",
            'start': lc.start_time.isoformat(),
            'end': lc.end_time.isoformat(),
            'color': '#28a745'
        })
    return JsonResponse(events, safe=False)

from django.views.decorators.csrf import csrf_exempt
import json
from .ai_utils import translate_text_ai

@csrf_exempt
@login_required
def translate_live_caption(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            text = data.get('text', '')
            target_lang = data.get('target_lang', 'en')
            translated = translate_text_ai(text, target_lang)
            return JsonResponse({'status': 'success', 'translation': translated})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)


from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import login
from django.shortcuts import redirect

def app_login_redirect(request):
    token = request.GET.get('token')
    next_url = request.GET.get('next', '/')
    
    if token:
        try:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            if user:
                login(request, user)
        except (InvalidToken, TokenError):
            pass
            
    return redirect(next_url)

@login_required
def join_live_class_by_room(request, room_name):
    live_class = get_object_or_404(LiveClass, room_name=room_name)
    return join_live_class(request, live_class.id)

from django.views.decorators.clickjacking import xframe_options_exempt

@xframe_options_exempt
def custom_whiteboard(request, class_id):
    live_class = get_object_or_404(LiveClass, id=class_id)
    role = request.GET.get('role', 'student')
    username = request.GET.get('username', 'Anonymous')
    student_id = request.GET.get('student_id')
    
    if role == 'student' and student_id:
        try:
            from .models import StudentProfile, Attendance
            sp = StudentProfile.objects.get(user_id=student_id)
            att, created = Attendance.objects.get_or_create(student=sp, live_class=live_class, defaults={'status': 'present'})
            if not created:
                att.status = 'present'
                if att.exited_at: att.exited_at = None
                att.save()
        except Exception:
            pass

    return render(request, 'courses/whiteboard.html', {
        'live_class': live_class,
        'room_id': live_class.room_name,
        'role': role,
        'username': username
    })

