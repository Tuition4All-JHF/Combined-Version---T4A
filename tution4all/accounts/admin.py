from django.contrib import admin
from .models import StudentProfile, TeacherProfile, ParentProfile

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'student_id')
    search_fields = ('user__username', 'user__email', 'student_id')

@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_approved')
    list_filter = ('is_approved',)
    search_fields = ('user__username', 'user__email')

@admin.register(ParentProfile)
class ParentProfileAdmin(admin.ModelAdmin):
    list_display = ('user',)
    search_fields = ('user__username', 'user__email')
