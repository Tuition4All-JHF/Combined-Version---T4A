from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.contrib import messages

def home(request):
    if request.user.is_authenticated:
        return redirect('core:dashboard')
    
    from courses.models import Category, Course
    from accounts.models import TeacherProfile
    
    # Fetch top 4 active courses (e.g. latest approved)
    trending_courses = Course.objects.filter(status='approved')[:4]
    
    # Fetch categories that have at least one approved course
    categories = Category.objects.filter(courses__status='approved').distinct()
    
    # Fetch active teachers
    teachers = TeacherProfile.objects.filter(is_approved=True)[:4]
    for teacher in teachers:
        if not teacher.subjects or teacher.subjects == 'None':
            cats = teacher.courses.filter(status='approved').values_list('category__name', flat=True).distinct()
            if cats:
                teacher.display_subjects = ", ".join(cats)
            else:
                teacher.display_subjects = "New Instructor"
        else:
            teacher.display_subjects = teacher.subjects
            
    context = {
        'trending_courses': trending_courses,
        'categories': categories,
        'teachers': teachers,
    }
    return render(request, 'core/home.html', context)

def public_teacher_profile(request, teacher_id):
    from accounts.models import TeacherProfile, TeacherReview
    from django.db.models import Avg
    
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    reviews = TeacherReview.objects.filter(teacher=teacher).order_by('-created_at')
    avg_rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0
    
    if request.method == 'POST' and request.user.is_authenticated and request.user.role == 'student':
        rating = request.POST.get('rating')
        feedback = request.POST.get('feedback')
        if rating and feedback:
            # Check if student is enrolled in any of the teacher's courses
            from courses.models import Enrollment
            is_enrolled = Enrollment.objects.filter(
                student=request.user.student_profile,
                course__teacher=teacher
            ).exists()
            
            if is_enrolled:
                # Create or update review
                TeacherReview.objects.update_or_create(
                    teacher=teacher,
                    student=request.user.student_profile,
                    defaults={'rating': int(rating), 'feedback': feedback}
                )
                messages.success(request, 'Review submitted successfully!')
            else:
                messages.error(request, 'You must be enrolled in one of this teacher\'s courses to leave a review.')
        return redirect('core:public_teacher_profile', teacher_id=teacher.id)
        
    # Check if current user can review
    can_review = False
    if request.user.is_authenticated and request.user.role == 'student':
        from courses.models import Enrollment
        can_review = Enrollment.objects.filter(
            student=request.user.student_profile,
            course__teacher=teacher
        ).exists()
        
    context = {
        'teacher': teacher,
        'reviews': reviews,
        'avg_rating': round(avg_rating, 1),
        'can_review': can_review,
    }
    return render(request, 'core/public_teacher_profile.html', context)

@login_required
def mark_notification_read(request, notif_id):
    if request.method == 'POST':
        from .models import Notification
        from django.shortcuts import get_object_or_404
        from django.http import JsonResponse
        notif = get_object_or_404(Notification, id=notif_id, user=request.user)
        notif.is_read = True
        notif.save()
        return JsonResponse({'status': 'success'})
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@login_required
def parent_dashboard(request):
    if request.user.role != 'parent':
        return redirect('core:home')
    
    parent_profile = request.user.parent_profile
    
    if request.method == 'POST':
        student_id = request.POST.get('student_id')
        from accounts.models import StudentProfile, ParentStudentLinkRequest
        try:
            student = StudentProfile.objects.get(student_id=student_id)
            if parent_profile.children.filter(id=student.id).exists():
                messages.error(request, 'Student is already linked to your account.')
            else:
                link_req, created = ParentStudentLinkRequest.objects.get_or_create(
                    parent=parent_profile,
                    student=student,
                    defaults={'status': 'pending'}
                )
                if not created and link_req.status == 'pending':
                    messages.info(request, 'You have already requested to link this student. Waiting for their approval.')
                elif not created and link_req.status == 'rejected':
                    link_req.status = 'pending'
                    link_req.save()
                    messages.success(request, f'Link request re-sent to {student.user.get_full_name() or student.user.username}.')
                    from core.models import Notification
                    Notification.objects.create(
                        user=student.user,
                        message=f"{parent_profile.user.get_full_name() or parent_profile.user.username} requested to link as your parent/guardian.",
                        link_url="/core/dashboard/#parent-requests"
                    )
                else:
                    messages.success(request, f'Link request sent to {student.user.get_full_name() or student.user.username}. Waiting for their approval.')
                    from core.models import Notification
                    Notification.objects.create(
                        user=student.user,
                        message=f"{parent_profile.user.get_full_name() or parent_profile.user.username} requested to link as your parent/guardian.",
                        link_url="/core/dashboard/#parent-requests"
                    )
        except StudentProfile.DoesNotExist:
            messages.error(request, 'Student ID not found. Please check and try again.')
            
    from accounts.models import StudentProfile, ParentStudentLinkRequest
    children_users = parent_profile.children.all()
    children = StudentProfile.objects.filter(user__in=children_users)
    link_requests = ParentStudentLinkRequest.objects.filter(parent=parent_profile).exclude(status='approved')
    
    from django.db.models import Q
    for child in children:
        submissions = child.submissions.all()
        child.assignment_subs = {sub.assignment_id: sub for sub in submissions if sub.assignment_id}
        child.project_subs = {sub.project_id: sub for sub in submissions if sub.project_id}
        _sync_student_attendances(child)
        from core.utils import get_overall_attendance_percentage
        child.overall_attendance_percentage = get_overall_attendance_percentage(child)
        
        from django.utils import timezone
        now = timezone.now()
        
        child.filtered_recorded_classes = {}
        child.filtered_transcripts = {}
        for enrollment in child.enrollments.all():
            rcs = enrollment.course.recorded_classes.filter(
                Q(assigned_to_all=True) | Q(assigned_students=child),
                Q(expires_at__isnull=True) | Q(expires_at__gt=now),
                is_visible_to_students=True
            ).distinct().order_by('-uploaded_at')
            child.filtered_recorded_classes[enrollment.course.id] = rcs
            
            ts = enrollment.course.live_classes.filter(
                transcript_visible=True,
                transcript__isnull=False
            ).filter(
                Q(transcript_expires_at__isnull=True) | Q(transcript_expires_at__gt=now)
            ).distinct().order_by('-start_time')
            child.filtered_transcripts[enrollment.course.id] = ts
        
    return render(request, 'core/dashboards/parent_dashboard.html', {'children': children, 'link_requests': link_requests})

