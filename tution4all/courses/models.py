"""
Courses Application - Data Models

This module defines the academic catalog, live classrooms, and coursework assets:
- Category: Subject classifications (e.g., Mathematics, Physics, Programming).
- Course: Central course entity linking teacher, category, pricing, duration, and approval status.
- Enrollment: Association between students and enrolled courses with selected weekly slots.
- LiveClass: Interactive live video classroom instance with WebRTC / Excalidraw whiteboard integration,
  AI summary generator, attendance tracking, and recurrence support.
- LiveClassBooking: Student slot reservations for private (1-to-1) or group live classes.
- RecordedClass: Video archive of classes with optional expiration dates and student assignment filters.
- ClassSummaryNote: Teacher notes and student issue/complaint logs per session.
- Attendance: Real-time student attendance status (present, absent, partial) and session duration.
- Assignment & Project: Teacher tasks with due dates, file attachments, and student assignments.
- StudentSubmission: Student uploads with teacher review workflow (submitted, accepted, rejected, resubmit).
- CourseNote: General study materials and lecture handouts.
- WhiteboardState: Real-time drawing state persistent across live sessions.
"""

from django.db import models
from accounts.models import TeacherProfile, StudentProfile
import uuid

class Category(models.Model):
    """Subject category for courses and tutor subject specialization."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class Course(models.Model):
    """
    Primary Course model.
    Represents an educational offering published by a teacher and vetted by an admin.
    """
    title = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Final Price set by Admin")
    teacher_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Price requested by Teacher")
    features = models.TextField(blank=True, null=True, help_text="Enter features separated by newlines")
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name='courses')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='courses')
    thumbnail = models.ImageField(upload_to='course_thumbnails/', blank=True, null=True)
    intro_video = models.FileField(upload_to='course_intro_videos/', blank=True, null=True)
    skills = models.TextField(blank=True, null=True, help_text="Skills taught in this course")
    about_teaching = models.TextField(blank=True, null=True, help_text="About your teaching style")
    experience = models.TextField(blank=True, null=True, help_text="Experience relevant to this course")
    
    hourly_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Hourly fee per student")
    admin_hourly_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Final hourly fee for teacher set by Admin")
    total_duration_hours = models.IntegerField(default=0, help_text="Total duration in hours")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Total Amount")

    @property
    def teacher_total_amount(self):
        """Calculate total amount based on teacher's hourly fee and total duration"""
        return self.total_duration_hours * self.hourly_fee
        
    @property
    def get_hourly_rate(self):
        """Calculates hourly rate from price (Total Amount) and duration."""
        if self.total_duration_hours and self.total_duration_hours > 0:
            return float(self.price) / self.total_duration_hours
        if self.hourly_fee and self.hourly_fee > 0:
            return float(self.hourly_fee)
        return 0.0
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    is_approved = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_comment = models.TextField(blank=True, null=True, help_text="Comments from Admin regarding approval, pricing, or rejection")
    is_frozen = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.category:
            return
        from tutorsapp.models import TutorProfile, TutorSubject
        try:
            tutor = TutorProfile.objects.get(user=self.teacher.user)
            ts, created = TutorSubject.objects.get_or_create(
                tutor=tutor,
                subject=self.category,
                defaults={
                    'course_duration_hours': self.total_duration_hours,
                    'hourly_rate': self.hourly_fee,
                    'is_approved': self.is_approved
                }
            )
            updated = False
            if ts.is_approved != self.is_approved:
                ts.is_approved = self.is_approved
                updated = True
            if ts.course_duration_hours != self.total_duration_hours:
                ts.course_duration_hours = self.total_duration_hours
                updated = True
            if ts.hourly_rate != self.hourly_fee:
                ts.hourly_rate = self.hourly_fee
                updated = True
            
            if updated:
                ts.save()
        except Exception as e:
            print(f"Error syncing Course to TutorSubject: {e}")

class Enrollment(models.Model):
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    date_enrolled = models.DateTimeField(auto_now_add=True)
    # Snapshot of selected weekly slots (e.g., ['Monday', 'Wednesday'])
    selected_weekly_slots = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ('student', 'course')

    def __str__(self):
        return f"{self.student.user.username} - {self.course.title}"

import uuid
import hashlib
import base64
from django.conf import settings

