import os
import re

dashboards = [
    "src/screens/parent/ParentDashboardScreen.tsx",
    "src/screens/student/StudentDashboard.tsx",
    "src/screens/tutor/TutorDashboard.tsx"
]

for path in dashboards:
    if not os.path.exists(path):
        print(f"File {path} not found!")
        continue
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 1. Add Image to react-native import if not present
    if "Image," not in content and "Image }" not in content:
        content = content.replace("StatusBar,", "StatusBar, Image,")
        
    # 2. Replace headerDecor View with Image
    content = content.replace(
        "<View style={s.headerDecor} />",
        "<Image source={require('../../assets/logo_transparent.png')} style={s.headerDecor} />"
    )
    
    # 3. Change variant="mark" to variant="full"
    content = content.replace(
        'variant="mark"',
        'variant="full"'
    )
    
    # 4. Update headerDecor styles
    # We will use regex to find the headerDecor block and replace it
    pattern = r"headerDecor:\s*\{[^}]+\},"
    replacement = """headerDecor: {
    position: 'absolute', top: -30, right: -40,
    width: 250, height: 250, opacity: 0.05, resizeMode: 'contain',
  },"""
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
    else:
        # If it doesn't exist, we might need to add it, but it should exist.
        print(f"Warning: headerDecor style not found in {path}")
        
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

print("Dashboards updated successfully.")
