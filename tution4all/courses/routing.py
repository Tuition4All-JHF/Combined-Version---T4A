from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/call/(?P<room_id>[\w-]+)/$', consumers.VideoCallConsumer.as_asgi()),
    re_path(r'ws/whiteboard/(?P<room_id>[\w-]+)/$', consumers.WhiteboardConsumer.as_asgi()),
]
