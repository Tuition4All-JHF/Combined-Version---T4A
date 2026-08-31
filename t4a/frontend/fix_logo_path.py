import os
import re

files_to_fix = [
    # (file_path, depth_levels_from_assets)
    ("src/screens/student/StudentDashboard.tsx", 3),
    ("src/screens/parent/ParentDashboardScreen.tsx", 3),
    ("src/screens/tutor/TutorDashboard.tsx", 3),
    ("src/components/T4ALogo.tsx", 2),
    ("src/screens/guest/GuestTutorsScreen.tsx", 3),
]

for path, depth in files_to_fix:
    if not os.path.exists(path):
        print(f"NOT FOUND: {path}")
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix all variations of wrong path
    correct_path = "../" * depth + "assets/logo_transparent.png"
    for wrong in [
        "../../assets/logo_transparent.png",
        "../../../assets/logo_transparent.png",
        "../../../../assets/logo_transparent.png",
    ]:
        if wrong in content:
            content = content.replace(wrong, correct_path)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed: {path} -> {correct_path}")

print("Done!")
