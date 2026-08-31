import re

file_path = 'C:/Users/JHFINN_Suraj/Desktop/t4a/frontend/src/screens/tutor/BookingRequests.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Change title
code = code.replace("const BookingRequests = ({ navigation }: any) => {", "const BookingRequests = ({ navigation }: any) => {")
code = code.replace("Booking Requests", "My Bookings")
code = code.replace("pending requests", "bookings")
code = code.replace("When students request a session with you, they will appear here.", "When students book a session with you, they will appear here.")
code = code.replace("?status=PENDING", "?status=CONFIRMED")
code = code.replace("pending", "confirmed")
code = code.replace("PENDING", "CONFIRMED")
code = code.replace("colors.warning", "colors.success")
code = code.replace("colors.warningBg", "colors.success + '20'")

# Change Action Row to Start Class
action_row_def_old = '''const ActionRow = ({ onDecline, onAccept, s }: { onDecline: () => void; onAccept: () => void; s: any }) => (
  <View style={s.actions}>
    <TouchableOpacity style={s.declineBtn} onPress={onDecline} activeOpacity={0.8}>
      <Text style={s.declineText}>?  Decline</Text>
    </TouchableOpacity>
    <TouchableOpacity style={s.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
      <Text style={s.acceptText}>?  Accept</Text>
    </TouchableOpacity>
  </View>
);'''

action_row_def_new = '''const ActionRow = ({ onStart, s }: { onStart: () => void; s: any }) => (
  <View style={s.actions}>
    <TouchableOpacity style={s.acceptBtn} onPress={onStart} activeOpacity={0.85}>
      <Text style={s.acceptText}>?  Start Live Stream</Text>
    </TouchableOpacity>
  </View>
);'''

code = code.replace(action_row_def_old, action_row_def_new)

# Replace usage of ActionRow
code = re.sub(
    r'<ActionRow s={s}\s*onDecline=\{\(\) => handleAction\(req\.id, \'CANCELLED\'\)\}\s*onAccept=\{\(\) => handleAction\(req\.id, \'CONFIRMED\'\)\}\s*/>',
    r'''<ActionRow s={s} onStart={() => navigation.navigate('LiveSession', { roomId: req.time_slot.id, isTutor: true })} />''',
    code
)

code = re.sub(
    r'<ActionRow s={s}\s*onDecline=\{\(\) => handleBatchAction\(ids, \'CANCELLED\'\)\}\s*onAccept=\{\(\) => handleBatchAction\(ids, \'CONFIRMED\'\)\}\s*/>',
    r'''<ActionRow s={s} onStart={() => navigation.navigate('LiveSession', { roomId: firstSlot.id, isTutor: true })} />''',
    code
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated BookingRequests.tsx")
