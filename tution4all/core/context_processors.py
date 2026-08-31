from .models import Notification
from chat.models import Message

def notifications(request):
    if request.user.is_authenticated:
        from django.db.models import Q
        unread_chats = Message.objects.filter(
            Q(room__student=request.user) | Q(room__tutor=request.user) | Q(room__parent=request.user),
            is_read=False
        ).exclude(sender=request.user).count()
        return {
            'notifications': request.user.notifications.filter(is_read=False).order_by('-created_at'),
            'unread_chat_count': unread_chats
        }
    return {}
