from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.shortcuts import get_object_or_404
from .serializers import UserSerializer, LinkRequestSerializer, CustomTokenObtainPairSerializer
from .models import User, ParentProfile, LinkRequest

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

class LinkStudentView(APIView):
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
            
        # Create or update link request
        link_request, created = LinkRequest.objects.get_or_create(
            parent=request.user,
            student=student,
            defaults={'status': LinkRequest.Status.PENDING}
        )
        if not created and link_request.status != LinkRequest.Status.PENDING:
            link_request.status = LinkRequest.Status.PENDING
            link_request.save()
            
        return Response({'success': 'Link request sent to student.'})

class StudentLinkRequestsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LinkRequestSerializer
    
    def get_queryset(self):
        if self.request.user.role == User.Role.STUDENT:
            return LinkRequest.objects.filter(student=self.request.user, status=LinkRequest.Status.PENDING)
        return LinkRequest.objects.none()

class LinkRequestActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.Role.STUDENT:
            return Response({'error': 'Only students can approve/reject link requests.'}, status=status.HTTP_403_FORBIDDEN)
            
        link_request = get_object_or_404(LinkRequest, pk=pk, student=request.user)
        action = request.data.get('action')
        
        if action == 'approve':
            link_request.status = LinkRequest.Status.APPROVED
            link_request.save()
            # Add to parent profile
            parent_profile = getattr(link_request.parent, 'parent_profile', None)
            if parent_profile:
                parent_profile.children.add(request.user)
            return Response({'success': 'Link request approved.'})
        elif action == 'reject':
            link_request.status = LinkRequest.Status.REJECTED
            link_request.save()
            return Response({'success': 'Link request rejected.'})
            
        return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

class ParentChildrenView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == User.Role.PARENT:
            return self.request.user.parent_profile.children.all()
        return User.objects.none()
