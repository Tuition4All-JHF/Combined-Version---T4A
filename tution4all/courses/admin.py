from django.contrib import admin
from .models import Category, Course, Enrollment, LiveClass

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'teacher', 'category', 'price', 'is_approved')
    list_filter = ('is_approved', 'category')
    search_fields = ('title', 'teacher__user__username')

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'date_enrolled')
    list_filter = ('date_enrolled',)

@admin.register(LiveClass)
class LiveClassAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'start_time', 'end_time', 'max_capacity', 'is_ended')
    list_filter = ('is_ended', 'course')
    search_fields = ('title', 'course__title', 'room_name')
