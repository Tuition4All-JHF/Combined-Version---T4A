import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from django.utils import timezone
from .models import Attendance, AttendanceLog, Booking
from django.contrib.auth import get_user_model

User = get_user_model()


def get_bookings_from_room(room_id, student=None):
    """
    Resolve a room_id to a queryset of Booking objects.

    Supported formats:
      - 'booking_123'      → one Booking with id=123
      - 'group_slot_456'   → all Bookings whose time_slot_id=456
      - '123'              → one Booking with id=123 (legacy)
      - any other string   → try time_slot__batch_id fallback
    """
    if isinstance(room_id, str):
        if room_id.startswith('group_slot_'):
            try:
                slot_id = int(room_id.split('_', 2)[2])
                qs = Booking.objects.filter(time_slot_id=slot_id)
                if student:
                    qs = qs.filter(student=student)
                return qs
            except (ValueError, IndexError):
                return Booking.objects.none()

        if room_id.startswith('booking_'):
            try:
                booking_id = int(room_id.split('_', 1)[1])
                qs = Booking.objects.filter(id=booking_id)
                if student:
                    qs = qs.filter(student=student)
                return qs
            except (ValueError, IndexError):
                return Booking.objects.none()

    # Legacy: plain numeric string or batch_id fallback
    try:
        booking_id = int(room_id)
        qs = Booking.objects.filter(id=booking_id)
        if student:
            qs = qs.filter(student=student)
        return qs
    except (ValueError, TypeError):
        pass

    # batch_id fallback (weekly/monthly recurrence rooms)
    qs = Booking.objects.filter(time_slot__batch_id=room_id)
    if student:
        qs = qs.filter(student=student)
    return qs


@sync_to_async
def handle_user_join(room_id, username):
    try:
        user = User.objects.get(username=username)
        if user.role != 'STUDENT':
            return  # Tutors don't have attendance records
        bookings = get_bookings_from_room(room_id, student=user)
        for booking in bookings:
            attendance, _ = Attendance.objects.get_or_create(booking=booking, student=user)
            # Only create a new log if there is no currently open (un-closed) log
            if not attendance.logs.filter(leave_time__isnull=True).exists():
                AttendanceLog.objects.create(attendance=attendance)
    except Exception as e:
        print(f"[Attendance] Error handling join for {username} in {room_id}: {e}")


@sync_to_async
def handle_user_leave(room_id, username):
    try:
        user = User.objects.get(username=username)
        if user.role != 'STUDENT':
            return
        bookings = get_bookings_from_room(room_id, student=user)
        for booking in bookings:
            try:
                attendance = Attendance.objects.get(booking=booking, student=user)
                last_log = attendance.logs.filter(leave_time__isnull=True).last()
                if last_log:
                    last_log.leave_time = timezone.now()
                    last_log.save()
            except Attendance.DoesNotExist:
                pass
    except Exception as e:
        print(f"[Attendance] Error handling leave for {username} in {room_id}: {e}")


@sync_to_async
def handle_session_ended(room_id):
    try:
        from django.db.models import Min
        # Get ALL bookings in this room (all students for group sessions)
        bookings = get_bookings_from_room(room_id, student=None)

        now = timezone.now()

        # Determine the ACTUAL session duration from the earliest join across all students
        all_logs = AttendanceLog.objects.filter(attendance__booking__in=bookings)
        first_join_result = all_logs.aggregate(Min('join_time'))
        first_join = first_join_result['join_time__min']

        if first_join:
            actual_session_seconds = max(1, (now - first_join).total_seconds())
        else:
            booking_sample = bookings.first()
            if booking_sample and booking_sample.start_time and booking_sample.end_time:
                actual_session_seconds = (booking_sample.end_time - booking_sample.start_time).total_seconds()
            elif booking_sample and booking_sample.time_slot:
                actual_session_seconds = (booking_sample.time_slot.end_time - booking_sample.time_slot.start_time).total_seconds()
            else:
                actual_session_seconds = 3600

        for booking in bookings:
            try:
                attendance = Attendance.objects.get(booking=booking)

                # Close any open logs (student still in room when session ended)
                open_logs = attendance.logs.filter(leave_time__isnull=True)
                for log in open_logs:
                    log.leave_time = now
                    log.save()

                # Total time student was present
                total_attended = 0
                for log in attendance.logs.all():
                    if log.leave_time and log.join_time:
                        total_attended += (log.leave_time - log.join_time).total_seconds()

                missed = max(0, actual_session_seconds - total_attended)

                attendance.total_attended_seconds = int(total_attended)
                attendance.total_duration_seconds = int(actual_session_seconds)
                attendance.missed_seconds = int(missed)

                percentage = min(100.0, (total_attended / actual_session_seconds) * 100) if actual_session_seconds > 0 else 0
                attendance.attendance_percentage = percentage

                if percentage >= 95:
                    attendance.status = Attendance.Status.PRESENT
                elif percentage > 0:
                    attendance.status = Attendance.Status.PARTIAL
                else:
                    attendance.status = Attendance.Status.ABSENT

                attendance.save()

            except Attendance.DoesNotExist:
                # Student never joined — mark ABSENT
                Attendance.objects.create(
                    booking=booking,
                    student=booking.student,
                    status=Attendance.Status.ABSENT,
                    total_attended_seconds=0,
                    missed_seconds=int(actual_session_seconds),
                    total_duration_seconds=int(actual_session_seconds),
                    attendance_percentage=0.0
                )
    except Exception as e:
        print(f"[Attendance] Error ending session for {room_id}: {e}")


class LiveClassConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'live_{self.room_id}'

        query_string = self.scope.get('query_string', b'').decode('utf-8')
        qs = parse_qs(query_string)
        self.username = qs.get('username', [None])[0]

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'username') and self.username:
            await handle_user_leave(self.room_id, self.username)

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content):
        content['sender_channel'] = self.channel_name

        msg_type = content.get('type')
        if msg_type == 'join' and content.get('from'):
            await handle_user_join(self.room_id, content.get('from'))
        elif msg_type == 'session_ended':
            await handle_session_ended(self.room_id)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'room_message',
                'content': content
            }
        )

    async def room_message(self, event):
        content = event['content']
        sender_channel = content.get('sender_channel')

        if sender_channel != self.channel_name:
            await self.send_json(content)
