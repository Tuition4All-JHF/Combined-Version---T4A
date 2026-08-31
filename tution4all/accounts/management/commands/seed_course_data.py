from django.core.management.base import BaseCommand
from accounts.models import User, TeacherProfile, StudentProfile
from courses.models import Category, Course, LiveClass, Enrollment
from datetime import date, time

class Command(BaseCommand):
    help = 'Seed database with demo course and live class data'

    def handle(self, *args, **kwargs):
        # Ensure base data exists
        teacher_user = User.objects.filter(username='teacher1').first()
        student_user = User.objects.filter(username='student1').first()
        
        if not teacher_user or not student_user:
            self.stdout.write(self.style.ERROR('Run seed_data first!'))
            return

        # Create Category
        category, _ = Category.objects.get_or_create(name='Academic', description='School subjects')
        
        # Create Course
        course, _ = Course.objects.get_or_create(
            title='Introduction to Mathematics',
            defaults={
                'description': 'A comprehensive math course for beginners.',
                'price': 500.00,
                'teacher': teacher_user.teacher_profile,
                'category': category
            }
        )

        # Create Enrollment
        Enrollment.objects.get_or_create(
            student=student_user.student_profile,
            course=course
        )

        # Create Live Class
        LiveClass.objects.get_or_create(
            course=course,
            title='Algebra Basics - Live Session',
            defaults={
                'date': date.today(),
                'time': time(10, 0),
                'duration': 60,
                'description': 'Interactive session to understand basic algebra.',
                'notes': 'Please keep your textbook ready.'
            }
        )

        self.stdout.write(self.style.SUCCESS('Course and Live Class seeded successfully!'))
