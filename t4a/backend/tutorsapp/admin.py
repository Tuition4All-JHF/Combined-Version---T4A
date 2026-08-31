from django.contrib import admin
from .models import Assignment, AssignmentSubmission


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'tutor', 'student', 'assigned_date', 'due_date', 'status', 'created_at']
    list_filter  = ['status', 'due_date']
    search_fields = ['title', 'tutor__username', 'student__username']


@admin.register(AssignmentSubmission)
class AssignmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'assignment', 'submitted_at']
    search_fields = ['assignment__title']