class LiveClass(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='live_classes')
    title = models.CharField(max_length=200, default="Live Session")
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    max_capacity = models.IntegerField(default=1)
    is_ended = models.BooleanField(default=False)
    room_name = models.CharField(max_length=100, unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    notes = models.TextField(null=True, blank=True)
    actual_start_time = models.DateTimeField(null=True, blank=True)
    actual_end_time = models.DateTimeField(null=True, blank=True)
    transcript = models.TextField(null=True, blank=True, help_text="Auto-generated class transcript")
    ai_summary = models.TextField(null=True, blank=True, help_text="AI generated summary of the transcript")
    transcript_visible = models.BooleanField(default=False)
    transcript_expires_at = models.DateTimeField(null=True, blank=True)
    
    is_on_break = models.BooleanField(default=False)
    break_started_at = models.DateTimeField(null=True, blank=True)
    
    CLASS_TYPE_CHOICES = (
        ('private', 'Private (1-to-1)'),
        ('public', 'Public (Group)'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    class_type = models.CharField(max_length=10, choices=CLASS_TYPE_CHOICES, default='private')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='approved')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Final price for public class")
    teacher_requested_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Requested price by teacher")
    admin_comment = models.TextField(blank=True, null=True)
    recurring_group_id = models.CharField(max_length=100, blank=True, null=True, help_text="Groups recurring slots together")
    is_free = models.BooleanField(default=False, help_text="True if this is a free/demo class")

    def save(self, *args, **kwargs):
        if not self.room_name:
            self.room_name = f"room_{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} - {self.course.title}"
        
    @property
    def excalidraw_room_id(self):
        hash_str = hashlib.md5(f"room_{self.id}_{settings.SECRET_KEY}".encode()).hexdigest()
        return hash_str[:20]

    @property
    def excalidraw_room_key(self):
        hash_bytes = hashlib.sha256(f"key_{self.id}_{settings.SECRET_KEY}".encode()).digest()
        b64 = base64.urlsafe_b64encode(hash_bytes).decode('utf-8').rstrip('=')
        return b64[:22].ljust(22, 'a')

    @property
    def scheduled_end_time(self):
        return self.end_time

    @property
    def has_started(self):
        from django.utils import timezone
        if self.start_time and self.start_time < timezone.now():
            return True
        return False

    @property
    def has_ended(self):
        from django.utils import timezone
        if self.is_ended:
            return True
        if self.end_time and self.end_time < timezone.now():
            return True
        return False
        
    @property
    def duration(self):
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)
        return 0



class RecordedClass(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='recorded_classes')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    video = models.FileField(upload_to='recorded_videos/', blank=True, null=True)
    attachment1 = models.FileField(upload_to='recorded_notes/', blank=True, null=True)
    attachment2 = models.FileField(upload_to='recorded_ppts/', blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_visible_to_students = models.BooleanField(default=False)
    
    live_class = models.OneToOneField('LiveClass', on_delete=models.SET_NULL, null=True, blank=True, related_name='recording')
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Time after which students can no longer view this recording")
    
    assigned_to_all = models.BooleanField(default=True)
    assigned_students = models.ManyToManyField('accounts.StudentProfile', blank=True, related_name='assigned_recorded_classes')

    def __str__(self):
        return self.title

class ClassSummaryNote(models.Model):
    VISIBILITY_CHOICES = (
        ('teacher_only', 'Teacher Only (Private)'),
        ('parents_only', 'Parents Only'),
        ('students_only', 'Booked Students Only'),
        ('everyone', 'Everyone (Teacher, Parents, Students)'),
    )
    NOTE_TYPE_CHOICES = (
        ('regular', 'Study Material / Note'),
        ('complaint', 'Complaint / Issue'),
    )
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='summary_notes')
    content = models.TextField()
    file = models.FileField(upload_to='class_notes/', blank=True, null=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='everyone')
    note_type = models.CharField(max_length=20, choices=NOTE_TYPE_CHOICES, default='regular')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Note for {self.live_class.title}"

class Attendance(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('partial', 'Partial'),
    )
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='attendances')
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='attendances')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent')
    from django.utils import timezone
    joined_at = models.DateTimeField(default=timezone.now)
    exited_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'live_class')

    def __str__(self):
        return f"{self.student.user.username} - {self.live_class.title} - {self.status}"

class Assignment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='assignments/', blank=True, null=True)
    due_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    assigned_to_all = models.BooleanField(default=True)
    assigned_students = models.ManyToManyField('accounts.StudentProfile', blank=True, related_name='assigned_assignments')

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        from django.utils import timezone
        return timezone.now() > self.due_date

    @property
    def due_soon(self):
        from django.utils import timezone
        from datetime import timedelta
        now = timezone.now()
        return self.due_date > now and (self.due_date - now) <= timedelta(days=2)

class Project(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='projects/', blank=True, null=True)
    due_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    assigned_to_all = models.BooleanField(default=True)
    assigned_students = models.ManyToManyField('accounts.StudentProfile', blank=True, related_name='assigned_projects')

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        from django.utils import timezone
        return timezone.now() > self.due_date

    @property
    def due_soon(self):
        from django.utils import timezone
        from datetime import timedelta
        now = timezone.now()
        return self.due_date > now and (self.due_date - now) <= timedelta(days=2)

class CourseNote(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='notes')
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='course_notes/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    assigned_to_all = models.BooleanField(default=True)
    assigned_students = models.ManyToManyField('accounts.StudentProfile', blank=True, related_name='assigned_course_notes')

    def __str__(self):
        return self.title

class WhiteboardState(models.Model):
    live_class = models.OneToOneField(LiveClass, on_delete=models.CASCADE, related_name='whiteboard')
    drawing_data = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Whiteboard for {self.live_class.title}"

class StudentSubmission(models.Model):
    STATUS_CHOICES = (
        ('submitted', 'Submitted (Under Review)'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('resubmit', 'Needs Resubmission')
    )
    student = models.ForeignKey('accounts.StudentProfile', on_delete=models.CASCADE, related_name='submissions')
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions', null=True, blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='submissions', null=True, blank=True)
    file = models.FileField(upload_to='submissions/')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    teacher_comments = models.TextField(blank=True, null=True)
    student_notes = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        item = self.assignment.title if self.assignment else self.project.title
        return f"{self.student.user.username} - {item} - {self.status}"
class LiveClassBooking(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed')
    )
    student = models.ForeignKey('accounts.StudentProfile', on_delete=models.CASCADE, related_name='live_class_bookings')
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='bookings')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    cancellation_reason = models.TextField(blank=True, null=True)
    booking_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.user.username} booked {self.live_class}"
