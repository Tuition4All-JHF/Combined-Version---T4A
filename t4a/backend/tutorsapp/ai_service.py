import os
from groq import Groq
from django.conf import settings
from .models import (
    TutorProfile, Booking, Attendance, Assignment,
    AssignmentSubmission, StudyNote, AIChatSession, AIChatMessage
)
from accounts.models import ParentProfile

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)


# ─── Shared context helpers ────────────────────────────────────────────────────

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
            f"• {t.user.get_full_name() or t.user.username}"
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


# ─── Role-specific context builders ───────────────────────────────────────────

def get_student_context(user):
    lines = [f"=== STUDENT PROFILE: {user.get_full_name() or user.username} ==="]

    # ── Bookings & Attendance ──
    bookings = Booking.objects.filter(student=user).select_related('tutor', 'subject').order_by('-created_at')
    lines.append(f"\nTotal Bookings: {bookings.count()}")
    lines.append("\n--- ATTENDANCE DETAILS ---")
    total_attended = 0
    total_duration = 0
    for b in bookings:
        subj = b.subject.name if b.subject else "Unknown Subject"
        date_str = b.start_time.strftime('%Y-%m-%d %H:%M') if b.start_time else "Not scheduled"
        try:
            att = b.attendance
            tot = att.total_duration_seconds if att.total_duration_seconds > 0 else (att.total_attended_seconds + att.missed_seconds)
            pct = (att.total_attended_seconds / tot * 100) if tot > 0 else 0.0
            total_attended += att.total_attended_seconds
            total_duration += tot
            
            attended = fmt_seconds(att.total_attended_seconds)
            missed = fmt_seconds(att.missed_seconds)
            duration = fmt_seconds(tot)
            lines.append(
                f"• {date_str} | Subject: {subj} | Tutor: {b.tutor.username}"
                f" | Status: {att.status} | Attendance: {pct:.1f}%"
                f" | Attended: {attended} / {duration} | Missed: {missed}"
            )
        except Attendance.DoesNotExist:
            lines.append(f"• {date_str} | Subject: {subj} | Tutor: {b.tutor.username} | Attendance: Not recorded yet")

    if total_duration > 0:
        overall_pct = (total_attended / total_duration) * 100
        lines.append(f"\nOverall Average Attendance: {overall_pct:.1f}%")
    else:
        lines.append("\nOverall Average Attendance: No data yet")

    # ── Enrolled tutors/subjects ──
    enrolled = list(set([(b.tutor.username, b.subject.name if b.subject else "Unknown") for b in bookings]))
    if enrolled:
        lines.append("\n--- ENROLLED TUTORS & SUBJECTS ---")
        for tutor, subject in enrolled:
            lines.append(f"• {tutor} teaches {subject}")

    # ── Assignments ──
    assignments = Assignment.objects.filter(student=user).select_related('tutor').order_by('-due_date')
    lines.append(f"\n--- ASSIGNMENTS ({assignments.count()} total) ---")
    for a in assignments:
        sub_info = "Not submitted"
        try:
            sub = a.submission
            sub_info = f"Submitted on {sub.submitted_at.strftime('%Y-%m-%d')}"
            if sub.text_answer:
                sub_info += f" | Answer: {sub.text_answer}"
        except AssignmentSubmission.DoesNotExist:
            pass
        lines.append(
            f"• [{a.status}] \"{a.title}\" | Assigned: {a.assigned_date} | Due: {a.due_date}"
            f" | Tutor: {a.tutor.username} | {sub_info}"
            f"\n  Description: {a.description if a.description else 'No description'}"
        )

    # ── Study Notes ──
    notes = StudyNote.objects.filter(student=user).select_related('tutor').order_by('-created_at')
    lines.append(f"\n--- STUDY NOTES ({notes.count()} total) ---")
    for n in notes:
        lines.append(
            f"• \"{n.title}\" | Uploaded by: {n.tutor.username} | Date: {n.created_at.strftime('%Y-%m-%d')}"
            f"\n  Comments: {n.comments if n.comments else 'No additional comments'}"
            f"\n  Content: {read_study_note_content(n)}"
        )

    return "\n".join(lines)


