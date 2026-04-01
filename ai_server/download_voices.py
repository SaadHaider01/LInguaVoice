"""
download_voices.py — Downloads the correct combined voices.bin
from onnx-community/Kokoro-82M-v1.0-ONNX on HuggingFace.

The kokoro-onnx library needs a single root-level voices.bin,
NOT the individual voices/*.bin files.

Run from ai_server/:
    python download_voices.py
"""
from huggingface_hub import hf_hub_download
import shutil
import os

REPO_ID   = "onnx-community/Kokoro-82M-v1.0-ONNX"
OUT_DIR   = os.path.dirname(os.path.abspath(__file__))

files_to_download = [
    "voices.bin",    # combined all-voices file that kokoro-onnx reads
]

print(f"Downloading from {REPO_ID}...")
for fname in files_to_download:
    print(f"  Downloading: {fname}")
    cached = hf_hub_download(REPO_ID, fname)
    dest   = os.path.join(OUT_DIR, fname)
    shutil.copy2(cached, dest)
    size_mb = os.path.getsize(dest) / (1024 * 1024)
    print(f"  ✅ Saved to: {dest}  ({size_mb:.1f} MB)")

print("\n✅ Done! Now run: python ai_server.py")
