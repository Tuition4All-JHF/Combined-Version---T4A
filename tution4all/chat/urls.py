from django.urls import path
from . import views

app_name = 'chat'

urlpatterns = [
    path('', views.chat_view, name='index'),
    path('<int:user_id>/', views.chat_view, name='chat_with'),
    path('send/', views.send_message, name='send_message'),
    path('ai/', views.ai_chat_view, name='ai_chat'),
    path('ai/response/', views.ai_chat_response, name='ai_chat_response'),
    path('ai/session/<int:session_id>/delete/', views.delete_ai_chat_session, name='delete_ai_chat_session'),
]

