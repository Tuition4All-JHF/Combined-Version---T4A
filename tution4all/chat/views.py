from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from .models import Message, ChatRoom
from django.db.models import Q

User = get_user_model()

@login_required
def chat_view(request, user_id=None):
    # Get contacts based on role
    contacts_set = set()
    role = request.user.role
    
    try:
        if role == 'teacher':
            for course in request.user.teacher_profile.courses.all():
                for enrollment in course.enrollments.all():
                    student = enrollment.student
                    if student and student.user:
                        contacts_set.add(student.user)
                    if student and student.parent and student.parent.user:
                        contacts_set.add(student.parent.user)
        elif role == 'student':
            for enrollment in request.user.student_profile.enrollments.all():
                if enrollment.course.teacher and enrollment.course.teacher.user:
                    contacts_set.add(enrollment.course.teacher.user)
        elif role == 'parent':
            for child in request.user.parent_profile.children.all():
                for enrollment in child.enrollments.all():
                    if enrollment.course.teacher and enrollment.course.teacher.user:
                        contacts_set.add(enrollment.course.teacher.user)
    except Exception:
        pass
                
    # Also include anyone with whom the user has exchanged messages via ChatRoom
    if role in ['student', 'parent']:
        rooms = ChatRoom.objects.filter(Q(student=request.user) | Q(parent=request.user)).select_related('tutor')
        for room in rooms:
            if room.tutor: contacts_set.add(room.tutor)
    elif role == 'teacher':
        rooms = ChatRoom.objects.filter(tutor=request.user).select_related('student', 'parent')
        for room in rooms:
            if room.student: contacts_set.add(room.student)
            if room.parent: contacts_set.add(room.parent)
                
    contacts = list(contacts_set)
    
    # Calculate unread messages per contact
    for contact in contacts:
        contact.unread_count = 0
        if role == 'student':
            room = ChatRoom.objects.filter(student=request.user, tutor=contact).first()
        elif role == 'parent':
            room = ChatRoom.objects.filter(parent=request.user, tutor=contact).first()
        elif role == 'teacher':
            room = ChatRoom.objects.filter(tutor=request.user).filter(Q(student=contact) | Q(parent=contact)).first()
        else:
            room = None
            
        if room:
            contact.unread_count = Message.objects.filter(room=room, sender=contact, is_read=False).count()
    
    active_contact = None
    chat_messages = []
    
    if user_id:
        active_contact = get_object_or_404(User, id=user_id)
        room = None
        if role == 'student':
            room = ChatRoom.objects.filter(student=request.user, tutor=active_contact).first()
        elif role == 'parent':
            room = ChatRoom.objects.filter(parent=request.user, tutor=active_contact).first()
        elif role == 'teacher':
            room = ChatRoom.objects.filter(tutor=request.user).filter(Q(student=active_contact) | Q(parent=active_contact)).first()
            
        if room:
            chat_messages = room.messages.all().order_by('created_at')
            # Mark as read
            Message.objects.filter(room=room, sender=active_contact, is_read=False).update(is_read=True)

    return render(request, 'chat/chat.html', {
        'contacts': contacts,
        'active_contact': active_contact,
        'chat_messages': chat_messages
    })

@login_required
def send_message(request):
    if request.method == 'POST':
        receiver_id = request.POST.get('receiver_id')
        content = request.POST.get('content')
        receiver = get_object_or_404(User, id=receiver_id)
        
        if content.strip():
            room = None
            if request.user.role == 'student':
                room, _ = ChatRoom.objects.get_or_create(student=request.user, tutor=receiver)
            elif request.user.role == 'parent':
                room, _ = ChatRoom.objects.get_or_create(parent=request.user, tutor=receiver)
            elif request.user.role == 'teacher':
                if receiver.role == 'student':
                    room, _ = ChatRoom.objects.get_or_create(student=receiver, tutor=request.user)
                elif receiver.role == 'parent':
                    room, _ = ChatRoom.objects.get_or_create(parent=receiver, tutor=request.user)
            
            if room:
                msg = Message.objects.create(
                    room=room,
                    sender=request.user,
                    content=content
                )
                return JsonResponse({
                    'status': 'success',
                    'content': msg.content,
                    'timestamp': msg.created_at.strftime("%I:%M %p")
                })
    return JsonResponse({'status': 'error'}, status=400)


from django.views.decorators.csrf import csrf_exempt
from courses.ai_utils import call_groq_api, call_gemini_api
from django.conf import settings
from courses.models import Course, LiveClass, RecordedClass, Assignment, Attendance
from django.utils import timezone
from .models import AIChatSession, AIChatMessage
from core.utils import get_attendance_analytics

@login_required
def ai_chat_view(request):
    user_courses = []
    role = request.user.role
    try:
        if role == 'student':
            user_courses = Course.objects.filter(enrollments__student=request.user.student_profile)
        elif role == 'teacher':
            user_courses = Course.objects.filter(teacher=request.user.teacher_profile)
    except Exception as e:
        pass
        
    sessions = AIChatSession.objects.filter(user=request.user).order_by('-created_at')
    
    active_session_id = request.GET.get('session_id')
    active_session = None
    chat_messages = []
    if active_session_id:
        active_session = get_object_or_404(AIChatSession, id=active_session_id, user=request.user)
        chat_messages = active_session.messages.all().order_by('created_at')
        
    return render(request, 'chat/ai_chat.html', {
        'user_courses': user_courses,
        'sessions': sessions,
        'active_session': active_session,
        'chat_messages': chat_messages
    })



@login_required
def delete_ai_chat_session(request, session_id):
    session = get_object_or_404(AIChatSession, id=session_id, user=request.user)
    session.delete()
    messages.success(request, 'Chat session deleted successfully.')
    return redirect('chat:ai_chat')


import json
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
@login_required
def ai_chat_response(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            prompt = data.get('prompt')
            session_id = data.get('session_id')
            
            if not prompt:
                return JsonResponse({'status': 'error', 'message': 'Prompt is required'}, status=400)
                
            if session_id:
                session = get_object_or_404(AIChatSession, id=session_id, user=request.user)
            else:
                title = prompt[:50] + "..." if len(prompt) > 50 else prompt
                session = AIChatSession.objects.create(user=request.user, title=title)
                
            # Save user message
            AIChatMessage.objects.create(
                session=session,
                role=AIChatMessage.Role.USER,
                content=prompt
            )
            
            # Call AI
            try:
                response_text = call_groq_api(prompt, system_prompt="You are an expert AI educational assistant. Provide helpful and accurate answers.")
            except Exception:
                try:
                    response_text = call_gemini_api(prompt)
                except Exception as e:
                    response_text = "Sorry, I am unable to process your request right now."
                
            # Save AI response
            AIChatMessage.objects.create(
                session=session,
                role=AIChatMessage.Role.ASSISTANT,
                content=response_text
            )
            
            return JsonResponse({
                'status': 'success',
                'response': response_text,
                'session_id': session.id
            })
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

