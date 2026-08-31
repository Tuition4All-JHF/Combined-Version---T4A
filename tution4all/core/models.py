"""
Core Application - Data Models

Defines site-wide infrastructure models:
- Notification: In-app user notifications for events (approvals, parent linking, class reminders).
- IssueReport: Academic complaint and dispute tracking filed by teachers regarding students/classes.
"""

from django.db import models
from django.conf import settings

class Notification(models.Model):
    """Real-time system notification delivered to a specific user with redirect link."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    link_url = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message}"

class IssueReport(models.Model):
    """
    Academic issue/complaint logged by teachers with configurable visibility
    (Admin only, Student and Parent, or Parent only).
    """
    VISIBILITY_CHOICES = [
        ('admin_only', 'Admin Only'),
        ('student_parent', 'Student and Parent'),
        ('parent_only', 'Parent Only'),
    ]
    
    teacher = models.ForeignKey('accounts.TeacherProfile', on_delete=models.CASCADE, related_name='reported_issues')
    course = models.ForeignKey('courses.Course', on_delete=models.CASCADE, related_name='course_issues')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_issues')
    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='parent_issues')
    
    description = models.TextField()
    file = models.FileField(upload_to='issues/', null=True, blank=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='student_parent')
    
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Issue by {self.teacher.user.username} regarding {self.student.username}"
