"""
Chat Application - Data Models

Defines real-time communication and AI Assistant models:
- ChatRoom: Private 1-to-1 conversation room between student/parent and tutor.
- Message: Individual text messages sent within a ChatRoom with read status tracking.
- AIChatSession: Historical AI conversation thread tied to an authenticated user.
- AIChatMessage: Granular turn-by-turn chat history (user, assistant, system).
"""

from django.db import models
from django.conf import settings

class ChatRoom(models.Model):
    """A private chat room between a student (or parent) and a tutor."""
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_chats', null=True, blank=True
    )
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='parent_chats', null=True, blank=True
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tutor_chats'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('student', 'tutor'), ('parent', 'tutor'))

    def __str__(self):
        client_name = self.student.username if self.student else (self.parent.username if self.parent else "Unknown")
        return f"Chat: {client_name} ↔ {self.tutor.username}"

class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages'
    )
    content = models.TextField(null=True, blank=True)
    attachment = models.FileField(upload_to='chat_attachments/', null=True, blank=True)
    attachment_type = models.CharField(max_length=20, null=True, blank=True)
    reply_to = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:40]}"

class AIChatSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_chat_sessions')
    title = models.CharField(max_length=255, default="New Chat")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Chat: {self.title} by {self.user.username}"


class AIChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'
        SYSTEM = 'system', 'System'

    session = models.ForeignKey(AIChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=15, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role} at {self.created_at}"