def _sync_student_attendances(student_profile):
    from courses.models import LiveClass, Attendance
    from django.utils import timezone
    
    enrollments = student_profile.enrollments.all()
    
    for enrollment in enrollments:
        live_classes = LiveClass.objects.filter(course=enrollment.course)
        
        for lc in live_classes:
            if lc.has_ended:
                # 1. Skip classes that started before the student enrolled
                if lc.start_time and lc.start_time < enrollment.date_enrolled:
                    continue
                
                # 2. For private classes, only mark absent if the student booked it
                if lc.class_type == 'private':
                    if not lc.bookings.filter(student=student_profile).exists():
                        continue
                        
                Attendance.objects.get_or_create(
                    student=student_profile,
                    live_class=lc,
                    defaults={
                        'status': 'absent',
                        'joined_at': lc.start_time or timezone.now()
                    }
                )

@login_required
def approve_parent_link(request, request_id):
    if request.user.role != 'student':
        return redirect('core:home')
    
    from accounts.models import ParentStudentLinkRequest
    from django.shortcuts import get_object_or_404
    link_req = get_object_or_404(ParentStudentLinkRequest, id=request_id, student=request.user.student_profile)
    
    if link_req.status == 'pending':
        link_req.status = 'approved'
        link_req.save()
        link_req.parent.children.add(request.user)
        
        from core.models import Notification
        Notification.objects.create(
            user=link_req.parent.user,
            message=f"{request.user.get_full_name() or request.user.username} approved your link request.",
            link_url="/core/dashboard/"
        )
        messages.success(request, 'Parent link request approved successfully.')
    return redirect('core:dashboard')

@login_required
def reject_parent_link(request, request_id):
    if request.user.role != 'student':
        return redirect('core:home')
    
    from accounts.models import ParentStudentLinkRequest
    from django.shortcuts import get_object_or_404
    link_req = get_object_or_404(ParentStudentLinkRequest, id=request_id, student=request.user.student_profile)
    
    if link_req.status == 'pending':
        link_req.status = 'rejected'
        link_req.save()
        
        from core.models import Notification
        Notification.objects.create(
            user=link_req.parent.user,
            message=f"{request.user.get_full_name() or request.user.username} rejected your link request.",
            link_url="/core/dashboard/"
        )
        messages.success(request, 'Parent link request rejected.')
    return redirect('core:dashboard')

@login_required
def parent_analysis_redirect(request):
    if request.user.role != 'parent':
        return redirect('core:home')
    
    first_child_user = request.user.parent_profile.children.first()
    if first_child_user:
        return redirect('core:parent_student_analysis', student_id=first_child_user.student_profile.id)
    else:
        messages.warning(request, 'You need to link a student account first to view analytics.')
        return redirect('core:dashboard')

