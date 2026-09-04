"""
TutorsApp Application - AI Service (TuitionBot)

Powers the platform's context-aware intelligent assistant (TuitionBot):
- Role-based Context Extraction:
  - Students: Real-time attendance percentage, pending assignment deadlines, enrolled courses.
  - Parents: Supervised children progress, missed classes, submission statuses.
  - Tutors: Upcoming scheduled sessions, student roster, pending assignment reviews.
- Dynamic Prompt Construction: Generates grounded system prompts preventing AI hallucinations.
- Multi-Turn Conversation Management: Persists conversation memory in AIChatSession / AIChatMessage.
- Audio Transcription: Processes voice inputs via Groq Whisper API.
"""

import os
from groq import Groq
from django.conf import settings
from .models import TutorProfile
from courses.models import (
    LiveClassBooking as Booking, Attendance, Assignment,
    StudentSubmission as AssignmentSubmission, CourseNote as StudyNote
)
from chat.models import AIChatSession, AIChatMessage
from accounts.models import ParentProfile

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)


# â”€â”€â”€ Shared context helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def get_tutors_summary():
    """Returns a summary of all tutors with subjects and rates."""
    tutors = TutorProfile.objects.select_related('user').prefetch_related('tutor_subjects__subject').all()
    lines = ["=== PLATFORM TUTORS ==="]
    for t in tutors:
        subjects = []
        for ts in t.tutor_subjects.all():
            subjects.append(f"{ts.subject.name} (${ts.hourly_rate}/hr, {ts.course_duration_hours}h course)")
        subjects_str = "; ".join(subjects) if subjects else "No subjects listed"
        lines.append(
            f"â€¢ {t.user.get_full_name() or t.user.username}"
            f" | {t.experience_years} yrs experience | Rating: {t.rating}/5"
            f" | Status: {t.verification_status}"
            f" | Subjects: {subjects_str}"
            f" | Bio: {t.bio[:100] if t.bio else 'N/A'}"
        )
    return "\n".join(lines)


def fmt_seconds(s):
    """Format seconds into h m s string."""
    h, rem = divmod(int(s), 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}h {m}m"
    return f"{m}m {sec}s"


