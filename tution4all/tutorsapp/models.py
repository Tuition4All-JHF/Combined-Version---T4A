"""
TutorsApp Application - Data Models

Defines tutor specialization, mobile application schemas, and subject rates:
- TutorProfile: Extended tutor credentials, years of experience, and verification lifecycle.
- TutorSubject: Through-model connecting tutors with subjects, hourly rates, and duration.
- Booking & Attendance wrappers for mobile clients.
"""

from django.db import models
from django.conf import settings
from courses.models import Category

class TutorProfile(models.Model):
    """One-to-one extension of the custom User for tutors in the mobile platform."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tutor_profile'
    )
    bio = models.TextField(blank=True)
    qualifications = models.TextField(blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    subjects = models.ManyToManyField(Category, related_name='tutors', through='TutorSubject')
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

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from accounts.models import TeacherProfile
        try:
            teacher, created = TeacherProfile.objects.get_or_create(user=self.user)
            updated = False
            
            # Sync approval status
            if self.verification_status == self.VerificationStatus.APPROVED and not teacher.is_approved:
                teacher.is_approved = True
                updated = True
            elif self.verification_status != self.VerificationStatus.APPROVED and teacher.is_approved:
                teacher.is_approved = False
                updated = True
                
            # Basic info sync
            if self.bio and not teacher.bio:
                teacher.bio = self.bio
                updated = True
            if self.qualifications and not teacher.qualification:
                teacher.qualification = self.qualifications
                updated = True
                
            if updated:
                teacher.save()
        except Exception as e:
            print(f"Error syncing TutorProfile to TeacherProfile: {e}")

class TutorSubject(models.Model):
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name='tutor_subjects')
    subject = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='tutor_details')
    course_duration_hours = models.PositiveIntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.0)
    is_approved = models.BooleanField(default=False)

    class Meta:
        unique_together = ('tutor', 'subject')

    def __str__(self):
        return f"{self.tutor.user.username} - {self.subject.name}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from courses.models import Course
        from accounts.models import TeacherProfile
        try:
            teacher, t_created = TeacherProfile.objects.get_or_create(user=self.tutor.user)
            course, created = Course.objects.get_or_create(
                teacher=teacher,
                category=self.subject,
                defaults={
                    'title': f"{self.subject.name} Course",
                    'description': f"Tutoring for {self.subject.name}",
                    'hourly_fee': self.hourly_rate,
                    'total_duration_hours': self.course_duration_hours,
                    'price': float(self.hourly_rate) * self.course_duration_hours,
                    'teacher_price': float(self.hourly_rate) * self.course_duration_hours,
                    'status': 'approved' if self.is_approved else 'pending',
                    'is_approved': self.is_approved
                }
            )
            updated = False
            if course.is_approved != self.is_approved:
                course.is_approved = self.is_approved
                course.status = 'approved' if self.is_approved else 'pending'
                updated = True
            if course.hourly_fee != self.hourly_rate:
                course.hourly_fee = self.hourly_rate
                # Update price if hourly rate changes
                course.teacher_price = float(self.hourly_rate) * self.course_duration_hours
                course.price = course.teacher_price
                updated = True
            if course.total_duration_hours != self.course_duration_hours:
                course.total_duration_hours = self.course_duration_hours
                course.teacher_price = float(self.hourly_rate) * self.course_duration_hours
                course.price = course.teacher_price
                updated = True
                
            if updated:
                course.save()
        except Exception as e:
            print(f"Error syncing TutorSubject to Course: {e}")

# ─── AI Chat System ───────────────────────────────────────────────────────────
