from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views, admin_views
from .views import (
    AssignmentListCreate, AssignmentDetail,
    AssignmentSubmissionCreate, ParentAssignmentStatsView,
)
from .admin_views import AdminSubjectDelete

router = DefaultRouter()
router.register(r'schedule-slots', views.TutorScheduleSlotViewSet, basename='schedule-slot')
router.register(r'study-notes', views.StudyNoteViewSet, basename='study-note')


urlpatterns = [
    path('subjects/', views.SubjectListCreate.as_view(), name='subject-list'),
    path('tutors/', views.TutorList.as_view(), name='tutor-list'),
    path('profile/me/', views.TutorProfileDetail.as_view(), name='tutor-profile-me'),
    path('bookings/', views.BookingList.as_view(), name='booking-list'),
    path('bookings/create/', views.BookingCreate.as_view(), name='booking-create'),
    path('bookings/<int:pk>/', views.BookingDetail.as_view(), name='booking-detail'),
    path('my-students/', views.MyStudentsView.as_view(), name='my-students'),
    path('student/attendance-stats/', views.StudentAttendanceDashboardView.as_view(), name='student-attendance-stats'),
    path('parent/dashboard-stats/', views.ParentDashboardStatsView.as_view(), name='parent-dashboard-stats'),
    path('parent/payment-history/', views.ParentPaymentHistoryView.as_view(), name='parent-payment-history'),
    path('chat/rooms/', views.ChatRoomListCreate.as_view(), name='chat-rooms'),
    path('chat/rooms/<int:room_id>/messages/', views.MessageListCreate.as_view(), name='chat-messages'),

    # Admin endpoints
    path('admin/dashboard-stats/', admin_views.AdminDashboardStats.as_view(), name='admin-dashboard-stats'),
    path('admin/tutors/pending/', admin_views.AdminPendingTutors.as_view(), name='admin-tutors-pending'),
    path('admin/tutors/<int:tutor_id>/verify/', admin_views.AdminVerifyTutor.as_view(), name='admin-verify-tutor'),
    path('admin/subjects/', admin_views.AdminSubjectListCreate.as_view(), name='admin-subjects'),
    path('admin/subjects/<int:pk>/', AdminSubjectDelete.as_view(), name='admin-subject-delete'),
    path('admin/payments/', admin_views.AdminPaymentList.as_view(), name='admin-payments'),
    path('admin/accounts/', admin_views.AdminAccountsView.as_view(), name='admin-accounts'),
    path('admin/accounts/<int:pk>/freeze/', admin_views.AdminToggleFreezeView.as_view(), name='admin-toggle-freeze'),
    path('admin/accounts/<int:pk>/profile/', admin_views.AdminProfileDetailView.as_view(), name='admin-profile-detail'),

    # Assignment endpoints
    path('assignments/', AssignmentListCreate.as_view(), name='assignment-list-create'),
    path('assignments/<int:pk>/', AssignmentDetail.as_view(), name='assignment-detail'),
    path('assignments/<int:pk>/submit/', AssignmentSubmissionCreate.as_view(), name='assignment-submit'),
    path('parent/assignment-stats/', ParentAssignmentStatsView.as_view(), name='parent-assignment-stats'),

    # AI Chat endpoints
    path('ai-chat/sessions/', views.AIChatSessionListView.as_view(), name='ai-chat-sessions'),
    path('ai-chat/sessions/<int:pk>/', views.AIChatSessionDetailView.as_view(), name='ai-chat-session-detail'),
    path('ai-chat/sessions/<int:pk>/messages/', views.AIChatMessageCreateView.as_view(), name='ai-chat-messages'),
    path('ai-chat/transcribe/', views.AITranscribeAudioView.as_view(), name='ai-chat-transcribe'),
] + router.urls
