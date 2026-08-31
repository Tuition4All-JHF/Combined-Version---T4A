import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

// ─── Student Screens ─────────────────────────────────────────────
import StudentDashboard from '../screens/student/StudentDashboard';
import SearchTutors from '../screens/student/SearchTutors';
import TutorPublicProfile from '../screens/student/TutorPublicProfile';
import MyBookings from '../screens/student/MyBookings';
import StudentSettings from '../screens/student/StudentSettings';
import StudentLiveClass from '../screens/student/StudentLiveClass';
import StudentAttendanceScreen from '../screens/student/StudentAttendanceScreen';
import StudentAssignmentsScreen from '../screens/student/StudentAssignmentsScreen';
import StudentStudyNotesScreen from '../screens/student/StudentStudyNotesScreen';

// ─── Tutor Screens ────────────────────────────────────────────────
import TutorDashboard from '../screens/tutor/TutorDashboard';
import TodaysClasses from '../screens/tutor/TodaysClasses';
import ManageAvailability from '../screens/tutor/ManageAvailability';
import BookingRequests from '../screens/tutor/BookingRequests';
import MyStudents from '../screens/tutor/MyStudents';
import Reviews from '../screens/tutor/Reviews';
import TutorProfileScreen from '../screens/tutor/TutorProfileScreen';
import SettingsScreen from '../screens/tutor/SettingsScreen';
import TutorAssignmentsScreen from '../screens/tutor/TutorAssignmentsScreen';
import TutorStudyNotesScreen from '../screens/tutor/TutorStudyNotesScreen';
import TutorCalendarView from '../screens/tutor/TutorCalendarView';

// ─── Shared Screens ───────────────────────────────────────────────
import ChatList from '../screens/ChatList';
import ChatScreen from '../screens/ChatScreen';
import LiveSessionScreen from '../screens/LiveSessionScreen';
import AIChatScreen from '../screens/ai/AIChatScreen';

// ─── Admin Screens ────────────────────────────────────────────────
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminCourses from '../screens/admin/AdminCourses';
import AdminTutorVerification from '../screens/admin/AdminTutorVerification';
import AdminTutorProfile from '../screens/admin/AdminTutorProfile';
import AdminSubjects from '../screens/admin/AdminSubjects';
import AdminPayments from '../screens/admin/AdminPayments';
import AdminAccounts from '../screens/admin/AdminAccounts';
import AdminProfileDetail from '../screens/admin/AdminProfileDetail';

// ─── Guest Screens ────────────────────────────────────────────────
import GuestTutorsScreen from '../screens/guest/GuestTutorsScreen';

const Stack = createNativeStackNavigator();

const MainNavigator = () => {
  const { user, isGuest } = useSelector((state: RootState) => state.auth);
  const userRole = user?.role?.toUpperCase();
  const isStudent = userRole === 'STUDENT';
  const isAdmin = userRole === 'ADMIN';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isGuest ? (
        <>
          <Stack.Screen name="GuestTutors" component={GuestTutorsScreen} />
          <Stack.Screen name="TutorPublicProfile" component={TutorPublicProfile} />
        </>
      ) : isAdmin ? (
        <>
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="AdminCourses" component={AdminCourses} options={{ title: 'Course Approval' }} />
          <Stack.Screen name="AdminTutorVerification" component={AdminTutorVerification} />
          <Stack.Screen name="AdminTutorProfile" component={AdminTutorProfile} />
          <Stack.Screen name="AdminSubjects" component={AdminSubjects} />
          <Stack.Screen name="AdminPayments" component={AdminPayments} />
          <Stack.Screen name="AdminAccounts" component={AdminAccounts} />
          <Stack.Screen name="AdminProfileDetail" component={AdminProfileDetail} />
        </>
      ) : isStudent ? (
        <>
          <Stack.Screen name="StudentDashboard" component={StudentDashboard} />
          <Stack.Screen name="SearchTutors" component={SearchTutors} />
          <Stack.Screen name="TutorPublicProfile" component={TutorPublicProfile} />
          <Stack.Screen name="MyBookings" component={MyBookings} />
          <Stack.Screen name="Messages" component={ChatList} />
          <Stack.Screen name="StudentSettings" component={StudentSettings} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="LiveSessionScreen" component={LiveSessionScreen} />
          <Stack.Screen name="StudentLiveClass" component={StudentLiveClass} />
          <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} />
          <Stack.Screen name="StudentAssignments" component={StudentAssignmentsScreen} />
          <Stack.Screen name="StudentStudyNotes" component={StudentStudyNotesScreen} />
          <Stack.Screen name="AIChatScreen" component={AIChatScreen} />
        </>
      ) : userRole === 'PARENT' ? (
        <>
          <Stack.Screen name="ParentDashboard" component={require('../screens/parent/ParentDashboardScreen').default} />
          <Stack.Screen name="ParentChildrenScreen" component={require('../screens/parent/ParentChildrenScreen').default} />
          <Stack.Screen name="SearchTutors" component={SearchTutors} />
          <Stack.Screen name="TutorPublicProfile" component={TutorPublicProfile} />
          <Stack.Screen name="Messages" component={ChatList} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="ParentPaymentDashboard" component={require('../screens/parent/ParentPaymentDashboard').default} />
          <Stack.Screen name="ParentProfileScreen" component={require('../screens/parent/ParentProfileScreen').default} />
          <Stack.Screen name="AIChatScreen" component={AIChatScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="TutorDashboard" component={TutorDashboard} />
          <Stack.Screen name="TodaysClasses" component={TodaysClasses} />
          <Stack.Screen name="ManageAvailability" component={ManageAvailability} />
          <Stack.Screen name="BookingRequests" component={BookingRequests} />
          <Stack.Screen name="MyStudents" component={MyStudents} />
          <Stack.Screen name="Reviews" component={Reviews} />
          <Stack.Screen name="TutorProfile" component={TutorProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
           <Stack.Screen name="TutorAssignments" component={TutorAssignmentsScreen} />
          <Stack.Screen name="TutorStudyNotes" component={TutorStudyNotesScreen} />
          <Stack.Screen name="TutorCalendarView" component={TutorCalendarView} />
          <Stack.Screen name="Messages" component={ChatList} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="LiveSessionScreen" component={LiveSessionScreen} />
          <Stack.Screen name="AIChatScreen" component={AIChatScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default MainNavigator;
