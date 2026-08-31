# backend/tutorsapp/admin_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from accounts.models import User
from .models import TutorProfile, Subject, Payment
from .serializers import TutorProfileSerializer, SubjectSerializer

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)

class AdminDashboardStats(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        total_students = User.objects.filter(role=User.Role.STUDENT).count()
        total_tutors = User.objects.filter(role=User.Role.TUTOR).count()
        return Response({
            'total_students': total_students,
            'total_tutors': total_tutors
        })

class AdminPendingTutors(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        profiles = TutorProfile.objects.filter(verification_status=TutorProfile.VerificationStatus.PENDING)
        serializer = TutorProfileSerializer(profiles, many=True, context={'request': request})
        return Response(serializer.data)

class AdminVerifyTutor(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, tutor_id):
        try:
            profile = TutorProfile.objects.get(id=tutor_id)
            new_status = request.data.get('status')
            if new_status in [TutorProfile.VerificationStatus.APPROVED, TutorProfile.VerificationStatus.REJECTED]:
                profile.verification_status = new_status
                profile.save()
                return Response({'status': 'success', 'verification_status': profile.verification_status})
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        except TutorProfile.DoesNotExist:
            return Response({'detail': 'Tutor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

class AdminSubjectListCreate(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        subjects = Subject.objects.all()
        serializer = SubjectSerializer(subjects, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SubjectSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdminSubjectDelete(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, pk):
        try:
            subject = Subject.objects.get(pk=pk)
            subject.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Subject.DoesNotExist:
            return Response({'detail': 'Subject not found.'}, status=status.HTTP_404_NOT_FOUND)

class AdminPaymentList(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        payments = Payment.objects.select_related('booking').all().order_by('-created_at')
        data = []
        for p in payments:
            data.append({
                'id': p.id,
                'booking_id': p.booking.id,
                'amount': p.amount,
                'status': p.status,
                'student': p.booking.student.username,
                'tutor': p.booking.tutor.username,
                'created_at': p.created_at
            })
        return Response(data)

class AdminAccountsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().prefetch_related('parent_profile__children')
        data = []
        for u in users:
            children = []
            if u.role == User.Role.PARENT and hasattr(u, 'parent_profile'):
                children = [{'id': c.id, 'username': c.username} for c in u.parent_profile.children.all()]
            
            data.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'role': u.role,
                'is_frozen': u.is_frozen,
                'linked_students': children
            })
        return Response(data)

class AdminToggleFreezeView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            if user.role == User.Role.ADMIN:
                return Response({'detail': 'Cannot freeze admin accounts.'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_frozen = not user.is_frozen
            user.save()
            return Response({'status': 'success', 'is_frozen': user.is_frozen})
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)


class AdminProfileDetailView(APIView):
    """Returns a detailed profile for a given user (tutor, student, or parent)."""
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        from .models import Booking, Payment, Attendance

        if user.role == User.Role.TUTOR:
            # --- Tutor profile ---
            try:
                profile = user.tutor_profile
            except Exception:
                return Response({'detail': 'Tutor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Enrolled students (unique students from confirmed/completed bookings)
            bookings = Booking.objects.filter(tutor=user).select_related('student')
            seen = set()
            enrolled_students = []
            for b in bookings:
                if b.student_id not in seen:
                    seen.add(b.student_id)
                    enrolled_students.append({'id': b.student.id, 'username': b.student.username, 'email': b.student.email})

            subjects = []
            for ts in profile.tutor_subjects.all():
                subjects.append({
                    'id': ts.subject.id,
                    'name': ts.subject.name,
                    'hourly_rate': str(ts.hourly_rate),
                    'course_duration_hours': ts.course_duration_hours
                })

            return Response({
                'role': 'TUTOR',
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_frozen': user.is_frozen,
                'bio': profile.bio,
                'qualifications': profile.qualifications,
                'experience_years': profile.experience_years,
                'rating': str(profile.rating),
                'verification_status': profile.verification_status,
                'profile_photo': request.build_absolute_uri(profile.profile_photo.url) if profile.profile_photo else None,
                'intro_video': request.build_absolute_uri(profile.intro_video.url) if profile.intro_video else None,
                'certification': request.build_absolute_uri(profile.certification.url) if profile.certification else None,
                'subjects': subjects,
                'enrolled_students': enrolled_students,
            })

        elif user.role == User.Role.STUDENT:
            # --- Student profile ---
            # Tutors the student is enrolled with
            bookings = Booking.objects.filter(student=user).select_related('tutor')
            seen = set()
            enrolled_tutors = []
            for b in bookings:
                if b.tutor_id not in seen:
                    seen.add(b.tutor_id)
                    enrolled_tutors.append({'id': b.tutor.id, 'username': b.tutor.username, 'email': b.tutor.email})

            # Attendance
            attendances = Attendance.objects.filter(student=user)
            total_duration = sum(a.total_duration_seconds for a in attendances if a.total_duration_seconds > 0)
            total_attended = sum(a.total_attended_seconds for a in attendances)
            overall_pct = round((total_attended / total_duration * 100), 1) if total_duration > 0 else 0.0

            # Payment history for this student
            payments = Payment.objects.filter(booking__student=user).select_related('booking__tutor', 'booking__subject').order_by('-created_at')
            payment_history = []
            for p in payments:
                payment_history.append({
                    'id': p.id,
                    'amount': str(p.amount),
                    'status': p.status,
                    'transaction_id': p.transaction_id,
                    'created_at': p.created_at,
                    'tutor': p.booking.tutor.username,
                    'subject': p.booking.subject.name if p.booking.subject else 'Unknown',
                })

            return Response({
                'role': 'STUDENT',
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_frozen': user.is_frozen,
                'enrolled_tutors': enrolled_tutors,
                'overall_attendance_percentage': overall_pct,
                'total_sessions': attendances.count(),
                'payment_history': payment_history,
            })

        elif user.role == User.Role.PARENT:
            # --- Parent profile ---
            linked_students = []
            if hasattr(user, 'parent_profile'):
                for child in user.parent_profile.children.all():
                    linked_students.append({'id': child.id, 'username': child.username, 'email': child.email})

            # Transaction history: payments made for any linked child
            child_ids = [s['id'] for s in linked_students]
            payments = Payment.objects.filter(booking__student_id__in=child_ids).select_related(
                'booking__student', 'booking__tutor', 'booking__subject'
            ).order_by('-created_at')

            transaction_history = []
            for p in payments:
                transaction_history.append({
                    'id': p.id,
                    'amount': str(p.amount),
                    'status': p.status,
                    'transaction_id': p.transaction_id,
                    'created_at': p.created_at,
                    'student': p.booking.student.username,
                    'tutor': p.booking.tutor.username,
                    'subject': p.booking.subject.name if p.booking.subject else 'Unknown',
                })

            return Response({
                'role': 'PARENT',
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_frozen': user.is_frozen,
                'linked_students': linked_students,
                'transaction_history': transaction_history,
            })

        return Response({'detail': 'Unsupported role for profile detail.'}, status=status.HTTP_400_BAD_REQUEST)
