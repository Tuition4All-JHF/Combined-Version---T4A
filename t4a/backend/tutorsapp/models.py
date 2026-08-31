# backend/tutorsapp/models.py
from django.db import models
from django.conf import settings

class Subject(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class TutorProfile(models.Model):
    """One-to-one extension of the custom User for tutors."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tutor_profile'
    )
    bio = models.TextField(blank=True)
    qualifications = models.TextField(blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    subjects = models.ManyToManyField(Subject, related_name='tutors', through='TutorSubject')
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    certification = models.FileField(upload_to='certifications/', blank=True, null=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
    intro_video = models.FileField(upload_to='intro_videos/', blank=True, null=True)

    class VerificationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    verification_status = models.CharField(
        max_length=15, 
        choices=VerificationStatus.choices, 
        default=VerificationStatus.PENDING
    )

    def __str__(self):
        return f"{self.user.username} – Tutor"

class TutorSubject(models.Model):
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='tutor_subjects')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='tutor_details')
    course_duration_hours = models.PositiveIntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.0)

    class Meta:
        unique_together = ('tutor', 'subject')

    def __str__(self):
        return f"{self.tutor.user.username} - {self.subject.name}"

class TutorScheduleSlot(models.Model):
    class RecurrenceType(models.TextChoices):
        NONE = 'NONE', 'None'
        WEEKLY = 'WEEKLY', 'Weekly'
        MONTHLY = 'MONTHLY', 'Monthly'

    class SessionType(models.TextChoices):
        ONE_TO_ONE = 'ONE_TO_ONE', 'One-to-One'
        ONE_TO_MANY = 'ONE_TO_MANY', 'One-to-Many'

    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='schedule_slots'
    )
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_booked = models.BooleanField(default=False)
    
    session_type = models.CharField(
        max_length=15,
        choices=SessionType.choices,
        default=SessionType.ONE_TO_ONE
    )
    max_students = models.PositiveIntegerField(default=1)
    
    batch_id = models.CharField(max_length=100, blank=True, null=True)
    recurrence_type = models.CharField(max_length=10, choices=RecurrenceType.choices, default=RecurrenceType.NONE)
    batch_label = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"{self.tutor.username} ({self.start_time.strftime('%Y-%m-%d %H:%M')} - {self.end_time.strftime('%H:%M')})"

class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        COMPLETED = 'COMPLETED', 'Completed'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_bookings'
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tutor_bookings'
    )
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True)
    time_slot = models.ForeignKey(TutorScheduleSlot, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    is_live = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.username} → {self.tutor.username}"

class ChatRoom(models.Model):
    """A private chat room between a student (or parent) and a tutor."""
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_chats', null=True, blank=True
    )
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='parent_chats', null=True, blank=True
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tutor_chats'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('student', 'tutor'), ('parent', 'tutor'))

    def __str__(self):
        client_name = self.student.username if self.student else (self.parent.username if self.parent else "Unknown")
        return f"Chat: {client_name} ↔ {self.tutor.username}"

class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:40]}"

class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'

    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment for {self.booking} - {self.status}"

class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'PRESENT', 'Present'
        PARTIAL = 'PARTIAL', 'Partial'
        ABSENT = 'ABSENT', 'Absent'

    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='attendance')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendances')
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ABSENT)
    total_attended_seconds = models.PositiveIntegerField(default=0)
    missed_seconds = models.PositiveIntegerField(default=0)
    total_duration_seconds = models.PositiveIntegerField(default=0)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attendance {self.status} - {self.student.username} (Booking: {self.booking.id})"

class AttendanceLog(models.Model):
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name='logs')
    join_time = models.DateTimeField(auto_now_add=True)
    leave_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Log for {self.attendance.student.username} - Join: {self.join_time}"


# ─── Assignment System ────────────────────────────────────────────────────────

class Assignment(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        COMPLETED = 'COMPLETED', 'Completed'

    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='created_assignments'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='received_assignments'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to='assignments/tutor/', blank=True, null=True
    )
    assigned_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.title} → {self.student.username}"


class AssignmentSubmission(models.Model):
    assignment = models.OneToOneField(
        Assignment, on_delete=models.CASCADE, related_name='submission'
    )
    text_answer = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to='assignments/student/', blank=True, null=True
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission for: {self.assignment.title} by {self.assignment.student.username}"

# ─── Study Notes System ───────────────────────────────────────────────────────

class StudyNote(models.Model):
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='uploaded_notes'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='received_notes', null=True, blank=True
    )
    title = models.CharField(max_length=255)
    comments = models.TextField(blank=True, help_text="Optional comments or description.")
    file = models.FileField(upload_to='study_notes/')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} by {self.tutor.username}"

# ─── AI Chat System ───────────────────────────────────────────────────────────

class AIChatSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_chat_sessions')
    title = models.CharField(max_length=255, default="New Chat")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Chat: {self.title} by {self.user.username}"


class AIChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'
        SYSTEM = 'system', 'System'

    session = models.ForeignKey(AIChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=15, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role} at {self.created_at}"

