from django import forms
from .models import Course

class CourseForm(forms.ModelForm):
    class Meta:
        model = Course
        fields = ['title', 'category', 'description', 'teacher_price', 'features', 'thumbnail']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'category': forms.Select(attrs={'class': 'form-select'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'teacher_price': forms.NumberInput(attrs={'class': 'form-control'}),
            'features': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Lifetime Access\nLive Interactive Sessions\nCertificate of Completion'}),
            'thumbnail': forms.FileInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'teacher_price': 'Your Expected Price',
            'features': 'Course Features (One per line)'
        }
