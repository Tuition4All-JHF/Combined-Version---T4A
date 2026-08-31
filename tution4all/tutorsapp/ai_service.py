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

    # â”€â”€ Bookings & Attendance â”€â”€
    bookings = Booking.objects.filter(student=profile).select_related('live_class__course__category', 'live_class__course__teacher__user').order_by('-booking_date')
    lines.append(f"\nTotal Bookings: {bookings.count()}")
    lines.append("\n--- ATTENDANCE DETAILS ---")
    
    courses = set()
    total_attended = 0
    total_sessions = 0
    
    for b in bookings:
        if not getattr(b, 'live_class', None): continue
        courses.add(b.live_class.course)
        subj = b.live_class.course.category.name if getattr(b.live_class.course, 'category', None) else "Unknown Subject"
        date_str = b.live_class.start_time.strftime('%Y-%m-%d %H:%M') if getattr(b.live_class, 'start_time', None) else "Not scheduled"
        tutor_name = b.live_class.course.teacher.user.username if getattr(b.live_class.course, 'teacher', None) else "Unknown Tutor"
        
        att = Attendance.objects.filter(student=profile, live_class=b.live_class).first()
        if att:
            status = att.status
            duration = att.duration.total_seconds() / 60 if att.duration else 0
            lines.append(f"â€¢ {date_str} | Subject: {subj} | Tutor: {tutor_name} | Status: {status} | Duration: {duration:.1f}m")
            total_sessions += 1
        else:
            lines.append(f"â€¢ {date_str} | Subject: {subj} | Tutor: {tutor_name} | Attendance: Not recorded yet")

    if total_sessions > 0:
        from core.utils import get_overall_attendance_percentage
        overall_pct = get_overall_attendance_percentage(profile)
        lines.append(f"\nOverall Average Attendance: {overall_pct}%")
    else:
        lines.append("\nOverall Average Attendance: No data yet")

    # â”€â”€ Assignments â”€â”€
    if courses:
        assignments = Assignment.objects.filter(course__in=courses).order_by('-due_date')
        lines.append(f"\n--- ASSIGNMENTS ({assignments.count()} total) ---")
        for a in assignments:
            sub_info = "Not submitted"
            sub = getattr(a, 'submissions', AssignmentSubmission.objects.none()).filter(student=profile).first()
            if sub:
                sub_info = f"Submitted ({sub.status})"
                if getattr(sub, 'text_answer', None): sub_info += f" | Answer: {sub.text_answer}"
            
            tutor_name = a.course.teacher.user.username if getattr(a.course, 'teacher', None) else 'Unknown'
            lines.append(
                f"â€¢ '{a.title}' | Due: {a.due_date.strftime('%Y-%m-%d')} | Tutor: {tutor_name} | {sub_info}\n"
                f"  Desc: {a.description or 'No desc'}"
            )

        # â”€â”€ Study Notes â”€â”€
        notes = StudyNote.objects.filter(course__in=courses).order_by('-uploaded_at')
        lines.append(f"\n--- STUDY NOTES ({notes.count()} total) ---")
        for n in notes:
            tutor_name = n.course.teacher.user.username if getattr(n.course, 'teacher', None) else 'Unknown'
            lines.append(f"â€¢ '{n.title}' | Tutor: {tutor_name} | Date: {n.uploaded_at.strftime('%Y-%m-%d')}\n  Content: {read_study_note_content(n)}")

    return "\n".join(lines)