def get_tutor_context(user):
    lines = [f"=== TUTOR PROFILE: {user.get_full_name() or user.username} ==="]

    try:
        profile = user.tutor_profile
        lines.append(f"Experience: {profile.experience_years} years | Rating: {profile.rating}/5")
        lines.append(f"Bio: {profile.bio or 'Not provided'}")
        lines.append(f"Qualifications: {profile.qualifications or 'Not provided'}")
        subjects = [f"{ts.subject.name} (${ts.hourly_rate}/hr)" for ts in profile.tutor_subjects.all()]
        lines.append(f"Subjects: {', '.join(subjects) if subjects else 'None'}")
    except TutorProfile.DoesNotExist:
        lines.append("Tutor profile not found.")

    # ── Students and per-student attendance ──
    bookings = Booking.objects.filter(tutor=user).select_related('student', 'subject').order_by('student__username', '-created_at')
    student_map = {}
    for b in bookings:
        sname = b.student.username
        if sname not in student_map:
            student_map[sname] = {'student': b.student, 'bookings': []}
        student_map[sname]['bookings'].append(b)

    lines.append(f"\n--- ENROLLED STUDENTS ({len(student_map)}) ---")
    for sname, info in student_map.items():
        student = info['student']
        sbookings = info['bookings']
        total_attended = 0
        total_duration = 0
        for b in sbookings:
            try:
                att = b.attendance
                tot = att.total_duration_seconds if att.total_duration_seconds > 0 else (att.total_attended_seconds + att.missed_seconds)
                total_attended += att.total_attended_seconds
                total_duration += tot
            except Attendance.DoesNotExist:
                pass
        avg_att = (total_attended / total_duration * 100) if total_duration > 0 else None
        lines.append(f"\n• Student: {student.get_full_name() or sname} (@{sname})")
        lines.append(f"  Sessions: {len(sbookings)} | Avg Attendance: {f'{avg_att:.1f}%' if avg_att is not None else 'No data'}")

        # Per-session breakdown
        for b in sbookings:
            subj = b.subject.name if b.subject else "Unknown"
            date_str = b.start_time.strftime('%Y-%m-%d') if b.start_time else "No date"
            try:
                att = b.attendance
                tot = att.total_duration_seconds if att.total_duration_seconds > 0 else (att.total_attended_seconds + att.missed_seconds)
                pct = (att.total_attended_seconds / tot * 100) if tot > 0 else 0.0
                lines.append(
                    f"    - {date_str} | {subj} | {att.status} | {pct:.1f}%"
                    f" | Attended: {fmt_seconds(att.total_attended_seconds)} / {fmt_seconds(tot)}"
                    f" | Missed: {fmt_seconds(att.missed_seconds)}"
                )
            except Attendance.DoesNotExist:
                lines.append(f"    - {date_str} | {subj} | Attendance not recorded")

        # Student's assignments from this tutor
        student_assignments = Assignment.objects.filter(tutor=user, student=student)
        if student_assignments.exists():
            lines.append(f"  Assignments for {sname}:")
            for a in student_assignments:
                sub_info = "❌ Not submitted"
                try:
                    a.submission
                    sub_info = "✅ Submitted"
                except AssignmentSubmission.DoesNotExist:
                    pass
                lines.append(f"    [{a.status}] \"{a.title}\" | Due: {a.due_date} | {sub_info}")

        # Student's linked parent
        try:
            parent_profile = ParentProfile.objects.filter(children=student).first()
            if parent_profile:
                lines.append(f"  Linked Parent: {parent_profile.user.get_full_name() or parent_profile.user.username} (@{parent_profile.user.username})")
        except Exception:
            pass

    # ── My uploaded study notes ──
    notes = StudyNote.objects.filter(tutor=user).select_related('student').order_by('-created_at')
    lines.append(f"\n--- STUDY NOTES UPLOADED ({notes.count()}) ---")
    for n in notes:
        recipient = n.student.username if n.student else "All students"
        lines.append(
            f"• \"{n.title}\" | For: {recipient} | Date: {n.created_at.strftime('%Y-%m-%d')}"
            f"\n  Comments: {n.comments if n.comments else 'None'}"
            f"\n  Content: {read_study_note_content(n)}"
        )

    return "\n".join(lines)


