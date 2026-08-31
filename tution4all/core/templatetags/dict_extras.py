from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key)

import datetime

@register.filter
def duration_format(td):
    if not isinstance(td, datetime.timedelta):
        return "-"
    total_seconds = int(td.total_seconds())
    if total_seconds <= 0:
        return "0m"
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

@register.filter
def late_by(attendance):
    if attendance.status == 'absent':
        return "-"
    if attendance.joined_at and attendance.live_class.actual_start_time:
        diff = attendance.joined_at - attendance.live_class.actual_start_time
        if diff.total_seconds() > 60:
            return duration_format(diff)
    return "On Time"

@register.filter
def missed_time(attendance):
    start = attendance.live_class.actual_start_time or attendance.live_class.start_time
    end = attendance.live_class.actual_end_time or attendance.live_class.end_time
    
    if attendance.status == 'absent':
        if start and end:
            class_dur = end - start
            return duration_format(class_dur)
        return "100%"
        
    if start and end:
        class_dur = end - start
        stu_dur = attendance.duration
        if class_dur and stu_dur:
            diff = class_dur - stu_dur
            if diff.total_seconds() > 60:
                return duration_format(diff)
            return "None"
    return "-"

@register.filter
def class_duration(live_class):
    start = live_class.actual_start_time or live_class.start_time
    end = live_class.actual_end_time or live_class.end_time
    if start and end:
        return duration_format(end - start)
    return "-"

@register.filter
def format_joined_time(attendance):
    if attendance.status == 'absent':
        return "-"
    if attendance.joined_at:
        return attendance.joined_at.strftime("%I:%M %p")
    return "-"

@register.filter
def format_exited_time(attendance):
    if attendance.status == 'absent':
        return "-"
    if attendance.exited_at:
        return attendance.exited_at.strftime("%I:%M %p")
    return "-"

@register.filter
def format_attended_duration(attendance):
    if attendance.status == 'absent':
        return "0m"
    return duration_format(attendance.duration)

@register.filter
def attendance_percentage_val(attendance):
    if not attendance or not attendance.live_class or not attendance.live_class.start_time or not attendance.live_class.end_time:
        return "0"
    if attendance.status == 'absent':
        return "0"
        
    expected_duration = (attendance.live_class.end_time - attendance.live_class.start_time).total_seconds()
    if expected_duration <= 0:
        return "0"
        
    attended_duration = attendance.duration.total_seconds() if attendance.duration else 0
    percentage = round((attended_duration / expected_duration) * 100, 2)
    if percentage > 100:
        percentage = 100.0
    return str(percentage)
