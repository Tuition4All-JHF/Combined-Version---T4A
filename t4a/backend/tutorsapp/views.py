# backend/tutorsapp/views.py
from rest_framework import generics, filters, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Subject, TutorProfile, Booking, ChatRoom, Message, TutorScheduleSlot, Assignment, AssignmentSubmission, Attendance, StudyNote
from .serializers import (
    SubjectSerializer, TutorProfileSerializer, BookingSerializer,
    ChatRoomSerializer, MessageSerializer, TutorScheduleSlotSerializer,
    AssignmentSerializer, AssignmentSubmissionSerializer, StudyNoteSerializer,
)
from django_filters.rest_framework import DjangoFilterBackend
from accounts.models import User

# ----- Subjects -------------------------------------------------
class SubjectListCreate(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.AllowAny]

# ----- Tutor discovery -------------------------------------------
class TutorList(generics.ListAPIView):
    serializer_class = TutorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['subjects__id']
    search_fields = ['user__username', 'subjects__name', 'bio']
    ordering_fields = ['rating', 'experience_years', 'tutor_subjects__hourly_rate']

    def get_queryset(self):
        qs = TutorProfile.objects.select_related('user').prefetch_related('subjects').filter(
            verification_status=TutorProfile.VerificationStatus.APPROVED,
            user__is_frozen=False
        )
        # Filter by session_type offered in their schedule slots
        session_type = self.request.query_params.get('session_type')
        if session_type:
            qs = qs.filter(user__schedule_slots__session_type=session_type).distinct()
        
        # Filter by max hourly rate
        max_rate = self.request.query_params.get('max_rate')
        if max_rate:
            try:
                qs = qs.filter(tutor_subjects__hourly_rate__lte=float(max_rate)).distinct()
            except ValueError:
                pass
                
        return qs