def read_study_note_content(note):
    content = ""
    try:
        if getattr(note, 'file', None) and note.file.name and os.path.exists(note.file.path):
            file_path = note.file.path
            if file_path.lower().endswith('.txt'):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                except Exception:
                    pass
            elif file_path.lower().endswith('.pdf'):
                try:
                    import PyPDF2
                    with open(file_path, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        content = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
                except Exception:
                    content = "[PDF content extraction requires PyPDF2 installed]"
            else:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()[:5000]
                except Exception:
                    content = "[Binary or unsupported file format]"
    except Exception:
        pass
    return content



# â”€â”€â”€ Role-specific context builders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def get_student_context(user):
    lines = [f"=== STUDENT PROFILE: {user.get_full_name() or user.username} ==="]
    try:
        profile = user.student_profile
    except Exception:
        return "Student profile not found."

    from courses.models import Project, ClassSummaryNote, RecordedClass, LiveClass, Course

    # Bookings & Attendance
    bookings = Booking.objects.filter(student=profile).select_related('live_class__course__category', 'live_class__course__teacher__user').order_by('-booking_date')
    lines.append(f"\nTotal Bookings: {bookings.count()}")
    lines.append("\n--- ATTENDANCE & LIVE CLASSES ---")
    
    courses = set()
    total_sessions = 0
    
    for b in bookings:
        if not getattr(b, 'live_class', None): continue
        courses.add(b.live_class.course)
        subj = b.live_class.course.category.name if getattr(b.live_class.course, 'category', None) else "Unknown Subject"
        date_str = b.live_class.start_time.strftime('%Y-%m-%d %H:%M') if getattr(b.live_class, 'start_time', None) else "Not scheduled"
        tutor_name = b.live_class.course.teacher.user.username if getattr(b.live_class.course, 'teacher', None) else "Unknown Tutor"
        
        att = Attendance.objects.filter(student=profile, live_class=b.live_class).first()
        status = att.status if att else "Not recorded"
        duration = att.duration.total_seconds() / 60 if att and att.duration else 0
        
        # Check for summaries
        summary = ClassSummaryNote.objects.filter(live_class=b.live_class).first()
        summary_txt = f"Summary: {summary.content[:100]}..." if summary else "No summary"
        
        lines.append(f"• {date_str} | Subject: {subj} | Tutor: {tutor_name} | Status: {status} | Duration: {duration:.1f}m | {summary_txt}")
        if att: total_sessions += 1

    if total_sessions > 0:
        from core.utils import get_overall_attendance_percentage
        lines.append(f"\nOverall Average Attendance: {get_overall_attendance_percentage(profile)}%")

    if courses:
        # Assignments
        assignments = Assignment.objects.filter(course__in=courses).order_by('-due_date')
        lines.append(f"\n--- ASSIGNMENTS ({assignments.count()} total) ---")
        for a in assignments:
            sub = getattr(a, 'submissions', AssignmentSubmission.objects.none()).filter(student=profile).first()
            sub_info = f"Submitted ({sub.status})" if sub else "Not submitted"
            lines.append(f"• '{a.title}' | Due: {a.due_date.strftime('%Y-%m-%d')} | {sub_info}\n  Desc: {a.description or 'No desc'}")

        # Projects
        projects = Project.objects.filter(course__in=courses).order_by('-due_date')
        lines.append(f"\n--- PROJECTS ({projects.count()} total) ---")
        for p in projects:
            sub = getattr(p, 'submissions', AssignmentSubmission.objects.none()).filter(student=profile).first()
            sub_info = f"Submitted ({sub.status})" if sub else "Not submitted"
            lines.append(f"• '{p.title}' | Due: {p.due_date.strftime('%Y-%m-%d')} | {sub_info}\n  Desc: {p.description or 'No desc'}")

        # Study Notes
        notes = StudyNote.objects.filter(course__in=courses).order_by('-uploaded_at')
        lines.append(f"\n--- STUDY NOTES ({notes.count()} total) ---")
        for n in notes:
            lines.append(f"• '{n.title}' | Date: {n.uploaded_at.strftime('%Y-%m-%d')}\n  Content: {read_study_note_content(n)}")

    return "\n".join(lines)


def get_tutor_context(user):
    lines = [f"=== TUTOR PROFILE: {user.get_full_name() or user.username} ==="]
    try:
        profile = user.teacher_profile
        lines.append(f"Bio: {profile.bio or 'Not provided'}")
        lines.append(f"Qualifications: {profile.qualifications or 'Not provided'}")
    except Exception:
        return "Tutor profile not found."

    from courses.models import Course, LiveClass, Assignment, CourseNote, Project, ClassSummaryNote
    from django.utils import timezone
    
    courses = Course.objects.filter(teacher=profile)
    lines.append(f"\n--- COURSES TAUGHT ({courses.count()}) ---")
    for c in courses:
        lines.append(f"• {c.title} ({c.category.name if hasattr(c, 'category') and c.category else 'No Category'})")

    now = timezone.now()
    upcoming_classes = LiveClass.objects.filter(course__teacher=profile, start_time__gte=now).order_by('start_time')
    lines.append(f"\n--- UPCOMING LIVE CLASSES ({upcoming_classes.count()}) ---")
    for lc in upcoming_classes:
        lines.append(f"• {lc.topic} on {lc.start_time.strftime('%Y-%m-%d %H:%M') if lc.start_time else 'N/A'}")

    past_classes = LiveClass.objects.filter(course__teacher=profile, start_time__lt=now).order_by('-start_time')[:10]
    lines.append(f"\n--- RECENT PAST CLASSES ({past_classes.count()}) ---")
    for lc in past_classes:
        summary = ClassSummaryNote.objects.filter(live_class=lc).first()
        sum_txt = "Summary uploaded" if summary else "No summary"
        lines.append(f"• {lc.topic} on {lc.start_time.strftime('%Y-%m-%d')} | {sum_txt}")

    assignments = Assignment.objects.filter(course__teacher=profile).order_by('-created_at')
    lines.append(f"\n--- ASSIGNMENTS CREATED ({assignments.count()}) ---")
    for a in assignments:
        lines.append(f"• '{a.title}' | Due: {a.due_date.strftime('%Y-%m-%d %H:%M') if a.due_date else 'N/A'} | Subs: {a.submissions.count()}")

    projects = Project.objects.filter(course__teacher=profile).order_by('-created_at')
    lines.append(f"\n--- PROJECTS CREATED ({projects.count()}) ---")
    for p in projects:
        lines.append(f"• '{p.title}' | Due: {p.due_date.strftime('%Y-%m-%d %H:%M') if p.due_date else 'N/A'} | Subs: {p.submissions.count()}")

    bookings = Booking.objects.filter(live_class__course__teacher=profile).select_related('student__user', 'live_class__course__category').order_by('student__user__username', '-booking_date')
    student_map = {}
    for b in bookings:
        if getattr(b, 'student', None):
            sname = b.student.user.username
            if sname not in student_map: student_map[sname] = []
            student_map[sname].append(b)

    lines.append(f"\n--- ENROLLED STUDENTS ({len(student_map)}) ---")
    for sname, sbookings in student_map.items():
        lines.append(f"• Student: {sname} ({len(sbookings)} sessions)")

    return "\n".join(lines)


def get_parent_context(user):
    lines = [f"=== PARENT PROFILE: {user.get_full_name() or user.username} ==="]
    try:
        profile = ParentProfile.objects.get(user=user)
        children = profile.children.all()
        if not children:
            lines.append("No children linked to this account.")
            return "\n".join(lines)
            
        lines.append(f"\n--- CHILDREN LINKED ({children.count()}) ---")
        for child in children:
            lines.append(f"\n>>> CHILD: {child.user.get_full_name() or child.user.username}")
            child_context = get_student_context(child.user)
            for line in child_context.split('\n'):
                lines.append(f"    {line}")
    except ParentProfile.DoesNotExist:
        lines.append("No parent profile found.")
    return "\n".join(lines)


def generate_system_prompt(user):
    base = (
        "You are TuitionBot, an advanced AI educational assistant, similar in capability to Gemini or ChatGPT. "
        "You have strict access ONLY to the user's secure context provided below. "
        "You MUST behave as a professional personal assistant, adapting to instructions but remaining strictly professional. "
        "Focus entirely on work, tasks, platform features, and educational content. Do not become overly personal or emotional.\n\n"
        "🔥 **CRITICAL FORMATTING RULES** 🔥:\n"
        "1. You MUST use rich Markdown extensively. Use **bold** for emphasis, names, dates, and key concepts.\n"
        "2. You MUST use *italics* for nuanced points and blockquotes (`>`) for summaries.\n"
        "3. You MUST use a very minimal amount of EMOJIS. Use a maximum of 1 or 2 emojis per response. Do not use emojis in every sentence.\n"
        "4. You MUST use structured bullet points for any lists.\n"
        "5. You MUST preserve Data Privacy: you only know about the data provided in the context below.\n\n"
        "🔥 **CRITICAL DOCUMENT ANALYSIS RULE** 🔥:\n"
        "You ALREADY have access to the user's uploaded documents, assignments, and study notes in the context below. "
        "DO NOT EVER claim you cannot view, read, or download attached files. When a user asks you to analyze, summarize, or review a document, "
        "look for its content in the context below and provide the requested analysis based solely on that text.\n\n"
    )

    if user.role == 'student':
        role_context = get_student_context(user)
        instructions = "You are assisting a STUDENT. Summarize their class notes, check assignments/projects, explain concepts, and act as a professional, personalized tutor."
    elif user.role == 'teacher':
        role_context = get_tutor_context(user)
        instructions = "You are assisting a TUTOR. Help them analyze student attendance, track assignment and project submissions, and draft professional emails or lesson plans."
    elif user.role == 'parent':
        role_context = get_parent_context(user)
        instructions = "You are assisting a PARENT. Help them track their child's attendance, due dates, projects, and learning progress."
    else:
        role_context = get_tutors_summary()
        instructions = "You are assisting a user. Help them explore the platform."

    return f"{base}INSTRUCTIONS: {instructions}\n\n{role_context}\n\nRemember: Format beautifully with Markdown, maintain a professional tone, and use a maximum of 1-2 emojis per response!"


# â”€â”€â”€ Chat & Transcription â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def chat_with_ai(session, user, message_content):
    """Sends message to Groq API and saves the interaction."""
    # Save user message
    AIChatMessage.objects.create(session=session, role=AIChatMessage.Role.USER, content=message_content)

    # Retrieve past messages for context (last 12 for conversational memory)
    past_messages = list(AIChatMessage.objects.filter(session=session).order_by('-created_at')[:12])
    past_messages.reverse()

    # Groq (and many LLMs) require the conversation after the system prompt to start with a user message
    if past_messages and past_messages[0].role == AIChatMessage.Role.ASSISTANT:
        past_messages.pop(0)

    messages = [{"role": "system", "content": generate_system_prompt(user)}]

    # --- PERSISTENT CROSS-SESSION MEMORY ---
    # Fetch the last 20 messages from OTHER sessions to let the AI remember the user's name, mood, and trained behavior.
    global_memory_msgs = list(AIChatMessage.objects.filter(session__user=user).exclude(session=session).order_by('-created_at')[:20])
    if global_memory_msgs:
        global_memory_msgs.reverse()
        memory_str = "\n".join([f"{'USER' if m.role == 'user' else 'AI'}: {m.content}" for m in global_memory_msgs])
        memory_instruction = (
            "\n\n=== 🧠 PERSISTENT USER MEMORY (Past Conversations) ===\n"
            "Below is a short transcript of your PAST conversations with this exact user in other chat sessions. "
            "CRITICAL INSTRUCTION: You MUST use this memory to remember their name (if they told you), their preferences, their current mood, "
            "and any specific instructions they gave you on how to behave! Adapt your persona to match how they trained you.\n\n"
            f"{memory_str}\n=======================================================\n"
        )
        messages[0]["content"] += memory_instruction
    # ---------------------------------------

    for msg in past_messages:
        messages.append({"role": msg.role, "content": msg.content})

    import os
    import time
    from groq import Groq

    # Parse multiple API keys if provided via comma-separated string in settings
    api_keys_str = getattr(settings, 'GROQ_API_KEY', '') or os.environ.get('GROQ_API_KEY', '')
    api_keys = [k.strip() for k in api_keys_str.split(',') if k.strip()]
    if not api_keys:
        raise Exception("No Groq API keys found in configuration.")

    # List of stable fallback models
    MODELS = [
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "groq/compound",
        "groq/compound-mini",
        "qwen/qwen3.8-27b"
    ]

    response = None
    last_error = None

    # Try each API key
    for api_key in api_keys:
        current_client = Groq(api_key=api_key)
        
        # Try each model for this API key
        for model_name in MODELS:
            try:
                response = current_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.6,
                    max_tokens=1500,
                )
                break # Success! Break out of model loop
            except Exception as e:
                last_error = e
                print(f"Failed with key {api_key[:6]}... and model {model_name}: {str(e)}")
                continue # Try next model
        
        if response:
            break # Success! Break out of API key loop

    if not response:
        error_str = str(last_error)
        ai_content = "⚠️ **AI Service Unavailable**\n\nI apologize, but all AI models are currently offline or we have reached our maximum usage limit."
        
        # Check if it's a rate limit error and try to extract the retry time
        import re
        match = re.search(r"try again in ([\d\w\.]+)", error_str, re.IGNORECASE)
        if "429" in error_str or "rate_limit" in error_str.lower():
            ai_content = "⚠️ **Usage Limit Reached**\n\nWe have reached the maximum API usage limit for the AI assistant."
            if match:
                ai_content += f" Please try again in **{match.group(1)}**."
                
    else:
        ai_content = response.choices[0].message.content

    # Save AI response (or the graceful error message)
    ai_msg = AIChatMessage.objects.create(
        session=session,
        role=AIChatMessage.Role.ASSISTANT,
        content=ai_content
    )

    # Auto-generate session title from first user message
    if session.title == "New Chat" and len(past_messages) <= 2 and response:
        try:
            title_resp = current_client.chat.completions.create(
                model=MODELS[0],
                messages=[
                    {"role": "system", "content": "Generate a short (3-5 words) title for this conversation. Only return the title text, no quotes, no punctuation."},
                    {"role": "user", "content": message_content}
                ],
                max_tokens=12,
            )
            session.title = title_resp.choices[0].message.content.strip('"').strip("'").strip()
            session.save()
        except Exception:
            pass

    return ai_msg


def transcribe_audio(file_path):
    """Transcribes audio using Groq Whisper model."""
    with open(file_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=(os.path.basename(file_path), file.read()),
            model="whisper-large-v3",
            response_format="text",
        )
    return transcription

