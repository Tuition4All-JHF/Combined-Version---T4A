# backend/tutorsapp/admin_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from accounts.models import User
from .models import TutorProfile
from courses.models import Course, Category
from .serializers import CourseSerializer, TutorProfileSerializer, SubjectSerializer

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
        subjects = Category.objects.all()
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
            subject = Category.objects.get(pk=pk)
            subject.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Category.DoesNotExist:
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
                children = [{'id': c.id, 'username': c.username, 'first_name': c.first_name, 'last_name': c.last_name} for c in u.parent_profile.children.all()]
            
            data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
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
                return Response({'detail': 'Cannot freeze an admin account.'}, status=status.HTTP_400_BAD_REQUEST)
            if user.role == User.Role.ADMIN:
                return Response({'detail': 'Cannot freeze admin accounts.'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_frozen = not user.is_frozen
            user.is_active = not user.is_frozen
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

        from courses.models import LiveClassBooking as Booking, Attendance

        if user.role == User.Role.TUTOR:
            # --- Tutor profile ---
            try:
                profile = user.tutor_profile
            except Exception:
                return Response({'detail': 'Tutor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Enrolled students (unique students from confirmed/completed bookings)
            bookings = Booking.objects.filter(live_class__course__teacher__user=user).select_related('student__user')
            seen = set()
            enrolled_students = []
            for b in bookings:
                if b.student_id not in seen:
                    seen.add(b.student_id)
                    enrolled_students.append({'id': b.student.user.id, 'username': b.student.user.username, 'email': b.student.user.email})

            # Fetch all courses associated with this tutor
            from courses.models import Course
            try:
                # The tutor's courses might be linked via user.teacher_profile
                if hasattr(user, 'teacher_profile'):
                    tutor_courses = Course.objects.filter(teacher=user.teacher_profile)
                else:
                    tutor_courses = Course.objects.filter(teacher__user=user)
            except Exception:
                tutor_courses = []

            # We can serialize them or manually build the dict
            courses_data = []
            for c in tutor_courses:
                courses_data.append({
                    'id': c.id,
                    'title': c.title,
                    'description': c.description,
                    'status': c.status,
                    'price': str(c.price),
                    'teacher_price': str(c.teacher_price),
                    'hourly_fee': str(c.hourly_fee),
                    'total_duration_hours': c.total_duration_hours,
                    'total_amount': str(c.total_amount),
                    'category_name': c.category.name if c.category else '',
                    'experience': getattr(c, 'experience', ''),
                    'about_teaching': getattr(c, 'about_teaching', ''),
                    'skills': getattr(c, 'skills', ''),
                    'intro_video': request.build_absolute_uri(c.intro_video.url) if c.intro_video else None,
                })

            subjects = []
            for ts in profile.tutor_subjects.all():
                subjects.append({
                    'id': ts.subject.id,
                    'name': ts.subject.name,
                    'hourly_rate': str(ts.hourly_rate),
                    'course_duration_hours': ts.course_duration_hours
                })

            documents = []
            if hasattr(user, 'teacher_profile'):
                for cert in user.teacher_profile.certificates.all():
                    documents.append({
                        'id': cert.id,
                        'title': cert.title,
                        'file_url': request.build_absolute_uri(cert.file.url) if cert.file else None
                    })
            
            return Response({
                'courses': courses_data,
                'documents': documents,
                'role': 'TUTOR',
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'phone_number': getattr(user, 'phone_number', None),
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
            bookings = Booking.objects.filter(student__user=user).select_related('live_class__course__teacher__user')
            seen = set()
            enrolled_tutors = []
            for b in bookings:
                tutor_user = b.live_class.course.teacher.user if b.live_class and b.live_class.course and b.live_class.course.teacher else None
                if tutor_user and tutor_user.id not in seen:
                    seen.add(tutor_user.id)
                    enrolled_tutors.append({'id': tutor_user.id, 'username': tutor_user.username, 'first_name': tutor_user.first_name, 'last_name': tutor_user.last_name, 'email': tutor_user.email})

            # Attendance
            attendances = Attendance.objects.filter(student__user=user)
            total_sessions = attendances.count()
            present_sessions = sum(1 for a in attendances if a.status in ['present', 'late'])
            overall_pct = round((present_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0.0

            # Payment history for this student (Mocked as Payment model does not exist)
            payment_history = []

            return Response({
                'role': 'STUDENT',
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
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
                    linked_students.append({'id': child.id, 'username': child.username, 'first_name': child.first_name, 'last_name': child.last_name, 'email': child.email})

            # Transaction history: payments made for any linked child (Mocked)
            transaction_history = []

            return Response({
                'role': 'PARENT',
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'is_frozen': user.is_frozen,
                'linked_students': linked_students,
                'transaction_history': transaction_history,
            })

        return Response({'detail': 'Unsupported role for profile detail.'}, status=status.HTTP_400_BAD_REQUEST)


class AdminPendingCourses(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        courses = Course.objects.filter(status='pending')
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)

class AdminApproveCourse(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
            final_price = request.data.get('final_price')
            admin_hourly_fee = request.data.get('admin_hourly_fee')
            teacher_price = request.data.get('teacher_price')
            admin_comment = request.data.get('admin_comment', '')
            
            if final_price is not None:
                course.price = final_price
            if admin_hourly_fee is not None:
                course.admin_hourly_fee = admin_hourly_fee
            if teacher_price is not None:
                course.teacher_price = teacher_price
                
            course.admin_comment = admin_comment
            course.is_approved = True
            course.status = 'approved'
            course.save()
            return Response({'status': 'success', 'message': f'Course {course.title} approved successfully!'})
        except Course.DoesNotExist:
            return Response({'detail': 'Course not found.'}, status=status.HTTP_404_NOT_FOUND)