# ----- Tutor Profile self-view -----------------------------------
class TutorProfileDetail(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = TutorProfile.objects.get(user=request.user)
            serializer = TutorProfileSerializer(profile, context={'request': request})
            return Response(serializer.data)
        except TutorProfile.DoesNotExist:
            return Response({'detail': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request):
        try:
            profile = TutorProfile.objects.get(user=request.user)
            subjects_data = request.data.get('subjects')
            
            serializer = TutorProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                
                if subjects_data is not None:
                    try:
                        from .models import TutorSubject
                        import json
                        
                        if isinstance(subjects_data, str):
                            parsed_subjects = json.loads(subjects_data)
                        else:
                            parsed_subjects = subjects_data

                        if parsed_subjects and isinstance(parsed_subjects[0], dict):
                            new_subject_ids = [s.get('subject_id') or s.get('id') for s in parsed_subjects]
                            TutorSubject.objects.filter(tutor=profile).exclude(subject_id__in=new_subject_ids).delete()
                            for s_data in parsed_subjects:
                                sid = s_data.get('subject_id') or s_data.get('id')
                                TutorSubject.objects.update_or_create(
                                    tutor=profile,
                                    subject_id=sid,
                                    defaults={
                                        'course_duration_hours': s_data.get('course_duration_hours', 0),
                                        'hourly_rate': s_data.get('hourly_rate', 0.0)
                                    }
                                )
                        else:
                            subject_ids = [int(i) for i in parsed_subjects]
                            TutorSubject.objects.filter(tutor=profile).exclude(subject_id__in=subject_ids).delete()
                            for sid in subject_ids:
                                TutorSubject.objects.get_or_create(tutor=profile, subject_id=sid)
                    except Exception as e:
                        print("Error updating subjects:", e)
                        pass

                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except TutorProfile.DoesNotExist:
            return Response({'detail': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

# ----- Booking flow -----------------------------------------------
class BookingCreate(generics.CreateAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        tutor_id = request.data.get('tutor_id')
        subject_id = request.data.get('subject_id')
        time_slot_id = request.data.get('time_slot_id')
        notes = request.data.get('notes', '')
        
        # Determine the actual student
        booking_student = request.user
        if request.user.role == User.Role.PARENT:
            student_id = request.data.get('student_id')
            if not student_id:
                return Response({'detail': 'student_id is required for parent booking.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                booking_student = request.user.parent_profile.children.get(id=student_id)
            except User.DoesNotExist:
                return Response({'detail': 'Child not found in your linked students.'}, status=status.HTTP_400_BAD_REQUEST)
            notes = f"{notes}\n(Via Parent Account)".strip()
        
        try:
            tutor = User.objects.get(id=tutor_id, role=User.Role.TUTOR)
            subject = Subject.objects.get(id=subject_id)
        except (User.DoesNotExist, Subject.DoesNotExist):
            return Response({'detail': 'Invalid tutor or subject.'}, status=status.HTTP_400_BAD_REQUEST)

        if not time_slot_id:
            return Response({'detail': 'time_slot_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            time_slot = TutorScheduleSlot.objects.get(id=time_slot_id, tutor=tutor, is_booked=False)
        except TutorScheduleSlot.DoesNotExist:
            return Response({'detail': 'Time slot is unavailable or invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        # Handle batch booking
        slots_to_book = [time_slot]
        if time_slot.batch_id:
            all_batch_slots = TutorScheduleSlot.objects.filter(batch_id=time_slot.batch_id)
            target_time = time_slot.start_time.time()
            
            # Only consider slots in the batch that have the exact same time of day
            total_batch_slots = [s for s in all_batch_slots if s.start_time.time() == target_time]
            available_batch_slots = [s for s in total_batch_slots if not s.is_booked]
            
            if len(available_batch_slots) != len(total_batch_slots):
                return Response({'detail': 'One or more slots in this batch are already booked.'}, status=status.HTTP_400_BAD_REQUEST)
            slots_to_book = available_batch_slots
            
        # Check for duplicate bookings
        for slot in slots_to_book:
            if Booking.objects.filter(student=booking_student, time_slot=slot).exists():
                return Response({'detail': 'You have already booked this time slot.'}, status=status.HTTP_400_BAD_REQUEST)
            
        bookings = []
        for slot in slots_to_book:
            booking = Booking.objects.create(
                student=booking_student,
                tutor=tutor,
                subject=subject,
                time_slot=slot,
                start_time=slot.start_time,
                end_time=slot.end_time,
                notes=notes,
                status=Booking.Status.PENDING
            )
            bookings.append(booking)
            
            if slot.bookings.count() >= slot.max_students:
                slot.is_booked = True
            
        # Bulk update the slots
        TutorScheduleSlot.objects.bulk_update(slots_to_book, ['is_booked'])

        # Return the first booking or list of bookings, here we return list
        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

from rest_framework import viewsets
from rest_framework.decorators import action

class TutorScheduleSlotViewSet(viewsets.ModelViewSet):
    serializer_class = TutorScheduleSlotSerializer

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = TutorScheduleSlot.objects.all()
        
        from django.utils import timezone
        now = timezone.now()

        # If tutor is logged in and not querying a specific tutor_id, show their own slots
        tutor_id = self.request.query_params.get('tutor_id')
        if tutor_id:
            queryset = queryset.filter(tutor_id=tutor_id)
            # If student, parent, or guest is querying, only show available FUTURE slots
            if not user.is_authenticated or user.role in [User.Role.STUDENT, User.Role.PARENT]:
                queryset = queryset.filter(is_booked=False, start_time__gt=now)
        else:
            if user.is_authenticated and user.role == User.Role.TUTOR:
                queryset = queryset.filter(tutor=user)
            else:
                queryset = queryset.none()

        # Filter by session_type if provided
        session_type_param = self.request.query_params.get('session_type')
        if session_type_param:
            queryset = queryset.filter(session_type=session_type_param)
                
        # Optional date filtering
        date_param = self.request.query_params.get('date')
        if date_param:
            queryset = queryset.filter(start_time__date=date_param)

        return queryset.order_by('start_time')

    def create(self, request, *args, **kwargs):
        from dateutil import parser as dt_parser
        from datetime import timedelta, date as date_type
        import uuid
        import math
        from .models import TutorSubject

        user = request.user
        if user.role != User.Role.TUTOR:
            return Response({'detail': 'Only tutors can create schedule slots.'}, status=status.HTTP_403_FORBIDDEN)

        profile = TutorProfile.objects.filter(user=user).first()
        if not profile or profile.verification_status != TutorProfile.VerificationStatus.APPROVED:
            return Response({
                'detail': 'Admin approval pending. You cannot add class schedules until your profile is approved by the admin.',
                'verification_status': profile.verification_status if profile else 'PENDING'
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        time_slots_data = data.get('time_slots')
        if not time_slots_data:
            start_time_str = data.get('start_time')
            end_time_str   = data.get('end_time')
            if start_time_str and end_time_str:
                time_slots_data = [{'start_time': start_time_str, 'end_time': end_time_str}]
            else:
                return Response({'detail': 'Time slots or start/end time are required.'}, status=status.HTTP_400_BAD_REQUEST)

        subject_id     = data.get('subject_id')
        recurrence_type = data.get('recurrence_type', 'NONE')
        days_of_week   = data.get('days_of_week', [])
        end_date_str   = data.get('end_date')
        weeks_count    = data.get('weeks_count', 1)
        session_type   = data.get('session_type', 'ONE_TO_ONE')
        max_students   = int(data.get('max_students', 1) or 1)
        if session_type == 'ONE_TO_ONE':
            max_students = 1

        # --- parse base start/end times ---
        parsed_times = []
        for ts in time_slots_data:
            try:
                s_dt = dt_parser.parse(ts['start_time'])
                e_dt = dt_parser.parse(ts['end_time'])
                if e_dt <= s_dt:
                    return Response({'detail': 'End time must be after start time.'}, status=status.HTTP_400_BAD_REQUEST)
                parsed_times.append((s_dt, e_dt))
            except Exception:
                return Response({'detail': 'Invalid start_time or end_time.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_times.sort(key=lambda x: x[0])
        base_start_dt = parsed_times[0][0]

        # --- resolve subject ---
        subject = None
        if subject_id:
            try:
                subject = Subject.objects.get(id=subject_id)
            except Subject.DoesNotExist:
                return Response({'detail': 'Invalid subject.'}, status=status.HTTP_400_BAD_REQUEST)

        # --- normalise days_of_week ---
        try:
            days_of_week = [int(d) for d in days_of_week]
        except (ValueError, TypeError):
            days_of_week = []

        # Auto-calculate weeks for WEEKLY
        if recurrence_type == 'WEEKLY' and subject:
            tutor_subject = TutorSubject.objects.filter(tutor=profile, subject=subject).first()
            if tutor_subject and tutor_subject.course_duration_hours > 0:
                hours_per_day = sum([(e - s).total_seconds() / 3600.0 for s, e in parsed_times])
                if hours_per_day > 0:
                    num_days = max(1, len(days_of_week))
                    hours_per_week = hours_per_day * num_days
                    weeks_count = math.ceil(tutor_subject.course_duration_hours / hours_per_week)
                    weeks_count = max(1, min(52, weeks_count))

        # -------------------------------------------------------------------
        # Build the list of (start, end) datetimes to create
        # -------------------------------------------------------------------
        DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        all_slot_times = []

        if recurrence_type == 'NONE':
            all_slot_times = parsed_times
            batch_label = None

        elif recurrence_type == 'WEEKLY':
            if not days_of_week:
                days_of_week = [base_start_dt.weekday()]

            total_hours_required = 0
            if subject:
                tutor_subject = TutorSubject.objects.filter(tutor=profile, subject=subject).first()
                if tutor_subject and tutor_subject.course_duration_hours > 0:
                    total_hours_required = tutor_subject.course_duration_hours

            # We process each time slot independently since they are separate batch options
            for (s_dt, e_dt) in parsed_times:
                slot_duration_hours = (e_dt - s_dt).total_seconds() / 3600.0
                
                if total_hours_required > 0 and slot_duration_hours > 0:
                    classes_needed = math.ceil(total_hours_required / slot_duration_hours)
                else:
                    classes_needed = len(days_of_week)

                classes_needed = max(1, min(classes_needed, 365))

                current_date = base_start_dt
                classes_generated = 0
                
                while classes_generated < classes_needed:
                    if current_date.weekday() in days_of_week:
                        class_duration = e_dt - s_dt
                        slot_start = current_date.replace(
                            hour=s_dt.hour, minute=s_dt.minute, second=0, microsecond=0
                        )
                        slot_end = slot_start + class_duration
                        all_slot_times.append((slot_start, slot_end))
                        classes_generated += 1
                    current_date += timedelta(days=1)
                
            day_names_str = ', '.join(DAY_NAMES[d] for d in sorted(days_of_week))
            # Note: For WEEKLY, batch_label is generated later per-batch if needed, 
            # but since we create it generically here, we can use the last generated count.
            # A better approach is to set batch_label during bulk create, but for now we format it dynamically.
            # We will fix the batch_label assignment below in the bulk create loop.
            batch_label = None

        elif recurrence_type == 'MONTHLY':
            if not days_of_week:
                days_of_week = [base_start_dt.weekday()]

            try:
                end_date = dt_parser.parse(end_date_str).date() if end_date_str else None
            except Exception:
                end_date = None

            if not end_date:
                return Response({'detail': 'end_date is required for monthly recurrence.'}, status=status.HTTP_400_BAD_REQUEST)

            if end_date <= base_start_dt.date():
                return Response({'detail': 'end_date must be after the start date.'}, status=status.HTTP_400_BAD_REQUEST)

            current = base_start_dt.date()
            while current <= end_date:
                if current.weekday() in days_of_week:
                    for (s_dt, e_dt) in parsed_times:
                        class_duration = e_dt - s_dt
                        slot_start = base_start_dt.replace(
                            year=current.year, month=current.month, day=current.day,
                            hour=s_dt.hour, minute=s_dt.minute, second=0, microsecond=0
                        )
                        slot_end = slot_start + class_duration
                        all_slot_times.append((slot_start, slot_end))
                current += timedelta(days=1)

            if not all_slot_times:
                return Response({'detail': 'No valid slots found for the selected days in the given date range.'}, status=status.HTTP_400_BAD_REQUEST)

            day_names_str = ', '.join(DAY_NAMES[d] for d in sorted(days_of_week))
            start_label = base_start_dt.strftime('%d %b')
            end_label   = end_date.strftime('%d %b %Y')
            batch_label = f"{day_names_str} ({start_label} – {end_label})"

        else:
            return Response({'detail': 'Invalid recurrence_type.'}, status=status.HTTP_400_BAD_REQUEST)

        # -------------------------------------------------------------------
        # Overlap check for every generated slot before creating anything
        # -------------------------------------------------------------------
        for (s, e) in all_slot_times:
            overlap = TutorScheduleSlot.objects.filter(
                tutor=user,
                start_time__lt=e,
                end_time__gt=s
            ).exists()
            if overlap:
                return Response({
                    'detail': f'Time slot collision detected for {s.strftime("%a %d %b %Y %H:%M")}. Please choose a different time.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # -------------------------------------------------------------------
        # Bulk create
        # -------------------------------------------------------------------
        time_key_counts = {}
        for (s, e) in all_slot_times:
            tk = (s.time(), e.time())
            time_key_counts[tk] = time_key_counts.get(tk, 0) + 1
            
        batch_id_map = {}
        for tk, count in time_key_counts.items():
            if count > 1:
                batch_id_map[tk] = str(uuid.uuid4())

        slots_to_create = []
        for (s, e) in all_slot_times:
            tk = (s.time(), e.time())
            batch_id = batch_id_map.get(tk)
            
            # Dynamically determine the label for WEEKLY recurrence based on sessions for this specific time slot
            current_batch_label = batch_label
            if recurrence_type == 'WEEKLY':
                count = time_key_counts.get(tk, 1)
                weeks_generated = math.ceil(count / len(days_of_week)) if days_of_week else 1
                current_batch_label = f"{day_names_str} ({weeks_generated} weeks, {count} sessions)"
                
            slots_to_create.append(TutorScheduleSlot(
                tutor=user,
                subject=subject,
                start_time=s,
                end_time=e,
                batch_id=batch_id,
                recurrence_type=recurrence_type,
                batch_label=current_batch_label,
                session_type=session_type,
                max_students=max_students,
            ))

        created_slots = TutorScheduleSlot.objects.bulk_create(slots_to_create)
        serializer = self.get_serializer(created_slots, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_booked:
            return Response({'detail': 'Cannot delete a booked slot.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)
        
    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        slot_ids = request.data.get('slot_ids', [])
        if not slot_ids:
            return Response({'detail': 'No slots provided.'}, status=status.HTTP_400_BAD_REQUEST)
            
        slots = TutorScheduleSlot.objects.filter(id__in=slot_ids, tutor=request.user)
        booked_count = slots.filter(is_booked=True).count()
        if booked_count > 0:
            return Response({'detail': 'Cannot delete booked slots.'}, status=status.HTTP_400_BAD_REQUEST)
            
        deleted_count, _ = slots.delete()
        return Response({'detail': f'Successfully deleted {deleted_count} slots.'}, status=status.HTTP_200_OK)

class BookingList(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.STUDENT:
            qs = Booking.objects.filter(student=user)
        else:
            qs = Booking.objects.filter(tutor=user)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        date_param = self.request.query_params.get('date')
        if date_param == 'today':
            from django.utils import timezone
            # localdate() respects TIME_ZONE = 'Asia/Kolkata' in settings.py
            today = timezone.localdate()
            qs = qs.filter(start_time__date=today)

        return qs.order_by('-created_at')

class BookingDetail(generics.RetrieveUpdateAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.STUDENT:
            return Booking.objects.filter(student=user)
        return Booking.objects.filter(tutor=user)

def calculate_attendance_stats(attendances_qs):
    """
    Standard helper to compute attendance statistics consistently across
    Student, Parent, and Tutor dashboards.
    """
    total_sessions = attendances_qs.count()
    attended_sessions = attendances_qs.filter(status__in=['PRESENT', 'PARTIAL']).count()
    
    total_duration = 0
    total_attended = 0
    total_missed = 0
    
    for att in attendances_qs:
        tot = att.total_duration_seconds if att.total_duration_seconds > 0 else (att.total_attended_seconds + att.missed_seconds)
        # Ensure missed is correctly calculated based on total and attended
        actual_missed = tot - att.total_attended_seconds
        if actual_missed < 0:
            actual_missed = 0
        total_duration += tot
        total_attended += att.total_attended_seconds
        total_missed += actual_missed
        
    attendance_percentage = (total_attended / total_duration * 100) if total_duration > 0 else 0.0
    
    # Calculate display minutes rounded to 1 decimal
    total_duration_minutes = round(total_duration / 60.0, 1)
    total_attended_minutes = round(total_attended / 60.0, 1)
    # Guarantee Attended + Missed = Total Duration on the UI
    total_missed_minutes = round(total_duration_minutes - total_attended_minutes, 1)
    if total_missed_minutes < 0:
        total_missed_minutes = 0.0
        
    # Optional: recalculate exact UI percentage to prevent mathematical mismatch 
    # if duration was very small and rounding caused divergence (e.g. 3.3/5.1 = 64.71 vs 65.36)
    # but requirement dictates percentage derived exactly from seconds.
    
    return {
        'total_sessions': total_sessions,
        'attended_sessions': attended_sessions,
        'total_duration_seconds': total_duration,
        'total_attended_seconds': total_attended,
        'total_missed_seconds': total_missed,
        'total_duration_minutes': total_duration_minutes,
        'total_attended_minutes': total_attended_minutes,
        'total_missed_minutes': total_missed_minutes,
        'attendance_percentage': round(attendance_percentage, 2),
    }


# ----- My Students -----------------------------------------------
class MyStudentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.TUTOR:
            return Response({'detail': 'Not a tutor.'}, status=403)
        bookings = Booking.objects.filter(tutor=request.user).select_related('student')
        seen = set()
        students = []
        for b in bookings:
            if b.student.id not in seen:
                seen.add(b.student.id)
                # aggregate attendance stats for this student across this tutor
                student_attendances = Attendance.objects.filter(student=b.student, booking__tutor=request.user)
                stats = calculate_attendance_stats(student_attendances)
                
                students.append({
                    'id': b.student.id,
                    'username': b.student.username,
                    'sessions_count': stats['total_sessions'],
                    'overall_attendance_percentage': stats['attendance_percentage'],
                    'total_missed_duration_minutes': stats['total_missed_minutes'],
                    'total_duration_minutes': stats['total_duration_minutes'],
                    'total_attended_minutes': stats['total_attended_minutes']
                })
        return Response(students)

# ----- Student Attendance Dashboard -----------------------------------
from django.utils import timezone
from datetime import timedelta

class StudentAttendanceDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({'detail': 'Not a student.'}, status=403)
            
        attendances = request.user.attendances.all()
        now = timezone.now()
        
        overall_stats = calculate_attendance_stats(attendances)
        
        # Daily
        daily_attendances = attendances.filter(created_at__date=now.date())
        daily_stats = calculate_attendance_stats(daily_attendances)
        
        # Weekly
        week_ago = now - timedelta(days=7)
        weekly_attendances = attendances.filter(created_at__gte=week_ago)
        weekly_stats = calculate_attendance_stats(weekly_attendances)
        
        # Monthly
        month_ago = now - timedelta(days=30)
        monthly_attendances = attendances.filter(created_at__gte=month_ago)
        monthly_stats = calculate_attendance_stats(monthly_attendances)
        
        # Recent classes history
        recent_classes = []
        for att in attendances.select_related('booking__subject', 'booking__tutor').order_by('-created_at')[:20]:
            tot_sec = att.total_duration_seconds if att.total_duration_seconds > 0 else (att.total_attended_seconds + att.missed_seconds)
            recent_classes.append({
                'booking_id': att.booking.id,
                'subject': att.booking.subject.name if att.booking.subject else 'Unknown',
                'tutor': att.booking.tutor.username,
                'date': att.created_at,
                'status': att.status,
                'total_duration_minutes': round(float(tot_sec) / 60, 1),
                'attended_minutes': round(float(att.total_attended_seconds) / 60, 1),
                'missed_minutes': round(float(att.missed_seconds) / 60, 1),
                'percentage': round(float(att.attendance_percentage), 1)
            })
            
        return Response({
            'overall_percentage': overall_stats['attendance_percentage'],
            'total_missed_minutes': overall_stats['total_missed_minutes'],
            'total_duration_minutes': overall_stats['total_duration_minutes'],
            'total_attended_minutes': overall_stats['total_attended_minutes'],
            'total_sessions': overall_stats['total_sessions'],
            'attended_sessions': overall_stats['attended_sessions'],
            'daily_percentage': daily_stats['attendance_percentage'],
            'weekly_percentage': weekly_stats['attendance_percentage'],
            'monthly_percentage': monthly_stats['attendance_percentage'],
            'recent_history': recent_classes
        })

# ----- Chat ------------------------------------------------------
class ChatRoomListCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == User.Role.STUDENT:
            rooms = ChatRoom.objects.filter(student=user).select_related('student', 'tutor', 'parent')
        elif user.role == User.Role.PARENT:
            rooms = ChatRoom.objects.filter(parent=user).select_related('student', 'tutor', 'parent')
        else:
            rooms = ChatRoom.objects.filter(tutor=user).select_related('student', 'tutor', 'parent')
        serializer = ChatRoomSerializer(rooms, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        other_user_id = request.data.get('other_user_id') or request.data.get('tutor_id')
        if request.user.role == User.Role.STUDENT:
            try:
                tutor = User.objects.get(id=other_user_id, role=User.Role.TUTOR)
            except User.DoesNotExist:
                return Response({'detail': 'Tutor not found.'}, status=403)
            room, _ = ChatRoom.objects.get_or_create(student=request.user, tutor=tutor)
        elif request.user.role == User.Role.PARENT:
            try:
                tutor = User.objects.get(id=other_user_id, role=User.Role.TUTOR)
            except User.DoesNotExist:
                return Response({'detail': 'Tutor not found.'}, status=403)
            room, _ = ChatRoom.objects.get_or_create(parent=request.user, tutor=tutor)
        else:
            try:
                student = User.objects.get(id=other_user_id, role=User.Role.STUDENT)
                room, _ = ChatRoom.objects.get_or_create(student=student, tutor=request.user)
            except User.DoesNotExist:
                try:
                    parent = User.objects.get(id=other_user_id, role=User.Role.PARENT)
                    room, _ = ChatRoom.objects.get_or_create(parent=parent, tutor=request.user)
                except User.DoesNotExist:
                    return Response({'detail': 'Client not found.'}, status=403)
            
        return Response(ChatRoomSerializer(room, context={'request': request}).data, status=200)

class MessageListCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
            if request.user not in [room.student, room.tutor, room.parent]:
                return Response({'detail': 'Access denied.'}, status=403)
            # Mark messages as read
            room.messages.exclude(sender=request.user).update(is_read=True)
            messages = room.messages.all()
            return Response(MessageSerializer(messages, many=True).data)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Room not found.'}, status=404)

    def post(self, request, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
            if request.user not in [room.student, room.tutor, room.parent]:
                return Response({'detail': 'Access denied.'}, status=403)
            content = request.data.get('content', '').strip()
            if not content:
                return Response({'detail': 'Message cannot be empty.'}, status=400)
            msg = Message.objects.create(room=room, sender=request.user, content=content)
            return Response(MessageSerializer(msg).data, status=201)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Room not found.'}, status=404)

class ParentDashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.PARENT:
            return Response({'detail': 'Not a parent.'}, status=403)
            
        children = request.user.parent_profile.children.all()
        children_stats = []
        
        for child in children:
            stats = calculate_attendance_stats(child.attendances.all())
            children_stats.append({
                'id': child.id,
                'username': child.username,
                'total_sessions': stats['total_sessions'],
                'attended_sessions': stats['attended_sessions'],
                'total_missed_minutes': stats['total_missed_minutes'],
                'total_duration_minutes': stats['total_duration_minutes'],
                'total_attended_minutes': stats['total_attended_minutes'],
                'attendance_percentage': stats['attendance_percentage']
            })
            
        return Response(children_stats)

class ParentPaymentHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.PARENT:
            return Response({'detail': 'Not a parent.'}, status=403)
            
        children = request.user.parent_profile.children.all()
        from tutorsapp.models import Payment
        payments = Payment.objects.filter(booking__student__in=children).order_by('-created_at')
        
        history = []
        for p in payments:
            history.append({
                'id': p.id,
                'amount': p.amount,
                'status': p.status,
                'transaction_id': p.transaction_id,
                'created_at': p.created_at,
                'student_name': p.booking.student.username,
                'tutor_name': p.booking.tutor.username,
                'subject': p.booking.subject.name if p.booking.subject else 'Unknown'
            })
            
        return Response(history)


# ─── Assignment Views ─────────────────────────────────────────────────────────

class AssignmentListCreate(APIView):
    """Tutor: list own created assignments / create new one.
       Student: list assignments assigned to them."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role = request.user.role
        if role == User.Role.TUTOR:
            qs = Assignment.objects.filter(tutor=request.user).select_related('student', 'submission')
        elif role == User.Role.STUDENT:
            qs = Assignment.objects.filter(student=request.user).select_related('tutor', 'submission')
        else:
            return Response({'detail': 'Not allowed.'}, status=403)
        serializer = AssignmentSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        if request.user.role != User.Role.TUTOR:
            return Response({'detail': 'Only tutors can create assignments.'}, status=403)
        
        student_param = request.data.get('student')
        if not student_param:
            return Response({'detail': 'student field is required.'}, status=400)

        serializer = AssignmentSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if student_param == 'ALL':
            from .models import Booking
            target_student_ids = list(set(Booking.objects.filter(tutor=request.user).values_list('student_id', flat=True)))
            if not target_student_ids:
                return Response({'detail': 'You have no students.'}, status=400)
        else:
            try:
                str_val = str(student_param)
                target_student_ids = [int(x.strip()) for x in str_val.split(',') if x.strip()]
                if not target_student_ids:
                    return Response({'detail': 'No valid student selected.'}, status=400)
            except ValueError:
                return Response({'detail': 'Invalid student ID.'}, status=400)

        first = True
        first_attachment = None
        first_obj = None
        for sid in target_student_ids:
            try:
                student = User.objects.get(id=sid)
            except User.DoesNotExist:
                continue
            if first:
                first_obj = serializer.save(tutor=request.user, student=student)
                first_attachment = first_obj.attachment
                first = False
            else:
                Assignment.objects.create(
                    tutor=request.user,
                    student=student,
                    title=serializer.validated_data.get('title'),
                    description=serializer.validated_data.get('description', ''),
                    assigned_date=serializer.validated_data.get('assigned_date'),
                    due_date=serializer.validated_data.get('due_date'),
                    attachment=first_attachment
                )
        if not first_obj:
            return Response({'detail': 'Student(s) not found.'}, status=404)

        return Response(AssignmentSerializer(first_obj, context={'request': request}).data, status=status.HTTP_201_CREATED)


class AssignmentDetail(APIView):
    """GET detail, PATCH to mark as COMPLETED (tutor only)."""
    permission_classes = [permissions.IsAuthenticated]

    def _get_assignment(self, pk, user):
        try:
            return Assignment.objects.get(pk=pk)
        except Assignment.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_assignment(pk, request.user)
        if not obj:
            return Response({'detail': 'Not found.'}, status=404)
        if request.user not in (obj.tutor, obj.student):
            return Response({'detail': 'Forbidden.'}, status=403)
        return Response(AssignmentSerializer(obj, context={'request': request}).data)

    def patch(self, request, pk):
        """Tutor marks assignment as COMPLETED after reviewing submission."""
        obj = self._get_assignment(pk, request.user)
        if not obj:
            return Response({'detail': 'Not found.'}, status=404)
        if request.user != obj.tutor:
            return Response({'detail': 'Only the assigning tutor can mark complete.'}, status=403)
        obj.status = Assignment.Status.COMPLETED
        obj.save()
        return Response(AssignmentSerializer(obj, context={'request': request}).data)


class AssignmentSubmissionCreate(APIView):
    """Student submits answer (text and/or attachment)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.Role.STUDENT:
            return Response({'detail': 'Only students can submit.'}, status=403)
        try:
            assignment = Assignment.objects.get(pk=pk, student=request.user)
        except Assignment.DoesNotExist:
            return Response({'detail': 'Assignment not found.'}, status=404)
        if hasattr(assignment, 'submission'):
            return Response({'detail': 'Already submitted.'}, status=400)

        serializer = AssignmentSubmissionSerializer(
            data=request.data, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save(assignment=assignment)
            assignment.status = Assignment.Status.SUBMITTED
            assignment.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ParentAssignmentStatsView(APIView):
    """Returns assignment counts per linked child for the parent."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.PARENT:
            return Response({'detail': 'Not a parent.'}, status=403)
        try:
            children = request.user.parent_profile.children.all()
        except Exception:
            return Response([])

        result = []
        for child in children:
            qs = Assignment.objects.filter(student=child)
            result.append({
                'student_id': child.id,
                'username': child.username,
                'total': qs.count(),
                'pending': qs.filter(status=Assignment.Status.PENDING).count(),
                'submitted': qs.filter(status=Assignment.Status.SUBMITTED).count(),
                'completed': qs.filter(status=Assignment.Status.COMPLETED).count(),
            })
        return Response(result)


# ─── Study Notes System ───────────────────────────────────────────────────────

class StudyNoteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Study Notes.
    Tutors can create, list, delete their uploaded notes.
    Students can view notes assigned to them or globally to all students of the tutor.
    """
    serializer_class = StudyNoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.TUTOR:
            # Tutors see all notes they've uploaded
            return StudyNote.objects.filter(tutor=user)
        elif user.role == User.Role.STUDENT:
            # Students see notes explicitly assigned to them OR globally assigned by their tutors
            # Find all tutors this student has bookings with
            my_tutors = User.objects.filter(role=User.Role.TUTOR, tutor_bookings__student=user).distinct()
            from django.db.models import Q
            # Notes where student is explicitly me, OR student is null but tutor is one of my tutors
            return StudyNote.objects.filter(
                Q(student=user) | Q(student__isnull=True, tutor__in=my_tutors)
            ).distinct()
        return StudyNote.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != User.Role.TUTOR:
            raise permissions.PermissionDenied("Only tutors can upload study notes.")
        serializer.save(tutor=user)

# ─── AI Chat Views ────────────────────────────────────────────────────────────

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import AIChatSession, AIChatMessage
from .ai_service import chat_with_ai, transcribe_audio
from django.core.files.storage import FileSystemStorage
import os
from django.conf import settings

class AIChatSessionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sessions = AIChatSession.objects.filter(user=request.user)
        data = [{"id": s.id, "title": s.title, "updated_at": s.updated_at} for s in sessions]
        return Response(data)

    def post(self, request):
        session = AIChatSession.objects.create(user=request.user)
        return Response({"id": session.id, "title": session.title}, status=status.HTTP_201_CREATED)


class AIChatSessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        session = get_object_or_404(AIChatSession, id=pk, user=request.user)
        messages = AIChatMessage.objects.filter(session=session)
        data = [{"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]
        return Response({"session_id": session.id, "title": session.title, "messages": data})

    def delete(self, request, pk):
        session = get_object_or_404(AIChatSession, id=pk, user=request.user)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AIChatMessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(AIChatSession, id=pk, user=request.user)
        content = request.data.get("content")
        if not content:
            return Response({"error": "Content is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ai_msg = chat_with_ai(session, request.user, content)
            return Response({"role": ai_msg.role, "content": ai_msg.content}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AITranscribeAudioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({"error": "Audio file is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Save temporarily
        fs = FileSystemStorage(location=os.path.join(settings.MEDIA_ROOT, 'temp_audio'))
        filename = fs.save(audio_file.name, audio_file)
        file_path = fs.path(filename)

        try:
            transcription = transcribe_audio(file_path)
            # Remove temp file
            os.remove(file_path)
            return Response({"text": transcription.text})
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


