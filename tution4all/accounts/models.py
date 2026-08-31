"""
Accounts Application - Data Models

This module defines custom user authentication and role-based profiles for Tuition4All:
- User: Custom AbstractUser with 4 core roles (admin, teacher, student, parent).
- TeacherProfile: Tutor credentials, qualification, approval status, and intro video.
- TeacherCertificate: Uploaded qualification certificates pending admin verification.
- StudentProfile: Student details, unique student UID, and linked parent association.
- ParentProfile: Parent details and many-to-many links to student children.
- ParentStudentLinkRequest / LinkRequest: Invitation flow for parents to link student accounts.
- TeacherReview: Student ratings (1-5 stars) and feedback for teachers.
"""

import random
from django.db import models
from django.contrib.auth.models import AbstractUser

def generate_student_uid():
    """Generates a unique random student ID formatted as STU-XXXXXX."""
    return f"STU-{random.randint(100000, 999999)}"

class User(AbstractUser):
    """
    Custom user model supporting 4 primary system roles:
    - ADMIN: Full administrative control, approval of tutors/courses.
    - TEACHER: Conducts live classes, uploads notes/assignments, manages courses.
    - STUDENT: Enrolls in courses, attends live sessions, submits assignments.
    - PARENT: Monitors linked student attendance, academic progress, and analytics.
    """
    class Role:
        STUDENT = 'student'
        TUTOR = 'teacher'
        ADMIN = 'admin'
        PARENT = 'parent'

    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('parent', 'Parent'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)
    
    # Auto-generated unique identifier for student accounts
    student_uid = models.CharField(max_length=10, blank=True, null=True, unique=True)
    # Administrative freeze flag (restricts account access if True)
    is_frozen = models.BooleanField(default=False)
    
    def save(self, *args, **kwargs):
        """Auto-assigns unique STU-XXXXXX ID when a student account is created."""
        if self.role == self.Role.STUDENT and not self.student_uid:
            while True:
                uid = generate_student_uid()
                if not User.objects.filter(student_uid=uid).exists():
                    self.student_uid = uid
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class TeacherProfile(models.Model):
    """
    Extended profile for teachers/tutors.
    Synchronizes verification status and credentials with the mobile TutorProfile.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    photo = models.ImageField(upload_to='teacher_photos/', null=True, blank=True)
    qualification = models.CharField(max_length=255, null=True, blank=True)
    experience = models.TextField(null=True, blank=True)
    subjects = models.CharField(max_length=255, null=True, blank=True)
    bio = models.TextField(null=True, blank=True)
    profile_video = models.FileField(upload_to='teacher_videos/', null=True, blank=True)
    profile_video_approved = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=False)

    @property
    def pending_courses_count(self):
        """Returns the number of courses awaiting admin approval."""
        return self.courses.filter(is_approved=False).count()

    def save(self, *args, **kwargs):
        """Saves TeacherProfile and bi-directionally syncs approval status to TutorProfile."""
        super().save(*args, **kwargs)
        from tutorsapp.models import TutorProfile
        try:
            tutor, created = TutorProfile.objects.get_or_create(user=self.user)
            updated = False
            
            # Sync approval status
            if self.is_approved and tutor.verification_status != TutorProfile.VerificationStatus.APPROVED:
                tutor.verification_status = TutorProfile.VerificationStatus.APPROVED
                updated = True
            elif not self.is_approved and tutor.verification_status == TutorProfile.VerificationStatus.APPROVED:
                tutor.verification_status = TutorProfile.VerificationStatus.PENDING
                updated = True
                
            # Basic info sync
            if self.bio and not tutor.bio:
                tutor.bio = self.bio
                updated = True
            if self.qualification and not tutor.qualifications:
                tutor.qualifications = self.qualification
                updated = True
                
            if updated:
                tutor.save()
        except Exception as e:
            print(f"Error syncing TeacherProfile to TutorProfile: {e}")

    def __str__(self):
        return self.user.username

class TeacherCertificate(models.Model):
    """Uploaded academic/professional certificates submitted by teachers for verification."""
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name='certificates')
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='teacher_certificates/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.title} - {self.teacher.user.username}"

class ParentProfile(models.Model):
    """Extended profile for parents to supervise their linked children."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='parent_profile')
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    children = models.ManyToManyField(
        User, related_name='parents', limit_choices_to={'role': 'student'}, blank=True
    )

    def __str__(self):
        return self.user.username

class StudentProfile(models.Model):
    """Extended profile for students with unique student ID and optional parent link."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    photo = models.ImageField(upload_to='student_photos/', null=True, blank=True)
    parent = models.ForeignKey(ParentProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='student_children')
    grade_level = models.CharField(max_length=50, null=True, blank=True)
    student_id = models.CharField(max_length=20, unique=True, blank=True)

    def save(self, *args, **kwargs):
        """Mirrors the student's unique UID from the User model."""
        if self.user and self.user.student_uid:
            self.student_id = self.user.student_uid
        super().save(*args, **kwargs)

    def __str__(self):
        return self.user.username

class TeacherReview(models.Model):
    """Student feedback and rating (1-5 stars) for a teacher."""
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name='reviews')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='reviews_given')
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    feedback = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('teacher', 'student')

    def __str__(self):
        return f"{self.rating} stars for {self.teacher.user.username} by {self.student.user.username}"

class ParentStudentLinkRequest(models.Model):
    """Web portal linking request sent by a parent to a student using Student ID."""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    parent = models.ForeignKey(ParentProfile, on_delete=models.CASCADE, related_name='link_requests_sent')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='link_requests_received')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('parent', 'student')

    def __str__(self):
        return f"{self.parent.user.username} -> {self.student.user.username} ({self.status})"

class LinkRequest(models.Model):
    """Mobile API linking request model used in REST endpoints."""
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    parent = models.ForeignKey(User, related_name='sent_link_requests', on_delete=models.CASCADE)
    student = models.ForeignKey(User, related_name='received_link_requests', on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('parent', 'student')

    def __str__(self):
        return f"LinkRequest: {self.parent.username} -> {self.student.username} ({self.status})"