@login_required
def parent_student_analysis(request, student_id):
    if request.user.role != 'parent':
        return redirect('core:home')
        
    parent_profile = request.user.parent_profile
    from django.shortcuts import get_object_or_404
    from accounts.models import StudentProfile
    
    # Ensure this parent is actually linked to this student
    student = get_object_or_404(StudentProfile, id=student_id)
    if not parent_profile.children.filter(id=student.user.id).exists():
        return redirect('core:dashboard')
    
    _sync_student_attendances(student)
    
    from core.utils import get_attendance_analytics
    from courses.models import Attendance
    
    subject_id = request.GET.get('subject_id')
    
    base_attendances = Attendance.objects.filter(student=student).select_related('live_class')
    if subject_id:
        base_attendances = base_attendances.filter(live_class__course_id=subject_id)
        
    analytics_context = get_attendance_analytics(request, base_attendances)
    
    # Get all linked children for the switcher
    all_children = [child.student_profile for child in parent_profile.children.all() if hasattr(child, 'student_profile')]
    
    enrolled_courses = [enrollment.course for enrollment in student.enrollments.select_related('course').all()]
    
    # --- Attendance Analytics ---
    from courses.models import Attendance, StudentSubmission, LiveClassBooking
    
    # 1. Attendances they actually joined
    attendances = Attendance.objects.filter(student=student).exclude(status='absent').select_related('live_class')
    
    # 2. Classes they booked
    booked_classes = LiveClassBooking.objects.filter(student=student, status='confirmed').select_related('live_class')
    
    # --- Date & Subject Filtering ---
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    if subject_id:
        attendances = attendances.filter(live_class__course_id=subject_id)
        booked_classes = booked_classes.filter(live_class__course_id=subject_id)
    
    if start_date:
        attendances = attendances.filter(live_class__start_time__date__gte=start_date)
        booked_classes = booked_classes.filter(live_class__start_time__date__gte=start_date)
    if end_date:
        attendances = attendances.filter(live_class__start_time__date__lte=end_date)
        booked_classes = booked_classes.filter(live_class__start_time__date__lte=end_date)

    attended_class_ids = [att.live_class.id for att in attendances]
    
    total_classes = booked_classes.count()
    
    # Apply date filters to base_attendances for missed_sessions log
    if start_date:
        base_attendances = base_attendances.filter(live_class__start_time__date__gte=start_date)
    if end_date:
        base_attendances = base_attendances.filter(live_class__start_time__date__lte=end_date)
    
    missed_sessions = []
    from django.utils import timezone
    now = timezone.now()
    
    for att in base_attendances:
        lc = att.live_class
        
        # Only evaluate classes that have finished
        class_is_over = lc.is_ended or (lc.end_time and lc.end_time < now)
        if not class_is_over:
            continue
            
        expected_duration = 60
        if lc.start_time and lc.end_time:
            expected_duration = (lc.end_time - lc.start_time).total_seconds() / 60
            
        if att.status == 'absent':
            missed_sessions.append({
                'class': lc,
                'status': 'Absent',
                'lost_mins': int(expected_duration)
            })
        elif att.status in ['present', 'late'] and att.duration:
            attended_mins = att.duration.total_seconds() / 60
            class_time_lost = expected_duration - attended_mins
            if class_time_lost > 0:
                missed_sessions.append({
                    'class': lc,
                    'status': 'Partial/Late',
                    'lost_mins': int(class_time_lost)
                })
                
    # Sort missed sessions newest first
    missed_sessions.sort(key=lambda x: x['class'].start_time, reverse=True)
    
    # Paginate missed sessions (7 per page)
    from django.core.paginator import Paginator
    page_number = request.GET.get('page', 1)
    paginator = Paginator(missed_sessions, 7)
    missed_sessions_page = paginator.get_page(page_number)
    
    # Use the accurate values from analytics_context
    time_lost_exact = analytics_context.get('att_time_lost_exact', '0h 0m 0s')
    

    # --- Academic Analytics ---
    from courses.models import Assignment, Project
    from django.db.models import Q
    
    courses_ids = student.enrollments.values_list('course', flat=True)
    if subject_id:
        courses_ids = [int(subject_id)]
    
    total_assignments = Assignment.objects.filter(
        Q(course__in=courses_ids) & (Q(assigned_to_all=True) | Q(assigned_students=student))
    ).distinct()
    total_projects = Project.objects.filter(
        Q(course__in=courses_ids) & (Q(assigned_to_all=True) | Q(assigned_students=student))
    ).distinct()
    
    submissions = StudentSubmission.objects.filter(student=student)
    if subject_id:
        submissions = submissions.filter(Q(assignment__course_id=subject_id) | Q(project__course_id=subject_id))
    
    if start_date:
        submissions = submissions.filter(submitted_at__date__gte=start_date)
        total_assignments = total_assignments.filter(due_date__date__gte=start_date)
        total_projects = total_projects.filter(due_date__date__gte=start_date)
    if end_date:
        submissions = submissions.filter(submitted_at__date__lte=end_date)
        total_assignments = total_assignments.filter(due_date__date__lte=end_date)
        total_projects = total_projects.filter(due_date__date__lte=end_date)
        
    assignments_accepted_qs = submissions.filter(assignment__isnull=False, status='accepted')
    assignments_rejected_qs = submissions.filter(assignment__isnull=False, status='rejected')
    assignments_resubmit_qs = submissions.filter(assignment__isnull=False, status='resubmit')
    assignments_under_review_qs = submissions.filter(assignment__isnull=False, status='submitted')
    
    assignments_pending_qs = total_assignments.exclude(submissions__student=student)
    
    projects_accepted_qs = submissions.filter(project__isnull=False, status='accepted')
    projects_rejected_qs = submissions.filter(project__isnull=False, status='rejected')
    projects_pending_qs = total_projects.exclude(submissions__student=student)
    
    context = {
        'current_student': student,
        'all_children': all_children,
        'total_classes': total_classes,
        'time_lost_exact': time_lost_exact,
        'missed_sessions': missed_sessions_page,
        'assignments_accepted': assignments_accepted_qs.count(),
        'assignments_rejected': assignments_rejected_qs.count(),
        'assignments_resubmit': assignments_resubmit_qs.count(),
        'assignments_under_review': assignments_under_review_qs.count(),
        'assignments_pending': assignments_pending_qs.count(),
        'projects_accepted': projects_accepted_qs.count(),
        'projects_rejected': projects_rejected_qs.count(),
        'projects_pending': projects_pending_qs.count(),
        'assignments_accepted_qs': assignments_accepted_qs,
        'assignments_rejected_qs': assignments_rejected_qs,
        'assignments_resubmit_qs': assignments_resubmit_qs,
        'assignments_under_review_qs': assignments_under_review_qs,
        'assignments_pending_qs': assignments_pending_qs,
        'projects_accepted_qs': projects_accepted_qs,
        'projects_rejected_qs': projects_rejected_qs,
        'projects_pending_qs': projects_pending_qs,
        'start_date': start_date,
        'end_date': end_date,
        'subject_id': int(subject_id) if subject_id else '',
        'enrolled_courses': enrolled_courses,
        'total_assignments': total_assignments.count(),
        'total_projects': total_projects.count(),
        **analytics_context
    }
    return render(request, 'core/dashboards/parent_student_analysis.html', context)


