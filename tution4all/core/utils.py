import json

def get_attendance_analytics(request, base_queryset):
    """
    Given a base queryset of Attendance objects, applies date filtering from the request,
    calculates KPIs, and prepares JSON data for line and pie charts.
    Returns a dictionary of context variables.
    """
    att_start_date = request.GET.get('att_start_date')
    att_end_date = request.GET.get('att_end_date')
    
    student_attendances = base_queryset
    
    if att_start_date:
        student_attendances = student_attendances.filter(live_class__start_time__date__gte=att_start_date)
    if att_end_date:
        student_attendances = student_attendances.filter(live_class__start_time__date__lte=att_end_date)
        
    student_attendances = student_attendances.order_by('-live_class__start_time')
        
    att_total = student_attendances.count()
    att_present = student_attendances.filter(status='present').count()
    att_late = student_attendances.filter(status='late').count()
    att_present_or_late = att_present + att_late
    att_absent = student_attendances.filter(status='absent').count()
    
    att_percentage = round((att_present_or_late / att_total) * 100, 2) if att_total > 0 else 0
    
    daily_data = {}
    total_duration_seconds = 0
    total_expected_seconds = 0
    total_lost_seconds = 0
    
    for att in student_attendances:
        expected = 3600
        if att.live_class.start_time and att.live_class.end_time:
            expected = (att.live_class.end_time - att.live_class.start_time).total_seconds()
            
        total_expected_seconds += expected
        
        if att.duration:
            total_duration_seconds += att.duration.total_seconds()
            class_time_lost = expected - att.duration.total_seconds()
            if class_time_lost > 0:
                total_lost_seconds += class_time_lost
        else:
            if att.status == 'absent':
                total_lost_seconds += expected
            
        if att.live_class.start_time:
            date_obj = att.live_class.start_time.date()
            label = date_obj.strftime("%b %d, %Y")
            if label not in daily_data:
                daily_data[label] = {'total': 0, 'present': 0, 'absent': 0, 'date': date_obj, 'duration_seconds': 0}
            daily_data[label]['total'] += 1
            if att.status in ['present', 'late']:
                daily_data[label]['present'] += 1
            else:
                daily_data[label]['absent'] += 1
                
            if att.duration:
                daily_data[label]['duration_seconds'] += att.duration.total_seconds()
                
    att_total_hours = round(total_duration_seconds / 3600, 1)
    
    hours, remainder = divmod(total_duration_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    att_exact_time = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
    
    tl_hours, tl_remainder = divmod(total_lost_seconds, 3600)
    tl_minutes, tl_seconds = divmod(tl_remainder, 60)
    att_time_lost_exact = f"{int(tl_hours)}h {int(tl_minutes)}m {int(tl_seconds)}s"
    
    att_time_attended_percentage = 0
    att_time_lost_percentage = 0
    
    if total_expected_seconds > 0:
        att_time_lost_percentage = round((total_lost_seconds / total_expected_seconds) * 100, 2)
        att_time_attended_percentage = round(100.0 - att_time_lost_percentage, 2)
        if att_time_attended_percentage < 0:
            att_time_attended_percentage = 0.0
        if att_time_lost_percentage > 100:
            att_time_lost_percentage = 100.0
                
    sorted_days = sorted(daily_data.values(), key=lambda x: x['date'])
    
    att_chart_data = {
        'labels': [d['date'].strftime("%b %d") for d in sorted_days],
        'percentages': [round((d['present'] / d['total']) * 100, 1) if d['total'] > 0 else 0 for d in sorted_days],
        'missed': [d['absent'] for d in sorted_days],
        'hours': [round(d['duration_seconds'] / 3600, 1) for d in sorted_days]
    }
    
    att_pie_data = {
        'labels': ['Present', 'Late', 'Absent'],
        'data': [att_present, att_late, att_absent]
    }
    
    if att_time_attended_percentage >= 90:
        time_chart_color = '#198754' # Green
    elif att_time_attended_percentage >= 50:
        time_chart_color = '#ffc107' # Yellow
    else:
        time_chart_color = '#dc3545' # Red
        
    time_pie_data = {
        'labels': ['Time Attended', 'Time Lost'],
        'data': [total_duration_seconds, total_lost_seconds],
        'colors': [time_chart_color, '#dee2e6']
    }
    
    return {
        'student_attendances': student_attendances,
        'att_start_date': att_start_date,
        'att_end_date': att_end_date,
        'att_total': att_total,
        'att_present': att_present_or_late,
        'att_absent': att_absent,
        'att_percentage': att_percentage,
        'att_total_hours': att_total_hours,
        'att_exact_time': att_exact_time,
        'att_time_lost_exact': att_time_lost_exact,
        'att_time_attended_percentage': att_time_attended_percentage,
        'att_time_lost_percentage': att_time_lost_percentage,
        'att_chart_data_json': json.dumps(att_chart_data),
        'att_pie_data_json': json.dumps(att_pie_data),
        'time_pie_data_json': json.dumps(time_pie_data)
    }


def get_overall_attendance_percentage(student_profile):
    """Returns the overall attendance percentage for a student based on exact expected vs attended duration."""
    from courses.models import Attendance
    attendances = Attendance.objects.filter(student=student_profile)
    total_expected = 0
    total_lost = 0
    for att in attendances:
        expected = 3600
        if att.live_class.start_time and att.live_class.end_time:
            expected = (att.live_class.end_time - att.live_class.start_time).total_seconds()
        total_expected += expected
        if att.duration:
            class_time_lost = expected - att.duration.total_seconds()
            if class_time_lost > 0:
                total_lost += class_time_lost
        else:
            if att.status == 'absent':
                total_lost += expected
    if total_expected > 0:
        att_time_lost_percentage = (total_lost / total_expected) * 100
        att_time_attended_percentage = 100.0 - att_time_lost_percentage
        if att_time_attended_percentage < 0: return 0.0
        return round(att_time_attended_percentage, 1)
    return 0.0