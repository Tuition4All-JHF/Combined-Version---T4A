"""
Accounts Application - REST API Views

Provides JWT-authenticated API endpoints primarily for the Mobile Application:
- CustomTokenObtainPairView: Custom JWT login returning tokens and user payload.
- RegisterView: Mobile user registration.
- UserDetailView: Fetch profile details of the authenticated user.
- LinkStudentView: Parent endpoint to initiate student linking via Student ID.
- StudentLinkRequestsView: Student endpoint to list pending link requests.
- LinkRequestActionView: Student endpoint to approve or reject a link request.
- ParentChildrenView: Parent endpoint to list linked children.
"""

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.shortcuts import get_object_or_404
from .api_serializers import UserSerializer, LinkRequestSerializer, CustomTokenObtainPairSerializer
from .models import User, ParentProfile, ParentStudentLinkRequest

class CustomTokenObtainPairView(TokenObtainPairView):
    """Generates JWT token pair (access & refresh) enriched with custom user role details."""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """Mobile API endpoint for user account registration."""
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

class UserDetailView(generics.RetrieveAPIView):
    """Retrieves authenticated user's profile information."""
    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

class LinkStudentView(APIView):
    """
    Parent-only endpoint: Sends a linking request to a student account using student_uid.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.PARENT:
            return Response({'error': 'Only parents can link students.'}, status=status.HTTP_403_FORBIDDEN)
        
        student_uid = request.data.get('student_uid')
        if not student_uid:
            return Response({'error': 'Student ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            student = User.objects.get(student_uid=student_uid, role=User.Role.STUDENT)
        except User.DoesNotExist:
            return Response({'error': 'Student not found with that ID.'}, status=status.HTTP_404_NOT_FOUND)
        
        parent_profile = request.user.parent_profile
        if parent_profile.children.filter(id=student.id).exists():
            return Response({'error': 'Student is already linked to your account.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Create or update link request to pending
        link_request, created = ParentStudentLinkRequest.objects.get_or_create(
            parent=parent_profile,
            student=student.student_profile,
            defaults={'status': 'pending'}
        )
        if not created and link_request.status != 'pending':
            link_request.status = 'pending'
            link_request.save()
            
        return Response({'success': 'Link request sent to student.'})

class StudentLinkRequestsView(generics.ListAPIView):
    """Student-only endpoint: Lists all pending parent link requests for the student."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LinkRequestSerializer
    
    def get_queryset(self):
        if self.request.user.role == User.Role.STUDENT:
            return ParentStudentLinkRequest.objects.filter(student=self.request.user.student_profile, status='pending')
        return ParentStudentLinkRequest.objects.none()

class LinkRequestActionView(APIView):
    """
    Student-only endpoint: Approve or reject an incoming parent link request.
    Payload: {"action": "approve" | "reject"}
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.Role.STUDENT:
            return Response({'error': 'Only students can approve/reject link requests.'}, status=status.HTTP_403_FORBIDDEN)
            
        link_request = get_object_or_404(ParentStudentLinkRequest, pk=pk, student=request.user.student_profile)
        action = request.data.get('action')
        
        if action == 'approve':
            link_request.status = 'approved'
            link_request.save()
            # Link student User instance to parent's children relation
            link_request.parent.children.add(request.user)
            return Response({'success': 'Link request approved.'})
        elif action == 'reject':
            link_request.status = 'rejected'
            link_request.save()
            return Response({'success': 'Link request rejected.'})
            
        return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

class ParentChildrenView(generics.ListAPIView):
    """Parent-only endpoint: Lists all students linked under the parent's account."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == User.Role.PARENT:
            return self.request.user.parent_profile.children.all()
        return User.objects.none()
