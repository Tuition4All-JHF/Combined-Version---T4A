# backend/tutorsapp/serializers.py
from rest_framework import serializers
from .models import Subject, TutorProfile, TutorSubject, Booking, ChatRoom, Message, TutorScheduleSlot, Assignment, AssignmentSubmission, StudyNote
from accounts.models import User

class TutorSubjectSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='subject.id', read_only=True)
    name = serializers.CharField(source='subject.name', read_only=True)
    subject_id = serializers.IntegerField(source='subject.id', write_only=True)

    class Meta:
        model = TutorSubject
        fields = ['id', 'subject_id', 'name', 'course_duration_hours', 'hourly_rate']

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name']

class TutorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    subjects = TutorSubjectSerializer(source='tutor_subjects', many=True, read_only=True)
    profile_photo_url = serializers.SerializerMethodField()
    intro_video_url = serializers.SerializerMethodField()
    certification_url = serializers.SerializerMethodField()

    class Meta:
        model = TutorProfile
        fields = [
            'id', 'user_id', 'username', 'email', 'bio', 'qualifications',
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

class TutorScheduleSlotSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    booked_seats = serializers.SerializerMethodField()

    class Meta:
        model = TutorScheduleSlot
        fields = ['id', 'tutor', 'subject', 'subject_name', 'start_time', 'end_time', 'is_booked',
                  'session_type', 'max_students', 'booked_seats', 'batch_id', 'recurrence_type', 'batch_label']
        read_only_fields = ['tutor', 'is_booked', 'batch_id', 'recurrence_type', 'batch_label']

    def get_booked_seats(self, obj):
        return obj.bookings.count()

class BookingSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    tutor_name = serializers.CharField(source='tutor.username', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    student_id = serializers.IntegerField(source='student.id', read_only=True)
    tutor_id = serializers.IntegerField(source='tutor.id', read_only=True)
    time_slot_id = serializers.PrimaryKeyRelatedField(
        queryset=TutorScheduleSlot.objects.filter(is_booked=False),
        source='time_slot',
        write_only=True,
        required=False,
        allow_null=True
    )
    time_slot = TutorScheduleSlotSerializer(read_only=True)
    via_parent = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'student_id', 'tutor_id', 'student_name', 'tutor_name', 'subject_name',
            'time_slot', 'time_slot_id', 'start_time', 'end_time', 'notes', 'status',
            'is_live', 'created_at', 'via_parent'
        ]
        read_only_fields = ['created_at', 'student_name', 'tutor_name', 'subject_name', 'student_id', 'tutor_id', 'via_parent']

    def get_via_parent(self, obj):
        return '(Via Parent Account)' in (obj.notes or '')

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender_name', 'content', 'created_at', 'is_read']
        read_only_fields = ['created_at', 'sender_name']

class ChatRoomSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    tutor_name = serializers.CharField(source='tutor.username', read_only=True)
    parent_name = serializers.CharField(source='parent.username', read_only=True)
    student_id = serializers.IntegerField(source='student.id', read_only=True)
    tutor_id = serializers.IntegerField(source='tutor.id', read_only=True)
    parent_id = serializers.IntegerField(source='parent.id', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_id = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    tutor_photo = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'student_id', 'student_name', 'parent_id', 'parent_name', 'client_name', 'client_id', 'tutor_id', 'tutor_name', 'tutor_photo', 'last_message', 'created_at']

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
            profile = obj.tutor.tutor_profile
            if profile.profile_photo:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(profile.profile_photo.url)
        except Exception:
            pass
        return None


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentSubmission
        fields = ['id', 'assignment', 'text_answer', 'attachment', 'attachment_url', 'submitted_at']
        read_only_fields = ['assignment', 'submitted_at']

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class AssignmentSerializer(serializers.ModelSerializer):
    tutor_name    = serializers.CharField(source='tutor.username', read_only=True)
    student_name  = serializers.CharField(source='student.username', read_only=True)
    student_id    = serializers.IntegerField(source='student.id', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    submission    = AssignmentSubmissionSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = [
            'id', 'tutor_name', 'student_id', 'student_name',
            'title', 'description', 'attachment', 'attachment_url',
            'assigned_date', 'due_date', 'status', 'created_at', 'submission',
        ]
        read_only_fields = ['status', 'created_at', 'tutor_name', 'student_name', 'student_id']

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

class StudyNoteSerializer(serializers.ModelSerializer):
    tutor_name = serializers.CharField(source='tutor.username', read_only=True)
    student_name = serializers.CharField(source='student.username', read_only=True, allow_null=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = StudyNote
        fields = [
            'id', 'tutor_name', 'student', 'student_name',
            'title', 'comments', 'file', 'file_url', 'created_at'
        ]
        read_only_fields = ['created_at', 'tutor_name', 'student_name']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
