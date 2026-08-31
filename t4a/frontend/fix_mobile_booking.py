import os
import re

file_1 = 'C:/Users/JHFINN_Suraj/Desktop/t4a/frontend/src/screens/student/TutorPublicProfile.tsx'
with open(file_1, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("Alert.alert('? Request Sent!', 'Your booking request has been sent to the tutor. Wait for confirmation.');", "Alert.alert('? Class Booked!', 'Your class has been successfully booked.');")
content = content.replace("Could not send request. Please try again.", "Could not book class. Please try again.")
content = content.replace("{booking ? 'Sending...' : 'Send Request'}", "{booking ? 'Booking...' : 'Book Slot'}")

with open(file_1, 'w', encoding='utf-8') as f:
    f.write(content)

file_2 = 'C:/Users/JHFINN_Suraj/Desktop/t4a/frontend/src/screens/parent/ParentDashboardScreen.tsx'
if os.path.exists(file_2):
    with open(file_2, 'r', encoding='utf-8') as f:
        content2 = f.read()
    content2 = content2.replace("Send Request", "Book Slot")
    content2 = content2.replace("Sending...", "Booking...")
    with open(file_2, 'w', encoding='utf-8') as f:
        f.write(content2)

print('Updated mobile UI text')
