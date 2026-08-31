from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.home, name='home'),
    path('subject/<int:category_id>/', views.subject_detail, name='subject_detail'),
    path('teacher/<int:teacher_id>/', views.public_teacher_profile, name='public_teacher_profile'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('complaints/', views.complaints_dashboard, name='complaints'),
    path('api/get-students-for-course/', views.get_students_for_course, name='get_students_for_course'),
    path('notifications/<int:notif_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('parent-link/approve/<int:request_id>/', views.approve_parent_link, name='approve_parent_link'),
    path('parent-link/reject/<int:request_id>/', views.reject_parent_link, name='reject_parent_link'),
    path('parent/analysis/', views.parent_analysis_redirect, name='parent_analysis_redirect'),
    path('parent/analysis/<int:student_id>/', views.parent_student_analysis, name='parent_student_analysis'),
    path('edit-teacher-profile/', views.edit_teacher_profile, name='edit_teacher_profile'),
    path('teachers/', views.teachers_list, name='teachers'),
    path('about/', views.about, name='about'),
    path('contact/', views.contact, name='contact'),
    path('how-it-works/', views.how_it_works, name='how_it_works'),
    path('become-tutor/', views.become_tutor, name='become_tutor'),
    path('teachers/approve/<int:teacher_id>/', views.approve_teacher, name='approve_teacher'),
    path('teachers/reject/<int:teacher_id>/', views.reject_teacher, name='reject_teacher'),
    path('teachers/approve-video/<int:teacher_id>/', views.approve_teacher_video, name='approve_teacher_video'),
    path('teachers/approve-certificate/<int:cert_id>/', views.approve_teacher_certificate, name='approve_teacher_certificate'),
    path('teachers/reject-certificate/<int:cert_id>/', views.reject_teacher_certificate, name='reject_teacher_certificate'),
    path('admin-create-course/', views.admin_create_course, name='admin_create_course'),
    path('admin-edit-course/<int:course_id>/', views.admin_edit_course, name='admin_edit_course'),
    path('admin-delete-course/<int:course_id>/', views.admin_delete_course, name='admin_delete_course'),
    path('admin-approve-course/<int:course_id>/', views.admin_approve_course, name='admin_approve_course'),
    path('admin-approve-all-courses/<int:teacher_id>/', views.admin_approve_all_courses, name='admin_approve_all_courses'),
    path('admin-reject-course/<int:course_id>/', views.admin_reject_course, name='admin_reject_course'),
    path('admin-toggle-freeze-course/<int:course_id>/', views.admin_toggle_freeze_course, name='admin_toggle_freeze_course'),
    
    path('admin-delete-user/<int:user_id>/', views.admin_delete_user, name='admin_delete_user'),
    path('admin-toggle-user-status/<int:user_id>/', views.admin_toggle_user_status, name='admin_toggle_user_status'),
    path('admin-manage-category/', views.admin_manage_category, name='admin_manage_category'),
    
    path('admin-teacher-profile/<int:teacher_id>/', views.admin_teacher_profile, name='admin_teacher_profile'),
    path('admin-student-profile/<int:student_id>/', views.admin_student_profile, name='admin_student_profile'),
    path('admin-parent-profile/<int:parent_id>/', views.admin_parent_profile, name='admin_parent_profile'),
    path('admin-add-teacher/', views.admin_add_teacher, name='admin_add_teacher'),
    path('admin-group-classes/', views.admin_group_classes, name='admin_group_classes'),
    path('admin-group-classes/approve/<int:class_id>/', views.admin_approve_group_class, name='admin_approve_group_class'),
    path('admin-approve-all-group-classes/<int:teacher_id>/', views.admin_approve_all_group_classes, name='admin_approve_all_group_classes'),
    path('admin-group-classes/reject/<int:class_id>/', views.admin_reject_group_class, name='admin_reject_group_class'),
]