@login_required
def dashboard(request):
    role = request.user.role
    if role == 'admin':
        from accounts.models import TeacherProfile, StudentProfile, ParentProfile
        from courses.models import Course, Category
        teachers = TeacherProfile.objects.all().order_by('-user__date_joined')
        students = StudentProfile.objects.all().order_by('-user__date_joined')
        parents = ParentProfile.objects.all().order_by('-user__date_joined')
        courses = Course.objects.all().order_by('-created_at')
        categories = Category.objects.all()
        return render(request, 'core/dashboards/admin_dashboard.html', {
            'teachers': teachers,
            'students': students,
            'parents': parents,
            'courses': courses,
            'categories': categories,
            'pending_teachers_count': teachers.filter(is_approved=False).count(),
            'pending_courses_count': courses.filter(status='pending').count(),
            'pending_teachers_list': teachers.filter(is_approved=False)[:5],
            'pending_courses_list': courses.filter(status='pending')[:5],
        })
    elif role == 'teacher':
        context = {}
        if hasattr(request.user, 'teacher_profile'):
            courses = request.user.teacher_profile.courses.all()
            total_students = sum(c.enrollments.count() for c in courses)
            total_earnings = sum(c.enrollments.count() * c.teacher_price for c in courses)
            all_enrollments = []
            unique_students_dict = {}
            for c in courses:
                for enrollment in c.enrollments.all():
                    all_enrollments.append(enrollment)
                    sid = enrollment.student.id
                    if sid not in unique_students_dict:
                        unique_students_dict[sid] = {
                            'student': enrollment.student,
                            'courses': []
                        }
                    unique_students_dict[sid]['courses'].append(c)
            unique_students = list(unique_students_dict.values())
            
            from courses.models import LiveClass, StudentSubmission
            all_live_classes = list(LiveClass.objects.filter(course__in=courses))
            
            all_upcoming_live_classes = sorted([lc for lc in all_live_classes if not lc.has_ended], key=lambda x: (x.start_time is None, x.start_time))
            all_ended_live_classes = sorted([lc for lc in all_live_classes if lc.has_ended], key=lambda x: ((x.actual_end_time or x.start_time) is None, x.actual_end_time or x.start_time), reverse=True)
            live_classes = all_live_classes
            
            from django.utils import timezone
            upcoming_live_classes = LiveClass.objects.filter(course__in=courses, start_time__gte=timezone.now()).order_by('start_time')[:5]
            
            from django.db.models import Q
            recent_submissions = StudentSubmission.objects.filter(
                Q(assignment__course__in=courses) | Q(project__course__in=courses)
            ).order_by('-submitted_at')[:5]
            
            context.update({
                'total_students': total_students,
                'total_earnings': total_earnings,
                'all_enrollments': all_enrollments,
                'unique_students': unique_students,
                'live_classes': live_classes,
                'all_upcoming_live_classes': all_upcoming_live_classes,
                'all_ended_live_classes': all_ended_live_classes,
                'upcoming_live_classes': upcoming_live_classes,
                'recent_submissions': recent_submissions,
            })
        return render(request, 'core/dashboards/teacher_dashboard.html', context)
    elif role == 'student':
        from courses.models import LiveClass, Assignment, Project, StudentSubmission, RecordedClass, CourseNote
        # Fetch enrolled courses
        student_profile = request.user.student_profile
        _sync_student_attendances(student_profile)
        
        enrolled_courses = [enrollment.course for enrollment in student_profile.enrollments.all()]
        
        # Get live classes for enrolled courses
        all_live_classes = list(LiveClass.objects.filter(course__in=enrolled_courses))
        for lc in all_live_classes:
            lc.booked_count = lc.bookings.filter(status='confirmed').count()
            lc.has_booked = lc.bookings.filter(student=student_profile, status='confirmed').exists()
            
        upcoming_live_classes = sorted([lc for lc in all_live_classes if not lc.has_ended], key=lambda x: (x.start_time is None, x.start_time))
        ended_live_classes = sorted([lc for lc in all_live_classes if lc.has_ended], key=lambda x: ((x.actual_end_time or x.start_time) is None, x.actual_end_time or x.start_time), reverse=True)
        live_classes = all_live_classes # Keep for any other references
        
        # Get student's booked sessions
        from courses.models import LiveClassBooking
        from django.utils import timezone
        
        all_booked_sessions = LiveClassBooking.objects.filter(
            student=student_profile, 
            status='confirmed'
        ).select_related('live_class', 'live_class__course')
        
        packages = {}
        for b in all_booked_sessions:
            lc = b.live_class
            group_id = lc.recurring_group_id or f"single_{lc.id}"
            if group_id not in packages:
                packages[group_id] = {
                    'group_id': group_id,
                    'course': lc.course,
                    'title': lc.title,
                    'class_type': lc.class_type,
                    'start_time': lc.start_time,
                    'end_time': lc.end_time,
                    'bookings': [],
                    'has_ended': True,
                    'days_str': "",
                }
            packages[group_id]['bookings'].append(b)
            if not lc.has_ended:
                packages[group_id]['has_ended'] = False

        packaged_sessions = list(packages.values())
        for p in packaged_sessions:
            p['bookings'] = sorted(p['bookings'], key=lambda x: (x.live_class.start_time is None, x.live_class.start_time))
            # compute days string (e.g. Mon, Wed, Fri)
            days = []
            for b in p['bookings']:
                if b.live_class.start_time:
                    day_name = b.live_class.start_time.strftime('%a')
                    if day_name not in days:
                        days.append(day_name)
            
            day_order = {"Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 7}
            days.sort(key=lambda d: day_order.get(d, 8))
            p['days_str'] = ", ".join(days)
            p['total_classes'] = len(p['bookings'])
            p['first_class_start'] = p['bookings'][0].live_class.start_time
            
        packaged_sessions.sort(key=lambda x: (x['first_class_start'] is None, x['first_class_start']))
        
        upcoming_booked_packages = [p for p in packaged_sessions if not p['has_ended']]
        ended_booked_packages = [p for p in packaged_sessions if p['has_ended']]
        
        upcoming_booked_sessions_full = upcoming_booked_packages  # Replace variable for template compatibility
        ended_booked_sessions_full = ended_booked_packages
        
        # Keep this for the overview widget (only future ones)
        booked_sessions_queryset = LiveClassBooking.objects.filter(
            student=student_profile, 
            status='confirmed',
            live_class__start_time__gte=timezone.now() - timezone.timedelta(hours=2)
        ).select_related('live_class').order_by('live_class__start_time')
        
        from django.db.models import Q
        
        # Get assignments and projects for enrolled courses
        assignments = Assignment.objects.filter(
            Q(course__in=enrolled_courses) & (Q(assigned_to_all=True) | Q(assigned_students=student_profile))
        ).distinct()
        projects = Project.objects.filter(
            Q(course__in=enrolled_courses) & (Q(assigned_to_all=True) | Q(assigned_students=student_profile))
        ).distinct()
        
        # Get recorded classes and notes
        from django.utils import timezone
        now = timezone.now()
        recorded_classes = RecordedClass.objects.filter(
            Q(course__in=enrolled_courses) & (Q(assigned_to_all=True) | Q(assigned_students=student_profile)),
            Q(expires_at__isnull=True) | Q(expires_at__gt=now),
            is_visible_to_students=True
        ).distinct().order_by('-uploaded_at')
        
        transcripts = LiveClass.objects.filter(
            course__in=enrolled_courses,
            transcript_visible=True,
            transcript__isnull=False
        ).filter(
            Q(transcript_expires_at__isnull=True) | Q(transcript_expires_at__gt=now)
        ).distinct().order_by('-start_time')
        
        notes = CourseNote.objects.filter(
            Q(course__in=enrolled_courses) & (Q(assigned_to_all=True) | Q(assigned_students=student_profile))
        ).distinct().order_by('-uploaded_at')
        
        # Provide dictionary of submissions for easy lookup in template
        # key: 'assignment_id' or 'project_id', value: submission object
        submissions = StudentSubmission.objects.filter(student=student_profile)
        assignment_subs = {sub.assignment_id: sub for sub in submissions if sub.assignment_id}
        project_subs = {sub.project_id: sub for sub in submissions if sub.project_id}

        pending_assignments_count = sum(1 for a in assignments if not assignment_subs.get(a.id) or assignment_subs.get(a.id).status in ['resubmit', 'rejected'])
        pending_projects_count = sum(1 for p in projects if not project_subs.get(p.id) or project_subs.get(p.id).status in ['resubmit', 'rejected'])

        from accounts.models import ParentStudentLinkRequest
        parent_link_requests = ParentStudentLinkRequest.objects.filter(student=student_profile, status='pending')

        from django.utils import timezone
        upcoming_booked_sessions = booked_sessions_queryset.filter(live_class__start_time__gte=timezone.now()).order_by('live_class__start_time')[:5]
        
        pending_tasks = []
        for a in assignments:
            sub = assignment_subs.get(a.id)
            if not sub or sub.status in ['resubmit', 'rejected']:
                pending_tasks.append({'type': 'Assignment', 'item': a, 'due': a.due_date, 'status': sub.get_status_display() if sub else 'Not Submitted'})
        for p in projects:
            sub = project_subs.get(p.id)
            if not sub or sub.status in ['resubmit', 'rejected']:
                pending_tasks.append({'type': 'Project', 'item': p, 'due': p.due_date, 'status': sub.get_status_display() if sub else 'Not Submitted'})
        
        # Sort pending tasks by due date
        pending_tasks.sort(key=lambda x: x['due'] or timezone.now() + timezone.timedelta(days=365))
        pending_tasks = pending_tasks[:5]

        # --- Attendance Log Analytics ---
        from core.utils import get_attendance_analytics
        from courses.models import Attendance
        
        base_attendances = Attendance.objects.filter(student=student_profile).select_related('live_class', 'live_class__course')
        analytics_context = get_attendance_analytics(request, base_attendances)

        import json
        course_metadata = {}
        for c in enrolled_courses:
            hourly_rate = float(c.price / c.total_duration_hours) if c.total_duration_hours and c.price else 0
            course_metadata[c.id] = {
                'total_duration_hours': float(c.total_duration_hours) if c.total_duration_hours else 0,
                'price': float(c.price) if c.price else 0,
                'calculated_hourly_rate': hourly_rate
            }

        context = {
            'enrolled_courses': enrolled_courses,
            'course_metadata_json': json.dumps(course_metadata),
            **analytics_context,
            'live_classes': live_classes,
            'upcoming_live_classes': upcoming_live_classes,
            'ended_live_classes': ended_live_classes,
            'recorded_classes': recorded_classes,
            'notes': notes,
            'assignments': assignments,
            'projects': projects,
            'assignment_subs': assignment_subs,
            'project_subs': project_subs,
            'pending_assignments_count': pending_assignments_count,
            'pending_projects_count': pending_projects_count,
            'my_booked_sessions': booked_sessions_queryset,
            'upcoming_booked_sessions_full': upcoming_booked_sessions_full,
            'ended_booked_sessions_full': ended_booked_sessions_full,
            'upcoming_booked_sessions': upcoming_booked_sessions,
            'pending_tasks': pending_tasks,
            'parent_link_requests': parent_link_requests,
        }
        return render(request, 'core/dashboards/student_dashboard.html', context)
    elif role == 'parent':
        return parent_dashboard(request)
    return redirect('core:home')

def teachers_list(request):
    from accounts.models import TeacherProfile
    from courses.models import Category, Course
    from django.db.models import Q, Min, F, ExpressionWrapper, FloatField, Case, When
    
    query = request.GET.get('q', '')
    category_id = request.GET.get('category', '')
    max_price = request.GET.get('max_price', '2000') # Default slider max
    
    categories = Category.objects.all()
    
    is_filtering = bool(query) or bool(category_id) or max_price != '2000'
    
    if not is_filtering:
        mode = 'teachers'
        teachers = TeacherProfile.objects.filter(is_approved=True).prefetch_related('courses')
        
        # Calculate hourly rate = explicitly set hourly_fee if > 0, else price / total_duration_hours
        teachers = teachers.annotate(
            computed_hourly_rate=Min(
                Case(
                    When(courses__total_duration_hours__gt=0, then=ExpressionWrapper(
                        F('courses__price') / F('courses__total_duration_hours'),
                        output_field=FloatField()
                    )),
                    default=F('courses__hourly_fee'),
                    output_field=FloatField()
                ),
                filter=Q(courses__status='approved', courses__is_frozen=False)
            )
        )
        
        items = teachers
    else:
        mode = 'courses'
        courses = Course.objects.filter(status='approved', is_frozen=False, teacher__is_approved=True).select_related('teacher', 'teacher__user')
        
        if query:
            courses = courses.filter(
                Q(title__icontains=query) |
                Q(teacher__user__first_name__icontains=query) |
                Q(teacher__user__last_name__icontains=query) |
                Q(teacher__user__username__icontains=query) |
                Q(teacher__subjects__icontains=query) |
                Q(description__icontains=query)
            )
            
        if category_id:
            courses = courses.filter(category_id=category_id)
            
        courses = courses.annotate(
            computed_hourly_rate=Case(
                When(total_duration_hours__gt=0, then=ExpressionWrapper(
                    F('price') / F('total_duration_hours'),
                    output_field=FloatField()
                )),
                default=F('hourly_fee'),
                output_field=FloatField()
            )
        )
        
        if max_price:
            try:
                max_price_val = float(max_price)
                courses = courses.filter(computed_hourly_rate__lte=max_price_val)
            except ValueError:
                pass
                
        items = courses.distinct()
        
    booked_teacher_ids = set()
    if request.user.is_authenticated:
        from courses.models import LiveClassBooking
        if request.user.role == 'student':
            booked_teacher_ids = set(
                LiveClassBooking.objects.filter(student=request.user.student_profile, status='confirmed')
                .values_list('live_class__course__teacher_id', flat=True)
            )
        elif request.user.role == 'parent':
            children = request.user.parent_profile.children.all()
            booked_teacher_ids = set(
                LiveClassBooking.objects.filter(student__in=children, status='confirmed')
                .values_list('live_class__course__teacher_id', flat=True)
            )

    return render(request, 'core/teachers.html', {
        'booked_teacher_ids': booked_teacher_ids,
        'mode': mode,
        'items': items,
        'search_query': query,
        'selected_category': category_id,
        'max_price': max_price,
        'categories': categories
    })

def about(request):
    return render(request, 'core/about.html')

def contact(request):
    return render(request, 'core/contact.html')

def how_it_works(request):
    return render(request, 'core/how_it_works.html')

def become_tutor(request):
    return render(request, 'core/become_tutor.html')

@login_required
def edit_teacher_profile(request):
    if request.user.role != 'teacher':
        return redirect('core:home')
        
    from accounts.models import TeacherProfile, TeacherCertificate
    teacher = request.user.teacher_profile
    
    if request.method == 'POST':
        # Update text fields
        teacher.bio = request.POST.get('bio', teacher.bio)
        teacher.qualification = request.POST.get('qualification', teacher.qualification)
        teacher.experience = request.POST.get('experience', teacher.experience)
        teacher.subjects = request.POST.get('subjects', teacher.subjects)        
        # Check if a new photo was uploaded
        if 'photo' in request.FILES:
            teacher.photo = request.FILES['photo']
            request.user.photo = request.FILES['photo']
            request.user.save(update_fields=['photo'])
            
        if 'profile_video' in request.FILES:
            teacher.profile_video = request.FILES['profile_video']
            teacher.profile_video_approved = False
            
        teacher.save()
        
        # Handle new certificates (if uploaded)
        # Using the plus button we might have multiple files named 'certificates'
        if 'certificates' in request.FILES:
            files = request.FILES.getlist('certificates')
            for f in files:
                TeacherCertificate.objects.create(
                    teacher=teacher,
                    title=f.name,
                    file=f
                )
                
        messages.success(request, 'Profile updated successfully! Certificates pending admin approval.')
        return redirect('core:dashboard')
        
    return redirect('core:dashboard')

@login_required
def approve_teacher(request, teacher_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherProfile
    from courses.models import Course
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    teacher.is_approved = True
    teacher.save()
    
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
@require_POST
def reject_teacher(request, teacher_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherProfile
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    teacher.is_approved = False
    teacher.save()
    
    # Force TutorProfile verification status to REJECTED specifically
    from tutorsapp.models import TutorProfile
    try:
        tutor = TutorProfile.objects.get(user=teacher.user)
        tutor.verification_status = TutorProfile.VerificationStatus.REJECTED
        tutor.save(update_fields=['verification_status'])
    except TutorProfile.DoesNotExist:
        pass
        
    messages.success(request, f"Teacher profile for {teacher.user.username} rejected.")
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))


@login_required
def approve_teacher_video(request, teacher_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherProfile
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    teacher.profile_video_approved = True
    teacher.save()
    messages.success(request, 'Profile video approved successfully.')
    return redirect('core:admin_teacher_profile', teacher_id=teacher.id)

@login_required
def approve_teacher_certificate(request, cert_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherCertificate
    cert = get_object_or_404(TeacherCertificate, id=cert_id)
    cert.is_approved = True
    cert.save()
    messages.success(request, f'Certificate "{cert.title}" approved successfully.')
    return redirect('core:admin_teacher_profile', teacher_id=cert.teacher.id)

@login_required
def reject_teacher_certificate(request, cert_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherCertificate
    cert = get_object_or_404(TeacherCertificate, id=cert_id)
    teacher_id = cert.teacher.id
    cert.delete()
    messages.success(request, 'Certificate rejected and removed successfully.')
    return redirect('core:admin_teacher_profile', teacher_id=teacher_id)

@login_required
def admin_create_course(request):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherProfile
    from courses.models import Course, Category
    from django import forms
    
    class AdminCourseForm(forms.ModelForm):
        class Meta:
            model = Course
            fields = ['title', 'description', 'price', 'teacher_price', 'features', 'teacher', 'category', 'thumbnail']
            
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.fields['teacher'].queryset = TeacherProfile.objects.filter(is_approved=True)
            self.fields['price'].label = "Final Price (Teacher Expected + Admin Commission)"

    if request.method == 'POST':
        form = AdminCourseForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return redirect('core:dashboard')
    else:
        form = AdminCourseForm()
    
    return render(request, 'core/admin_create_course.html', {'form': form, 'action': 'Create'})

@login_required
def admin_edit_course(request, course_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import Course
    course = get_object_or_404(Course, id=course_id)
    
    from accounts.models import TeacherProfile
    from django import forms
    class AdminCourseForm(forms.ModelForm):
        class Meta:
            model = Course
            fields = ['title', 'description', 'price', 'teacher_price', 'features', 'teacher', 'category', 'thumbnail']
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.fields['teacher'].queryset = TeacherProfile.objects.filter(is_approved=True)

    if request.method == 'POST':
        form = AdminCourseForm(request.POST, request.FILES, instance=course)
        if form.is_valid():
            form.save()
            return redirect('core:dashboard')
    else:
        form = AdminCourseForm(instance=course)
    
    return render(request, 'core/admin_create_course.html', {'form': form, 'action': 'Edit'})

@login_required
def admin_delete_course(request, course_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import Course
    course = get_object_or_404(Course, id=course_id)
    course.delete()
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_approve_course(request, course_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import Course
    course = get_object_or_404(Course, id=course_id)
    if request.method == 'POST':
        final_price = request.POST.get('final_price')
        admin_hourly_fee = request.POST.get('admin_hourly_fee')
        teacher_price = request.POST.get('teacher_price')
        admin_comment = request.POST.get('admin_comment', '')
        
        if final_price:
            course.price = final_price
        if admin_hourly_fee:
            course.admin_hourly_fee = admin_hourly_fee
        if teacher_price:
            course.teacher_price = teacher_price
            
        course.admin_comment = admin_comment
        course.is_approved = True
        course.status = 'approved'
        course.save()
        messages.success(request, f'Course "{course.title}" approved and is now live with price ₹ {course.price}!')
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_approve_all_courses(request, teacher_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherProfile
    from courses.models import Course
    
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    pending_courses = Course.objects.filter(teacher=teacher, status__in=['pending', 'rejected'])
    
    if request.method == 'POST':
        admin_comment = request.POST.get('admin_comment', '')
        # Global markup percentage or flat fee if we want, but existing form takes direct final_price.
        # Since each course has different hours, we'll just apply the requested hourly_fee.
        # And maybe a global platform fee hourly markup (default 0).
        try:
            platform_hourly_markup = float(request.POST.get('platform_hourly_markup', 0))
        except ValueError:
            platform_hourly_markup = 0.0

        count = 0
        for course in pending_courses:
            course.admin_hourly_fee = course.hourly_fee
            course.teacher_price = float(course.hourly_fee) * float(course.total_duration_hours)
            
            # Final price includes platform markup per hour
            course.price = course.teacher_price + (platform_hourly_markup * float(course.total_duration_hours))
            
            course.admin_comment = admin_comment
            course.is_approved = True
            course.status = 'approved'
            course.save()
            count += 1
            
        messages.success(request, f'Successfully approved {count} pending courses for {teacher.user.get_full_name() or teacher.user.username}!')
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_reject_course(request, course_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import Course
    course = get_object_or_404(Course, id=course_id)
    if request.method == 'POST':
        admin_comment = request.POST.get('admin_comment', '')
        course.admin_comment = admin_comment
        course.is_approved = False
        course.status = 'rejected'
        course.save()
        messages.success(request, f'Course "{course.title}" has been rejected.')
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_toggle_freeze_course(request, course_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import Course
    course = get_object_or_404(Course, id=course_id)
    if request.method == 'POST':
        course.is_frozen = not course.is_frozen
        course.save()
        status = "frozen" if course.is_frozen else "unfrozen"
        messages.success(request, f'Course "{course.title}" has been {status}.')
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_delete_user(request, user_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from django.contrib.auth import get_user_model
    User = get_user_model()
    target_user = get_object_or_404(User, id=user_id)
    # Don't delete self or other superusers
    if target_user.is_superuser or target_user == request.user:
        messages.error(request, "Cannot delete this admin user.")
    else:
        target_user.delete()
        messages.success(request, "User deleted successfully.")
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
@require_POST
def admin_toggle_user_status(request, user_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    from django.contrib.auth import get_user_model
    User = get_user_model()
    target_user = get_object_or_404(User, id=user_id)
    if target_user.is_superuser or target_user == request.user:
        messages.error(request, "Cannot freeze/unfreeze this admin user.")
    else:
        target_user.is_active = not target_user.is_active
        target_user.is_frozen = not target_user.is_active
        target_user.save()
        status_msg = "unfrozen (active)" if target_user.is_active else "frozen (inactive)"
        messages.success(request, f"User has been successfully {status_msg}.")
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_manage_category(request):
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import Category
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'add':
            name = request.POST.get('name')
            if name:
                Category.objects.get_or_create(name=name)
                messages.success(request, f"Category '{name}' created.")
        elif action == 'delete':
            cat_id = request.POST.get('category_id')
            Category.objects.filter(id=cat_id).delete()
            messages.success(request, "Category deleted.")
    return redirect(request.META.get('HTTP_REFERER', 'core:dashboard'))

@login_required
def admin_teacher_profile(request, teacher_id):
    if request.user.role != 'admin':
        return redirect('core:home')
        
    from accounts.models import TeacherProfile
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    
    courses = teacher.courses.all()
    total_students = sum(c.enrollments.count() for c in courses)
    total_earnings = sum(c.enrollments.count() * c.price for c in courses)
    all_enrollments = []
    for c in courses:
        all_enrollments.extend(list(c.enrollments.all()))
        
    from courses.models import LiveClass
    live_classes = LiveClass.objects.filter(course__in=courses).order_by('-start_time')
    
    from django.core.paginator import Paginator
    page_number = request.GET.get('page', 1)
    paginator = Paginator(live_classes, 10)
    live_classes_page = paginator.get_page(page_number)
    
    context = {
        'teacher': teacher,
        'courses': courses,
        'total_students': total_students,
        'total_earnings': total_earnings,
        'all_enrollments': all_enrollments,
        'live_classes': live_classes_page,
    }
    return render(request, 'core/admin_teacher_profile.html', context)

@login_required
def admin_student_profile(request, student_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    
    from accounts.models import StudentProfile
    from courses.models import Enrollment, Attendance
    
    from core.utils import get_attendance_analytics
    
    student = get_object_or_404(StudentProfile, id=student_id)
    enrollments = Enrollment.objects.filter(student=student).order_by('-date_enrolled')
    attendances = Attendance.objects.filter(student=student).order_by('-joined_at')
    
    analytics_context = get_attendance_analytics(request, Attendance.objects.filter(student=student).select_related('live_class'))
    
    total_spent = sum(enrollment.course.price for enrollment in enrollments)
    
    context = {
        'student': student,
        'enrollments': enrollments,
        'attendances': attendances,
        'total_spent': total_spent,
        **analytics_context
    }
    return render(request, 'core/admin_student_profile.html', context)

@login_required
def admin_parent_profile(request, parent_id):
    if request.user.role != 'admin':
        return redirect('core:home')
    
    from accounts.models import ParentProfile
    from courses.models import Enrollment, Attendance
    
    parent = get_object_or_404(ParentProfile, id=parent_id)
    children = parent.children.all()
    
    # Get all enrollments for all linked children
    children_enrollments = Enrollment.objects.filter(student__in=children).order_by('-date_enrolled')
    children_attendances = Attendance.objects.filter(student__in=children).order_by('-joined_at')
    
    context = {
        'parent': parent,
        'children': children,
        'children_enrollments': children_enrollments,
        'children_attendances': children_attendances,
    }
    return render(request, 'core/admin_parent_profile.html', context)

@login_required
def admin_add_teacher(request):
    if request.user.role != 'admin':
        return redirect('core:home')
    
    from accounts.forms import CustomUserCreationForm
    from accounts.models import TeacherCertificate
    
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save(commit=False)
            user.role = 'teacher' # Force teacher
            user.save()
            
            from accounts.models import TeacherProfile
            profile = TeacherProfile.objects.create(
                user=user
            )
            profile.is_approved = True # Automatically approve if admin created
            profile.save()
            
            cert_titles = request.POST.getlist('cert_title[]')
            cert_files = request.FILES.getlist('cert_file[]')
            for title, f in zip(cert_titles, cert_files):
                if f:
                    TeacherCertificate.objects.create(
                        teacher=profile,
                        title=title or f.name,
                        file=f
                    )
            
            messages.success(request, f"Teacher {user.username} created successfully!")
            return redirect('core:dashboard')
    else:
        # Preselect teacher role
        form = CustomUserCreationForm(initial={'role': 'teacher'})
        
    return render(request, 'core/admin_add_teacher.html', {'form': form})

def subject_detail(request, category_id):
    from courses.models import Category, Course
    category = get_object_or_404(Category, id=category_id)
    # Get all approved courses (teachers) under this category
    courses = Course.objects.filter(category=category, is_approved=True, is_frozen=False).order_by('-created_at')
    
    context = {
        'category': category,
        'courses': courses,
    }
    return render(request, 'core/subject_detail.html', context)


@login_required
def admin_group_classes(request):
    """Admin page to manage pending Public (Group) Live Classes."""
    if request.user.role != 'admin':
        return redirect('core:home')
    from courses.models import LiveClass
    pending = LiveClass.objects.filter(class_type='public', status='pending').select_related('course__teacher__user').order_by('course__teacher__id', '-id')
    approved = LiveClass.objects.filter(class_type='public', status='approved').select_related('course__teacher__user').order_by('-start_time')
    
    # Group pending classes by teacher
    teachers_with_pending = {}
    for lc in pending:
        teacher = lc.course.teacher
        if teacher not in teachers_with_pending:
            teachers_with_pending[teacher] = []
        teachers_with_pending[teacher].append(lc)
        
    return render(request, 'core/admin_group_classes.html', {
        'teachers_with_pending': teachers_with_pending,
        'approved_classes': approved,
    })

@login_required
def admin_approve_all_group_classes(request, teacher_id):
    """Admin approves all pending public group classes for a teacher."""
    if request.user.role != 'admin':
        return redirect('core:home')
    from accounts.models import TeacherProfile
    from courses.models import LiveClass
    
    teacher = get_object_or_404(TeacherProfile, id=teacher_id)
    pending_classes = LiveClass.objects.filter(class_type='public', status='pending', course__teacher=teacher)
    
    if request.method == 'POST':
        admin_comment = request.POST.get('admin_comment', '')
        teacher_requested_price = request.POST.get('teacher_requested_price')
        final_price = request.POST.get('final_price')
        
        count = 0
        for lc in pending_classes:
            if final_price:
                lc.price = final_price
            else:
                lc.price = lc.teacher_requested_price
                
            if teacher_requested_price:
                lc.teacher_requested_price = teacher_requested_price
                
            lc.admin_comment = admin_comment
            lc.status = 'approved'
            lc.save()
            count += 1
            
        messages.success(request, f'Successfully approved {count} pending group classes for {teacher.user.get_full_name() or teacher.user.username}!')
    return redirect('core:admin_group_classes')


@login_required
def admin_approve_group_class(request, class_id):
    """Admin approves a public group class and sets the final price."""
    if request.user.role != 'admin':
        return redirect('core:home')
    if request.method == 'POST':
        from courses.models import LiveClass
        lc = get_object_or_404(LiveClass, id=class_id, class_type='public')
        
        final_price = request.POST.get('final_price')
        if final_price:
            lc.price = final_price
            
        teacher_requested_price = request.POST.get('teacher_requested_price')
        if teacher_requested_price:
            lc.teacher_requested_price = teacher_requested_price
            
        admin_comment = request.POST.get('admin_comment', '')
        lc.admin_comment = admin_comment
        lc.status = 'approved'
        lc.save()
        messages.success(request, f'Group class "{lc.title}" approved successfully.')
    return redirect('core:admin_group_classes')


@login_required
def admin_reject_group_class(request, class_id):
    """Admin rejects a public group class."""
    if request.user.role != 'admin':
        return redirect('core:home')
    if request.method == 'POST':
        from courses.models import LiveClass
        lc = get_object_or_404(LiveClass, id=class_id, class_type='public')
        admin_comment = request.POST.get('admin_comment', '')
        lc.admin_comment = admin_comment
@login_required
def admin_reject_group_class(request, class_id):
    """Admin rejects a public group class."""
    if request.user.role != 'admin':
        return redirect('core:home')
    if request.method == 'POST':
        from courses.models import LiveClass
        lc = get_object_or_404(LiveClass, id=class_id, class_type='public')
        admin_comment = request.POST.get('admin_comment', '')
        lc.admin_comment = admin_comment
        lc.status = 'rejected'
        lc.save()
        messages.warning(request, f'Group class "{lc.title}" rejected.')
    return redirect('core:admin_group_classes')

@login_required
def complaints_dashboard(request):
    """View to show and create complaints based on user role."""
    from .models import IssueReport
    from courses.models import Course, Enrollment
    from django.contrib import messages
    
    role = request.user.role
    
    if request.method == 'POST' and role == 'teacher':
        course_id = request.POST.get('course_id')
        student_id = request.POST.get('student_id')
        description = request.POST.get('description')
        visibility = request.POST.get('visibility', 'student_parent')
        file_obj = request.FILES.get('file')
        
        course = get_object_or_404(Course, id=course_id, teacher=request.user.teacher_profile)
        
        from accounts.models import User
        student = get_object_or_404(User, id=student_id)
        parent = None
        if hasattr(student, 'student_profile') and student.student_profile.parent:
            parent = student.student_profile.parent.user
            
        IssueReport.objects.create(
            teacher=request.user.teacher_profile,
            course=course,
            student=student,
            parent=parent,
            description=description,
            visibility=visibility,
            file=file_obj
        )
        messages.success(request, "Complaint reported successfully.")
        return redirect('core:complaints')
    
    all_complaints = IssueReport.objects.select_related('course', 'teacher', 'student', 'parent').order_by('-created_at')
    
    if role == 'admin':
        complaints = all_complaints
    elif role == 'teacher':
        complaints = all_complaints.filter(teacher=request.user.teacher_profile)
    elif role == 'parent':
        # Parent can see complaints where they are the parent OR visibility allows it
        parent_profile = request.user.parent_profile
        children_users = [child.user for child in parent_profile.children.all()]
        complaints = all_complaints.filter(student__in=children_users).exclude(visibility='admin_only')
    elif role == 'student':
        complaints = all_complaints.filter(student=request.user, visibility='student_parent')
    else:
        return redirect('core:home')
        
    context = {
        'complaints': complaints,
    }
    
    if role == 'teacher':
        context['teacher_courses'] = Course.objects.filter(teacher=request.user.teacher_profile)
        
    return render(request, 'core/dashboards/complaints_dashboard.html', context)

from django.http import JsonResponse

@login_required
def get_students_for_course(request):
    """AJAX endpoint to get students enrolled in a course and their parent info."""
    if request.user.role != 'teacher':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
        
    course_id = request.GET.get('course_id')
    if not course_id:
        return JsonResponse({'students': []})
        
    from courses.models import Enrollment, Course
    course = get_object_or_404(Course, id=course_id, teacher=request.user.teacher_profile)
    enrollments = Enrollment.objects.filter(course=course).select_related('student__user')
    
    students_data = []
    for en in enrollments:
        student_user = en.student.user
        parent_name = "No Parent Linked"
        if en.student.parent:
            parent_name = en.student.parent.user.get_full_name() or en.student.parent.user.username
            
        students_data.append({
            'id': student_user.id,
            'name': student_user.get_full_name() or student_user.username,
            'parent_name': parent_name
        })
        
    return JsonResponse({'students': students_data})
