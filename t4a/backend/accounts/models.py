from django.contrib.auth.models import AbstractUser
from django.db import models
import random

def generate_student_uid():
    return f"STU-{random.randint(100000, 999999)}"


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        TUTOR = 'TUTOR', 'Tutor'
        ADMIN = 'ADMIN', 'Admin'
        PARENT = 'PARENT', 'Parent'

    role = models.CharField(max_length=50, choices=Role.choices, default=Role.STUDENT)
    student_uid = models.CharField(max_length=10, blank=True, null=True, unique=True)
    is_frozen = models.BooleanField(default=False)
    
    def save(self, *args, **kwargs):
        if self.role == self.Role.STUDENT and not self.student_uid:
            # Generate a unique uid
            while True:
                uid = generate_student_uid()
                if not User.objects.filter(student_uid=uid).exists():
                    self.student_uid = uid
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"

class ParentProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='parent_profile'
    )
    children = models.ManyToManyField(
        User, related_name='parents', limit_choices_to={'role': 'STUDENT'}, blank=True
    )

    def __str__(self):
        return f"{self.user.username} - Parent"

class LinkRequest(models.Model):
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
