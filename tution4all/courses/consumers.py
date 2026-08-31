"""
Courses Application - WebSocket Consumers

Handles real-time asynchronous communication for live classroom features:
1. VideoCallConsumer: Relays WebRTC signaling data (SDP offers, SDP answers, ICE candidates)
   between teacher and students for 1-to-1 video calling.
2. WhiteboardConsumer: Synchronizes collaborative drawing actions and stroke coordinates
   across all participants in a live session.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class VideoCallConsumer(AsyncWebsocketConsumer):
    """
    Asynchronous WebSocket consumer for WebRTC signaling.
    Routes audio/video connection negotiation messages between participants in a live room.
    """
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'video_call_{self.room_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')
        
        # Broadcast message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'video_signal',
                'message': data,
                'sender_channel': self.channel_name
            }
        )

    # Receive message from room group
    async def video_signal(self, event):
        message = event['message']
        sender_channel = event['sender_channel']

        # Send message to WebSocket (if not the sender)
        if self.channel_name != sender_channel:
            await self.send(text_data=json.dumps(message))

class WhiteboardConsumer(AsyncWebsocketConsumer):
    """
    Asynchronous WebSocket consumer for live collaborative whiteboard synchronization.
    """
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'whiteboard_{self.room_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'whiteboard_signal',
                'message': data,
                'sender_channel': self.channel_name
            }
        )

    async def whiteboard_signal(self, event):
        message = event['message']
        sender_channel = event['sender_channel']

        if self.channel_name != sender_channel:
            await self.send(text_data=json.dumps(message))
