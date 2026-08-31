# backend/tutorsapp/serializers.py
from rest_framework import serializers
from .models import TutorProfile, TutorSubject
from courses.models import Course, Category, LiveClass, LiveClassBooking, Assignment, StudentSubmission, CourseNote, Attendance
from chat.models import ChatRoom, Message
from accounts.models import User

class TutorSubjectSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='subject.id', read_only=True)
    name = serializers.CharField(source='subject.name', read_only=True)
    subject_id = serializers.IntegerField(source='subject.id', write_only=True)

    course_duration_hours = serializers.SerializerMethodField()
    hourly_rate = serializers.SerializerMethodField()

    class Meta:
        model = TutorSubject
        fields = ['id', 'subject_id', 'name', 'course_duration_hours', 'hourly_rate']

    def get_course(self, obj):
        if not hasattr(obj, '_cached_course'):
            from courses.models import Course
            obj._cached_course = Course.objects.filter(
                teacher=obj.tutor.user.teacher_profile,
                category=obj.subject,
                is_approved=True
            ).first()
        return obj._cached_course

    def get_course_duration_hours(self, obj):
        course = self.get_course(obj)
        if course:
            return course.total_duration_hours
        return obj.course_duration_hours

    def get_hourly_rate(self, obj):
        course = self.get_course(obj)
        if course:
            if course.admin_hourly_fee and course.admin_hourly_fee > 0:
                return course.admin_hourly_fee
            if course.total_duration_hours and course.total_duration_hours > 0 and course.price and course.price > 0:
                return round(float(course.price) / course.total_duration_hours, 2)
            return course.hourly_fee
        return obj.hourly_rate

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']

class TutorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    subjects = serializers.SerializerMethodField()

    def get_subjects(self, obj):
        request = self.context.get('request')
        # Show all subjects if it's the owner or an admin
        if request and request.user.is_authenticated and (request.user == obj.user or getattr(request.user, 'role', '') == 'ADMIN' or request.user.is_staff):
            subjects = obj.tutor_subjects.all()
        else:
            # Only show approved subjects in the public profile and listings
            subjects = obj.tutor_subjects.filter(is_approved=True)
        return TutorSubjectSerializer(subjects, many=True).data
    profile_photo_url = serializers.SerializerMethodField()
    intro_video_url = serializers.SerializerMethodField()
    certification_url = serializers.SerializerMethodField()

    class Meta:
        model = TutorProfile
        fields = [
            'id', 'user_id', 'username', 'first_name', 'last_name', 'email', 'bio', 'qualifications',
            'experience_years', 'rating', 'subjects',
            'certification', 'certification_url',
            'profile_photo', 'profile_photo_url',
            'intro_video', 'intro_video_url',
            'verification_status'
        ]
        read_only_fields = ['rating']

    def get_profile_photo_url(self, obj):
        if obj.profile_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_photo.url)
            return obj.profile_photo.url
        return None

    def get_intro_video_url(self, obj):
        if obj.intro_video:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.intro_video.url)
            return obj.intro_video.url
        return None

    def get_certification_url(self, obj):
        if obj.certification:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.certification.url)
            return obj.certification.url
        return None

class LiveClassSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.title', read_only=True)
    subject_name = serializers.CharField(source='course.category.name', read_only=True)
    subject_id = serializers.IntegerField(source='course.category.id', read_only=True)
    booked_seats = serializers.SerializerMethodField()
    session_type = serializers.SerializerMethodField()
    max_students = serializers.IntegerField(source='max_capacity', read_only=True)
    is_booked = serializers.SerializerMethodField()
    is_live = serializers.SerializerMethodField()

    class Meta:
        model = LiveClass
        fields = ['id', 'course', 'course_name', 'subject_name', 'subject_id', 'title', 'start_time', 'end_time', 
                  'max_capacity', 'max_students', 'is_ended', 'class_type', 'session_type', 'status', 'price', 
                  'booked_seats', 'is_booked', 'recurring_group_id', 'is_free', 'room_name', 'description', 'is_live']
        read_only_fields = ['is_ended', 'room_name', 'status']

    def get_booked_seats(self, obj):
        return obj.bookings.count() if hasattr(obj, 'bookings') else 0

    def get_session_type(self, obj):
        return 'ONE_TO_MANY' if obj.class_type == 'public' else 'ONE_TO_ONE'

    def get_is_booked(self, obj):
        return self.get_booked_seats(obj) > 0
        
    def get_is_live(self, obj):
        return obj.actual_start_time is not None and not obj.is_ended

class LiveClassBookingSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.username', read_only=True)
    tutor_name = serializers.CharField(source='live_class.course.teacher.user.username', read_only=True)
    course_name = serializers.CharField(source='live_class.course.title', read_only=True)
    student_id = serializers.IntegerField(source='student.user.id', read_only=True)
    tutor_id = serializers.IntegerField(source='live_class.course.teacher.user.id', read_only=True)
    
    time_slot_id = serializers.PrimaryKeyRelatedField(
        queryset=LiveClass.objects.filter(is_ended=False),
        source='live_class',
        write_only=True,
        required=True
    )
    time_slot = LiveClassSerializer(source='live_class', read_only=True)
    via_parent = serializers.SerializerMethodField()
    start_time = serializers.DateTimeField(source='live_class.start_time', read_only=True)
    end_time = serializers.DateTimeField(source='live_class.end_time', read_only=True)
    is_live = serializers.SerializerMethodField()

    class Meta:
        model = LiveClassBooking
        fields = [
            'id', 'student_id', 'tutor_id', 'student_name', 'tutor_name', 'course_name',
            'time_slot', 'time_slot_id', 'status', 'booking_date', 'via_parent',
            'start_time', 'end_time', 'cancellation_reason', 'is_live'
        ]
        read_only_fields = ['booking_date', 'student_name', 'tutor_name', 'course_name', 'student_id', 'tutor_id', 'via_parent']

    def to_internal_value(self, data):
        if 'status' in data:
            data = data.copy()
            data['status'] = data['status'].lower()
        return super().to_internal_value(data)

    def get_via_parent(self, obj):
        return False
        
    def get_is_live(self, obj):
        return obj.live_class.actual_start_time is not None and not obj.live_class.is_ended

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender_name', 'content', 'created_at', 'is_read']
        read_only_fields = ['created_at', 'sender_name']

class ChatRoomSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    tutor_name = serializers.CharField(source='tutor.username', read_only=True)
    parent_name = serializers.SerializerMethodField()
    student_id = serializers.SerializerMethodField()
    tutor_id = serializers.IntegerField(source='tutor.id', read_only=True)
    parent_id = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    client_id = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    tutor_photo = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'student_id', 'student_name', 'parent_id', 'parent_name', 'client_name', 'client_id', 'tutor_id', 'tutor_name', 'tutor_photo', 'last_message', 'created_at']

    def get_student_name(self, obj):
        return obj.student.username if obj.student else None
        
    def get_parent_name(self, obj):
        return obj.parent.username if obj.parent else None
        
    def get_student_id(self, obj):
        return obj.student.id if obj.student else None
        
    def get_parent_id(self, obj):
        return obj.parent.id if obj.parent else None

    def get_client_name(self, obj):
        if obj.student: return obj.student.username
        if obj.parent: return obj.parent.username
        return "Unknown"

    def get_client_id(self, obj):
        if obj.student: return obj.student.id
        if obj.parent: return obj.parent.id
        return None

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {'content': msg.content, 'created_at': msg.created_at}
        return None
        
    def get_tutor_photo(self, obj):
        try:
            if obj.tutor.photo:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.tutor.photo.url)
        except Exception:
            pass
        return None


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = StudentSubmission
        fields = ['id', 'assignment', 'file', 'attachment_url', 'submitted_at', 'status', 'teacher_comments', 'student_notes']
        read_only_fields = ['assignment', 'submitted_at']

    def get_attachment_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class AssignmentSerializer(serializers.ModelSerializer):
    tutor_name    = serializers.CharField(source='course.teacher.user.username', read_only=True)
    course_name   = serializers.CharField(source='course.title', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    submission    = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'tutor_name', 'course_name', 'course',
            'title', 'description', 'file', 'attachment_url',
            'created_at', 'due_date', 'submission'
        ]
        read_only_fields = ['created_at', 'tutor_name', 'course_name', 'course']

    def get_submission(self, obj):
        request = self.context.get('request')
        if request:
            if request.user.role == 'student':
                submission = obj.submissions.filter(student=request.user.student_profile).first()
            else:
                submission = obj.submissions.first()
            if submission:
                return AssignmentSubmissionSerializer(submission, context=self.context).data
        return None

    def get_attachment_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

class StudyNoteSerializer(serializers.ModelSerializer):
    tutor_name = serializers.CharField(source='course.teacher.user.username', read_only=True)
    course_name = serializers.CharField(source='course.title', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = CourseNote
        fields = [
            'id', 'tutor_name', 'course_name', 'course',
            'title', 'file', 'file_url', 'uploaded_at'
        ]
        read_only_fields = ['uploaded_at', 'tutor_name', 'course_name', 'course']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None



class CourseSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Course
        fields = ['id', 'title', 'teacher_name', 'category_name', 'price', 'teacher_price', 'hourly_fee', 'total_duration_hours', 'status', 'is_approved']
