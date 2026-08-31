"""
ASGI Configuration for Tuition4All Project

This configuration sets up the ASGI application for handling asynchronous protocols:
1. Standard HTTP requests (handled via Django's ASGI application).
2. WebSockets (handled via Django Channels with AuthMiddlewareStack and URLRouter):
   - WebRTC 1-to-1 Video Calling: ws/call/<room_id>/
   - Collaborative Whiteboard: ws/whiteboard/<room_id>/
"""

import os
from django.core.asgi import get_asgi_application

# Initialize Django ASGI application early to ensure the AppRegistry is populated
# before importing code that may import ORM models.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tution4all.settings')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import courses.routing

application = ProtocolTypeRouter({
    # Standard HTTP requests
    "http": django_asgi_app,
    
    # Real-time WebSocket connections wrapped with user session authentication
    "websocket": AuthMiddlewareStack(
        URLRouter(
            courses.routing.websocket_urlpatterns
        )
    ),
})

