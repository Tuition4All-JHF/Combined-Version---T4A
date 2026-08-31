from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from .models import User, ParentProfile, LinkRequest
from tutorsapp.models import TutorProfile, Subject
import json

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.is_frozen:
            raise AuthenticationFailed("This account cannot be logged in due to some incompliance of our terms and conditions")
        return data


class UserSerializer(serializers.ModelSerializer):
    qualifications = serializers.CharField(write_only=True, required=False, allow_blank=True)
    subjects = serializers.CharField(write_only=True, required=False, allow_blank=True)
    certification = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'password', 'qualifications', 'subjects', 'certification', 'student_uid')
        extra_kwargs = {'password': {'write_only': True}}
        read_only_fields = ('student_uid',)

    def create(self, validated_data):
        qualifications = validated_data.pop('qualifications', '')
        subjects_data = validated_data.pop('subjects', '[]')
        certification = validated_data.pop('certification', None)
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', User.Role.STUDENT)
        )

        if user.role == User.Role.TUTOR:
            tutor_profile = TutorProfile.objects.create(
                user=user,
                qualifications=qualifications,
                certification=certification
            )
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

        return user


class LinkRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    parent_name = serializers.CharField(source='parent.username', read_only=True)

    class Meta:
        model = LinkRequest
        fields = ['id', 'student', 'student_name', 'parent', 'parent_name', 'status', 'created_at']
        read_only_fields = ['student', 'parent', 'status', 'created_at']
