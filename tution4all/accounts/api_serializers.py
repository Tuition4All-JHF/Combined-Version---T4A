from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from .models import User, ParentProfile, ParentStudentLinkRequest, StudentProfile
from tutorsapp.models import TutorProfile
import json

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token

    def validate(self, attrs):
        from .models import User
        from rest_framework.exceptions import AuthenticationFailed
        username_field = User.USERNAME_FIELD
        username = attrs.get(username_field)
        
        # Check if the user is frozen before super().validate throws "No active account found"
        if username:
            try:
                user = User.objects.get(**{username_field: username})
                if user.is_frozen:
                    raise AuthenticationFailed("This account cannot be logged in to due to non-compliance with our Terms and Conditions.")
            except User.DoesNotExist:
                pass
                
        return super().validate(attrs)
class UserSerializer(serializers.ModelSerializer):
    qualifications = serializers.CharField(write_only=True, required=False, allow_blank=True)
    subjects = serializers.CharField(write_only=True, required=False, allow_blank=True)
    certification = serializers.FileField(write_only=True, required=False)
    
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    # Tutor profile additional fields
    bio = serializers.CharField(write_only=True, required=False, allow_blank=True)
    experience_years = serializers.IntegerField(write_only=True, required=False, default=0)
    profile_photo = serializers.ImageField(write_only=True, required=False)
    intro_video = serializers.FileField(write_only=True, required=False)

    # Courses data (JSON string containing array of courses)
    courses_data = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'password', 'first_name', 'last_name', 'phone_number', 'qualifications', 'subjects', 'certification', 'student_uid', 'bio', 'experience_years', 'profile_photo', 'intro_video', 'courses_data')
        extra_kwargs = {'password': {'write_only': True}}
        read_only_fields = ('student_uid',)

    def create(self, validated_data):
        qualifications = validated_data.pop('qualifications', '')
        subjects_data = validated_data.pop('subjects', '[]')
        certification = validated_data.pop('certification', None)
        
        bio = validated_data.pop('bio', '')
        experience_years = validated_data.pop('experience_years', 0)
        profile_photo = validated_data.pop('profile_photo', None)
        intro_video = validated_data.pop('intro_video', None)
        
        if 'request' in self.context:
            request = self.context['request']
            if not intro_video:
                intro_video = request.FILES.get('intro_video')
            if not profile_photo:
                profile_photo = request.FILES.get('profile_photo')
            if not certification:
                certification = request.FILES.get('certification')
        
        courses_data = validated_data.pop('courses_data', '[]')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', User.Role.STUDENT),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', '')
        )

        if user.role == User.Role.TUTOR:
            tutor_profile = TutorProfile.objects.create(
                user=user,
                qualifications=qualifications,
                certification=certification,
                bio=bio,
                experience_years=experience_years,
                profile_photo=profile_photo,
                intro_video=intro_video
            )
            
            # Sync these to the automatically created TeacherProfile as well
            if hasattr(user, 'teacher_profile'):
                tp = user.teacher_profile
                tp.bio = bio
                tp.experience = f"{experience_years} years"
                tp.qualification = qualifications
                if profile_photo: tp.photo = profile_photo
                if intro_video: tp.profile_video = intro_video
                tp.save()
            
            # Process multiple courses
            import json
            from courses.models import Course, Category
            try:
                courses = json.loads(courses_data)
            except Exception:
                courses = []

            for i, c_data in enumerate(courses):
                cat_id = c_data.get('categoryId')
                if not cat_id:
                    continue
                try:
                    category = Category.objects.get(id=cat_id)
                    
                    # Extract files from context request if available
                    request = self.context.get('request')
                    course_intro_video = None
                    if request and hasattr(request, 'FILES'):
                        course_intro_video = request.FILES.get(f'course_{i}_intro_video')
                    
                    total_amt = c_data.get('totalAmount', 0.00)
                    t_price = c_data.get('teacherPrice', 0.00)
                    hourly_fee_val = c_data.get('hourlyFee', 0.00)
                    duration_val = c_data.get('totalDurationHours', 0)
                    
                    Course.objects.create(
                        title=f"{category.name} by {user.get_full_name() or user.username}",
                        description=c_data.get('description', ''),
                        teacher=user.teacher_profile,
                        category=category,
                        about_teaching=c_data.get('aboutTeaching', ''),
                        skills=c_data.get('skills', ''),
                        experience=c_data.get('experience', ''),
                        teacher_price=total_amt if total_amt else t_price,
                        hourly_fee=hourly_fee_val,
                        total_duration_hours=duration_val,
                        total_amount=total_amt,
                        price=total_amt if total_amt else t_price,
                        intro_video=course_intro_video
                    )

                    from tutorsapp.models import TutorSubject
                    TutorSubject.objects.update_or_create(
                        tutor=user.tutor_profile,
                        subject=category,
                        defaults={
                            'hourly_rate': hourly_fee_val,
                            'course_duration_hours': duration_val
                        }
                    )
                    
                    if request and hasattr(request, 'FILES'):
                        from accounts.models import TeacherCertificate
                        cert_index = 0
                        while True:
                            cert_file = request.FILES.get(f'course_{i}_cert_file_{cert_index}')
                            if not cert_file:
                                break
                            cert_name = request.POST.get(f'course_{i}_cert_name_{cert_index}', 'Certificate')
                            TeacherCertificate.objects.create(
                                teacher=user.teacher_profile,
                                title=cert_name,
                                file=cert_file
                            )
                            cert_index += 1
                except Category.DoesNotExist:
                    pass
            
            try:
                # Expecting a JSON array of subject IDs, e.g., "[1, 2, 3]"
                subject_ids = json.loads(subjects_data)
                for subject_id in subject_ids:
                    tutor_profile.subjects.add(subject_id)
            except Exception as e:
                print(f"Error parsing subjects: {e}, data: {subjects_data}")
                pass
        
        elif user.role == User.Role.PARENT:
            ParentProfile.objects.create(user=user)
        elif user.role == User.Role.STUDENT:
            StudentProfile.objects.create(user=user)

        return user


class LinkRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.username', read_only=True)
    parent_name = serializers.CharField(source='parent.user.username', read_only=True)

    class Meta:
        model = ParentStudentLinkRequest
        fields = ['id', 'student', 'student_name', 'parent', 'parent_name', 'status', 'created_at']
        read_only_fields = ['student', 'parent', 'status', 'created_at']
