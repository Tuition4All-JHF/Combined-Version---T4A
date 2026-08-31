from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User, StudentProfile, TeacherProfile, ParentProfile



class CustomUserCreationForm(UserCreationForm):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('parent', 'Parent'),
    )
    role = forms.ChoiceField(
        choices=ROLE_CHOICES, 
        required=True, 
        widget=forms.HiddenInput(attrs={'id': 'id_role'})
    )
    
    # Teacher specific fields have been moved to manual handling in the view/template

    class Meta(UserCreationForm.Meta):
        model = User
        fields = UserCreationForm.Meta.fields + ('email', 'first_name', 'last_name', 'phone_number', 'photo', 'role')
        labels = {
            'photo': 'Profile Photo'
        }

    def save(self, commit=True):
        user = super().save(commit=False)
        user.role = self.cleaned_data.get('role')
        if commit:
            user.save()
            if user.role == 'student':
                StudentProfile.objects.create(user=user, photo=user.photo)
            elif user.role == 'teacher':
                profile = TeacherProfile.objects.create(user=user, photo=user.photo)
            elif user.role == 'parent':
                ParentProfile.objects.create(user=user)
        return user