def get_parent_context(user):
    lines = [f"=== PARENT PROFILE: {user.get_full_name() or user.username} ==="]
    try:
        profile = ParentProfile.objects.get(user=user)
        children = profile.children.all()
        lines.append(f"Linked Children: {', '.join([c.username for c in children]) or 'None'}")

        for child in children:
            lines.append(f"\n--- CHILD: {child.get_full_name() or child.username} (@{child.username}) ---")

            # Attendance
            child_bookings = Booking.objects.filter(student=child).select_related('tutor', 'subject').order_by('-created_at')
            lines.append(f"  Total Sessions: {child_bookings.count()}")
            total_attended = 0
            total_duration = 0
            for b in child_bookings:
                subj = b.subject.name if b.subject else "Unknown"
                date_str = b.start_time.strftime('%Y-%m-%d') if b.start_time else "No date"
                try:
                    att = b.attendance
                    tot = att.total_duration_seconds if att.total_duration_seconds > 0 else (att.total_attended_seconds + att.missed_seconds)
                    pct = (att.total_attended_seconds / tot * 100) if tot > 0 else 0.0
                    total_attended += att.total_attended_seconds
                    total_duration += tot
                    lines.append(
                        f"  • {date_str} | {subj} | Tutor: {b.tutor.username}"
                        f" | {att.status} | {pct:.1f}% | Attended: {fmt_seconds(att.total_attended_seconds)}"
                        f" | Missed: {fmt_seconds(att.missed_seconds)}"
                    )
                except Attendance.DoesNotExist:
                    lines.append(f"  • {date_str} | {subj} | Tutor: {b.tutor.username} | Not recorded")

            if total_duration > 0:
                overall_pct = (total_attended / total_duration) * 100
                lines.append(f"  Average Attendance: {overall_pct:.1f}%")

            # Assignments
            assignments = Assignment.objects.filter(student=child).select_related('tutor').order_by('-due_date')
            lines.append(f"  Assignments ({assignments.count()}):")
            for a in assignments:
                sub = "✅ Submitted" if hasattr(a, 'submission') else "❌ Not submitted"
                try:
                    a.submission
                    sub = "✅ Submitted"
                except AssignmentSubmission.DoesNotExist:
                    sub = "❌ Not submitted"
                lines.append(f"    [{a.status}] \"{a.title}\" | Due: {a.due_date} | {sub}")

            # Tutors teaching child
            tutors_teaching = list(set([(b.tutor.username, b.subject.name if b.subject else "?") for b in child_bookings]))
            if tutors_teaching:
                lines.append(f"  Tutors:")
                for tname, tsubj in tutors_teaching:
                    try:
                        tp = TutorProfile.objects.get(user__username=tname)
                        lines.append(f"    • {tname} | {tsubj} | Rating: {tp.rating}/5 | {tp.experience_years} yrs exp")
                    except TutorProfile.DoesNotExist:
                        lines.append(f"    • {tname} | {tsubj}")

    except ParentProfile.DoesNotExist:
        lines.append("No parent profile found. Please link your children in settings.")

    return "\n".join(lines)


# ─── Main system prompt ────────────────────────────────────────────────────────

def generate_system_prompt(user):
    base = (
        "You are TuitionBot, a smart AI assistant embedded in the Tuition4All tutoring platform. "
        "You have real-time access to the user's data. Be specific, accurate, helpful, and concise. "
        "When quoting numbers (attendance %, dates, etc.) use exactly what is in the context provided. "
        "If data is not in the context, say so clearly — do NOT make up information.\n\n"
    )

    if user.role == 'STUDENT':
        role_context = get_student_context(user)
        instructions = (
            "You are talking to a STUDENT. Help them with: their attendance per session, "
            "assignment deadlines and status, study notes from tutors, enrolled subjects and tutors. "
            "Also answer general academic questions and platform-related queries."
        )
    elif user.role == 'TUTOR':
        role_context = get_tutor_context(user)
        instructions = (
            "You are talking to a TUTOR. Help them with: student attendance reports, "
            "which students submitted assignments, parent-student links, session history, "
            "study notes they uploaded, and subject/rate comparisons with other tutors on the platform."
        )
    elif user.role == 'PARENT':
        role_context = get_parent_context(user)
        instructions = (
            "You are talking to a PARENT. Help them with: their child's attendance and progress, "
            "upcoming and missed assignments, tutor performance (rating, experience), "
            "and any concerns about their child's learning."
        )
    else:
        role_context = get_tutors_summary()
        instructions = "You are talking to an admin or general user."

    tutor_summary = get_tutors_summary()

    return f"{base}INSTRUCTIONS: {instructions}\n\n{role_context}\n\n{tutor_summary}\n\nAnswer based strictly on the above data."


# ─── Chat & Transcription ─────────────────────────────────────────────────────

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
        model="llama-3.3-70b-versatile",
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
                model="llama-3.1-8b-instant",
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
