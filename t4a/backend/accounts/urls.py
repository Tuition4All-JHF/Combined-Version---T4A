from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, UserDetailView, LinkStudentView, ParentChildrenView,
    StudentLinkRequestsView, LinkRequestActionView, CustomTokenObtainPairView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserDetailView.as_view(), name='user_detail'),
    path('parent/link-student/', LinkStudentView.as_view(), name='link_student'),
    path('parent/children/', ParentChildrenView.as_view(), name='parent_children'),
    path('student/link-requests/', StudentLinkRequestsView.as_view(), name='student_link_requests'),
    path('student/link-requests/<int:pk>/action/', LinkRequestActionView.as_view(), name='student_link_request_action'),
]
