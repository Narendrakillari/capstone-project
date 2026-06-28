import sys
import subprocess

# Map import module names to their pip package names
PACKAGES = {
    "dotenv": "python-dotenv",
    "fastapi": "fastapi",
    "google.antigravity": "google-antigravity",
    "moviepy": "moviepy",
    "edge_tts": "edge-tts",
    "PIL": "Pillow"
}

print("=" * 60)
print(f"Active Python Executable: {sys.executable}")
print("=" * 60)
print("Testing module imports...\n")

for module_name, package_name in PACKAGES.items():
    try:
        __import__(module_name)
        print(f"[OK] {module_name} is already installed.")
    except ImportError:
        print(f"[MISSING] {module_name} is missing. Installing {package_name}...")
        try:
            # Run pip install using the active python executable's pip
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
            # Re-test import
            __import__(module_name)
            print(f"[FIXED] {module_name} successfully installed and verified.")
        except Exception as e:
            print(f"[ERROR] Failed to install or verify {package_name}: {e}")

print("\nVerification complete.")
