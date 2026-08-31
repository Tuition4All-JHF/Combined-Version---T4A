"""
Accounts Application - Web Views

Handles web-based user authentication workflows:
- User Registration: Multi-step registration for students, parents, and teachers.
  For teachers, automatically sets up course offerings, tutor profiles, introductory video,
  and uploaded verification certificates.
- User Login: Session-based login redirecting users to their role-specific dashboard.
"""

from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.views import LoginView
from django.urls import reverse_lazy
from .forms import CustomUserCreationForm

def register(request):
    """
    Handles user registration for all roles (Student, Parent, Teacher, Admin).
    
    If role == 'teacher':
    - Creates corresponding TeacherProfile and mobile TutorProfile.
    - Saves profile introductory video.
    - Creates initial Course models based on selected categories, hourly rates, and durations.
    - Attaches uploaded TeacherCertificate documents for admin verification.
    - Automatically logs in the user and redirects to the dashboard.
    """
    if request.user.is_authenticated:
        return redirect('core:dashboard')
        
    from courses.models import Category
    categories = Category.objects.all().order_by('name')
        
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()
            if user.role == 'teacher':
                from .models import TeacherCertificate
                from courses.models import Course
                
                # Handle profile video
                profile_video = request.FILES.get('profile_video')
                if profile_video:
                    user.teacher_profile.profile_video = profile_video
                    user.teacher_profile.save()
                
                # Fetch arrays of course data submitted in registration
                category_ids = request.POST.getlist('category[]')
                descriptions = request.POST.getlist('course_description[]')
                about_teachings = request.POST.getlist('about_teaching[]')
                experiences = request.POST.getlist('experience[]')
                prices = request.POST.getlist('teacher_price[]')
                hourly_fees = request.POST.getlist('hourly_fee[]')
                total_durations = request.POST.getlist('total_duration_hours[]')
                max_weekly_slots_list = request.POST.getlist('max_weekly_slots[]')
                total_amounts = request.POST.getlist('total_amount[]')
                intro_videos = request.FILES.getlist('intro_video[]')
                
                for i in range(len(category_ids)):
                    if not category_ids[i]:
                        continue
                        
                    intro_vid = request.FILES.get(f'intro_video_{i}')
                    category = Category.objects.get(id=category_ids[i])
                    price = prices[i] if i < len(prices) and prices[i] else 0.00
                    h_fee = hourly_fees[i] if i < len(hourly_fees) and hourly_fees[i] else 0.00
                    duration = total_durations[i] if i < len(total_durations) and total_durations[i] else 0
                    weekly = max_weekly_slots_list[i] if i < len(max_weekly_slots_list) and max_weekly_slots_list[i] else 1
                    t_amt = total_amounts[i] if i < len(total_amounts) and total_amounts[i] else 0.00
                    
                    course = Course.objects.create(
                        title=f"{category.name} by {user.get_full_name() or user.username}",
                        description=descriptions[i] if i < len(descriptions) else '',
                        teacher=user.teacher_profile,
                        category=category,
                        about_teaching=about_teachings[i] if i < len(about_teachings) else '',
                        experience=experiences[i] if i < len(experiences) else '',
                        teacher_price=t_amt if t_amt else price,
                        hourly_fee=h_fee,
                        total_duration_hours=duration,
                        total_amount=t_amt,
                        price=t_amt if t_amt else price,
                        intro_video=intro_vid
                    )
                    
                    from tutorsapp.models import TutorSubject
                    TutorSubject.objects.update_or_create(
                        tutor=user.tutor_profile,
                        subject=category,
                        defaults={
                            'hourly_rate': h_fee,
                            'course_duration_hours': duration
                        }
                    )
                    
                    # Save certificates associated with this course
                    cert_titles = request.POST.getlist(f'cert_title_{i}[]')
                    cert_files = request.FILES.getlist(f'cert_file_{i}[]')
                    for title, f in zip(cert_titles, cert_files):
                        if f:
                            TeacherCertificate.objects.create(
                                teacher=user.teacher_profile,
                                title=title or f.name,
                                file=f
                            )
                            
            login(request, user)
            return redirect('core:dashboard')
    else:
        form = CustomUserCreationForm()
    return render(request, 'accounts/register.html', {'form': form, 'categories': categories})

class CustomLoginView(LoginView):
    """Session login view redirecting users directly to the central dashboard dispatcher."""
    template_name = 'accounts/login.html'
    
    def get_success_url(self):
        return reverse_lazy('core:dashboard')
