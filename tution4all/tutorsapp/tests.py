from django.test import TestCase
from tutorsapp.views import calculate_attendance_stats

class MockAttendance:
    def __init__(self, status, total_duration_seconds, total_attended_seconds, missed_seconds):
        self.status = status
        self.total_duration_seconds = total_duration_seconds
        self.total_attended_seconds = total_attended_seconds
        self.missed_seconds = missed_seconds

class MockQuerySet:
    def __init__(self, items):
        self.items = items
    
    def count(self):
        return len(self.items)
        
    def filter(self, status__in=None):
        return MockQuerySet([item for item in self.items if item.status in status__in])
        
    def __iter__(self):
        return iter(self.items)

class AttendanceCalculationTests(TestCase):
    def test_full_attendance(self):
        """Full attendance (100%)"""
        qs = MockQuerySet([
            MockAttendance('PRESENT', 300, 300, 0)
        ])
        stats = calculate_attendance_stats(qs)
        self.assertEqual(stats['attendance_percentage'], 100.0)
        self.assertEqual(stats['total_attended_minutes'], 5.0)
        self.assertEqual(stats['total_missed_minutes'], 0.0)
        self.assertEqual(stats['total_duration_minutes'], 5.0)

    def test_partial_attendance(self):
        """Partial attendance (e.g., 198s attended out of 306s = 64.71%)"""
        qs = MockQuerySet([
            MockAttendance('PARTIAL', 306, 198, 108)
        ])
        stats = calculate_attendance_stats(qs)
        self.assertEqual(stats['attendance_percentage'], 64.71)
        self.assertEqual(stats['total_attended_minutes'], 3.3)
        self.assertEqual(stats['total_missed_minutes'], 1.8)
        self.assertEqual(stats['total_duration_minutes'], 5.1)
        
    def test_zero_attendance(self):
        """Zero attendance (0%)"""
        qs = MockQuerySet([
            MockAttendance('ABSENT', 300, 0, 300)
        ])
        stats = calculate_attendance_stats(qs)
        self.assertEqual(stats['attendance_percentage'], 0.0)
        self.assertEqual(stats['total_attended_minutes'], 0.0)
        self.assertEqual(stats['total_missed_minutes'], 5.0)
        self.assertEqual(stats['total_duration_minutes'], 5.0)

    def test_reconnects_multiple_times(self):
        """Student reconnects multiple times (sum all connected durations)"""
        # Duration is 600s, attended 200s, missed 400s
        qs = MockQuerySet([
            MockAttendance('PARTIAL', 600, 200, 400)
        ])
        stats = calculate_attendance_stats(qs)
        self.assertEqual(stats['attendance_percentage'], 33.33)
        self.assertEqual(stats['total_attended_minutes'], 3.3)
        self.assertEqual(stats['total_missed_minutes'], 6.7)
        self.assertEqual(stats['total_duration_minutes'], 10.0)

    def test_leaves_early(self):
        """Student leaves early"""
        # Duration is 900s, attended 450s, missed 450s
        qs = MockQuerySet([
            MockAttendance('PARTIAL', 900, 450, 450)
        ])
        stats = calculate_attendance_stats(qs)
        self.assertEqual(stats['attendance_percentage'], 50.0)
        self.assertEqual(stats['total_attended_minutes'], 7.5)
        self.assertEqual(stats['total_missed_minutes'], 7.5)
        self.assertEqual(stats['total_duration_minutes'], 15.0)

    def test_missing_duration_fallback(self):
        """Fallback when total_duration_seconds is 0 but attended/missed is available"""
        qs = MockQuerySet([
            MockAttendance('PARTIAL', 0, 100, 200)
        ])
        stats = calculate_attendance_stats(qs)
        self.assertEqual(stats['total_duration_seconds'], 300)
        self.assertEqual(stats['attendance_percentage'], 33.33)
