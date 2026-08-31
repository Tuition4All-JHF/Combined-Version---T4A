from django.core.management.base import BaseCommand
from accounts.models import User, TeacherProfile, StudentProfile, ParentProfile

class Command(BaseCommand):
    help = 'Seed database with demo data'

    def handle(self, *args, **kwargs):
        # Create Admin
        if not User.objects.filter(username='admin').exists():
            admin_user = User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
            admin_user.role = 'admin'
            admin_user.save()
            self.stdout.write(self.style.SUCCESS('Admin user created.'))

        # Create Teacher
        if not User.objects.filter(username='teacher1').exists():
            teacher_user = User.objects.create_user('teacher1', 'teacher1@example.com', 'teacher123')
            teacher_user.role = 'teacher'
            teacher_user.save()
            TeacherProfile.objects.create(user=teacher_user, is_approved=True)
            self.stdout.write(self.style.SUCCESS('Teacher user created.'))

        # Create Parent
        if not User.objects.filter(username='parent1').exists():
            parent_user = User.objects.create_user('parent1', 'parent1@example.com', 'parent123')
            parent_user.role = 'parent'
            parent_user.save()
            parent_profile = ParentProfile.objects.create(user=parent_user)
            self.stdout.write(self.style.SUCCESS('Parent user created.'))

        # Create Student
        if not User.objects.filter(username='student1').exists():
            student_user = User.objects.create_user('student1', 'student1@example.com', 'student123')
            student_user.role = 'student'
            student_user.save()
            parent = ParentProfile.objects.first()
            StudentProfile.objects.create(user=student_user, parent=parent)
            self.stdout.write(self.style.SUCCESS('Student user created.'))

        self.stdout.write(self.style.SUCCESS('Demo data seeding complete!'))