def get_tutor_context(user):
    lines = [f"=== TUTOR PROFILE: {user.get_full_name() or user.username} ==="]
    try:
        profile = user.teacher_profile
        lines.append(f"Bio: {profile.bio or 'Not provided'}")
        lines.append(f"Qualifications: {profile.qualifications or 'Not provided'}")
    except Exception:
        return "Tutor profile not found."

    # â”€â”€ Courses and Subjects â”€â”€
    from courses.models import Course, LiveClass, Assignment, CourseNote
    courses = Course.objects.filter(teacher=profile)
    lines.append(f"\n--- COURSES TAUGHT ({courses.count()}) ---")
    for c in courses:
        lines.append(f"â€¢ {c.title} ({c.category.name if hasattr(c, 'category') and c.category else 'No Category'})")

    # â”€â”€ Upcoming Live Classes â”€â”€
    from django.utils import timezone
    now = timezone.now()
    upcoming_classes = LiveClass.objects.filter(course__teacher=profile, start_time__gte=now).order_by('start_time')
    lines.append(f"\n--- UPCOMING LIVE CLASSES ({upcoming_classes.count()}) ---")
    for lc in upcoming_classes:
        lines.append(f"â€¢ {lc.topic} on {lc.start_time.strftime('%Y-%m-%d %H:%M') if lc.start_time else 'N/A'}")

    # â”€â”€ Assignments Created â”€â”€
    assignments = Assignment.objects.filter(course__teacher=profile).order_by('-created_at')
    lines.append(f"\n--- ASSIGNMENTS CREATED ({assignments.count()}) ---")
    for a in assignments:
        lines.append(f"â€¢ '{a.title}' | Due: {a.due_date.strftime('%Y-%m-%d %H:%M') if a.due_date else 'N/A'}")
        subs = a.submissions.all()
        lines.append(f"    - Submissions: {subs.count()}")
        for s in subs:
            lines.append(f"      - {s.student.user.username}: {s.status}")

    # â”€â”€ Study Notes Uploaded â”€â”€
    notes = CourseNote.objects.filter(course__teacher=profile).order_by('-uploaded_at')
    lines.append(f"\n--- STUDY NOTES UPLOADED ({notes.count()}) ---")
    for n in notes:
        lines.append(f"â€¢ '{n.title}' | Course: {n.course.title if n.course else 'N/A'} | Uploaded: {n.uploaded_at.strftime('%Y-%m-%d') if n.uploaded_at else 'N/A'}")

    # â”€â”€ Students and per-student attendance â”€â”€
    bookings = Booking.objects.filter(live_class__course__teacher=profile).select_related('student__user', 'live_class__course__category').order_by('student__user__username', '-booking_date')
    student_map = {}
    for b in bookings:
        if not getattr(b, 'student', None) or not getattr(b, 'live_class', None): continue
        sname = b.student.user.username
        if sname not in student_map:
            student_map[sname] = {'student': b.student, 'bookings': []}
        student_map[sname]['bookings'].append(b)

    lines.append(f"\n--- ENROLLED STUDENTS ({len(student_map)}) ---")
    for sname, info in student_map.items():
        student = info['student']
        sbookings = info['bookings']
        total_attended = 0
        total_sessions = 0
        
        lines.append(f"\nâ€¢ Student: {student.user.get_full_name() or sname} (@{sname})")
        for b in sbookings:
            subj = b.live_class.course.category.name if getattr(b.live_class.course, 'category', None) else "Unknown"
            date_str = b.live_class.start_time.strftime('%Y-%m-%d') if getattr(b.live_class, 'start_time', None) else "No date"
            
            att = Attendance.objects.filter(student=student, live_class=b.live_class).first()
            if att:
                lines.append(f"    - {date_str} ({subj}) | Status: {att.status}")
                total_sessions += 1
            else:
                lines.append(f"    - {date_str} ({subj}) | Attendance: Not recorded")

        if total_sessions > 0:
            from core.utils import get_overall_attendance_percentage
            try:
                avg_att = get_overall_attendance_percentage(student)
                lines.append(f"  Total Sessions: {len(sbookings)} | Avg Attendance: {avg_att}%")
            except:
                lines.append(f"  Total Sessions: {len(sbookings)} | Avg Attendance: No data")
        else:
            lines.append(f"  Total Sessions: {len(sbookings)} | Avg Attendance: No data")

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
            # Indent child context for readability
            for line in child_context.split('\n'):
                lines.append(f"    {line}")

    except ParentProfile.DoesNotExist:
        lines.append("No parent profile found. Please link your children in settings.")

    return "\n".join(lines)

# â”€â”€â”€ Main system prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def generate_system_prompt(user):
    base = (
        "You are TuitionBot, a smart AI assistant embedded in the Tuition4All tutoring platform. "
        "You have real-time access to the user's data. Be specific, accurate, helpful, and concise. "
        "When quoting numbers (attendance %, dates, etc.) use exactly what is in the context provided. "
        "If data is not in the context, say so clearly - do NOT make up information.\\n"
        "IMPORTANT FORMATTING RULES:\\n"
        "1. ALWAYS use bold markdown (**bold**) for highlighting key terms, names, dates, and important concepts.\\n"
        "2. Do NOT hallucinate or provide overly long responses.\\n"
        "3. Use simple bullet points for lists.\\n\\n"
    )

    if user.role == 'student':
        role_context = get_student_context(user)
        instructions = (
            "You are talking to a STUDENT. Help them with: their attendance per session, "
            "assignment deadlines and status, study notes from tutors, enrolled subjects and tutors. "
            "Also answer general academic questions, explain meanings of concepts, and check grammar."
        )
    elif user.role == 'teacher':
        role_context = get_tutor_context(user)
        instructions = (
            "You are talking to a TUTOR. Help them with: student attendance reports, "
            "which students submitted assignments, parent-student links, session history, "
            "study notes they uploaded, and subject/rate comparisons with other tutors on the platform. "
            "You can also help them draft professional messages to parents or students."
        )
    elif user.role == 'parent':
        role_context = get_parent_context(user)
        instructions = (
            "You are talking to a PARENT. Help them with: their child's attendance and progress, "
            "upcoming and missed assignments, tutor performance (rating, experience), "
            "and any concerns about their child's learning. You can also help draft professional messages."
        )
    else:
        role_context = get_tutors_summary()
        instructions = "You are talking to an admin or general user. Help them draft professional messages, check grammar, or understand platform data."

    tutor_summary = get_tutors_summary()

    return f"{base}INSTRUCTIONS: {instructions}\n\nYou are a highly capable AI. In addition to answering data-specific questions, you can check grammar, explain meanings, and generate professional messages.\n\n{role_context}\n\n{tutor_summary}\n\nAnswer based strictly on the above data when asked about platform details."


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
    for msg in past_messages:
        messages.append({"role": msg.role, "content": msg.content})

    # Call Groq API
    response = client.chat.completions.create(
        model="groq/compound-mini",
        messages=messages,
        temperature=0.6,
        max_tokens=1500,
    )

    ai_content = response.choices[0].message.content

    # Save AI response
    ai_msg = AIChatMessage.objects.create(
        session=session,
        role=AIChatMessage.Role.ASSISTANT,
        content=ai_content
    )

    # Auto-generate session title from first user message
    if session.title == "New Chat" and len(past_messages) <= 2:
        try:
            title_resp = client.chat.completions.create(
                model="groq/compound-mini",
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

