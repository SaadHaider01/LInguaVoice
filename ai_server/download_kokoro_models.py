"""
download_kokoro_models.py — Downloads the CORRECT kokoro-onnx model
and voices.bin from the kokoro-onnx GitHub releases.

The onnx-community HuggingFace models are INCOMPATIBLE with the
kokoro-onnx library. Use the official release files instead.

Run from ai_server/:
    python download_kokoro_models.py
"""
import urllib.request
import os

# Correct release URLs from: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
BASE_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
OUT_DIR  = os.path.dirname(os.path.abspath(__file__))

FILES = [
    # int8 model (88MB) — matches the model_quantized.onnx you already have
    # Rename model_quantized.onnx → kokoro-v1.0.int8.onnx, OR download fresh:
    ("kokoro-v1.0.int8.onnx", "kokoro-v1.0.int8.onnx"),
    # Official voices file for the v1.0 models (npz format, ~2MB)
    ("voices-v1.0.bin", "voices-v1.0.bin"),
]

def download(url, dest):
    print(f"  Downloading: {os.path.basename(dest)}")
    def progress(count, block_size, total_size):
        if total_size > 0:
            pct = min(100, int(count * block_size * 100 / total_size))
            mb  = count * block_size / (1024 * 1024)
            print(f"\r    {pct}%  {mb:.1f} MB", end="", flush=True)
    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print()   # newline after progress
    size_mb = os.path.getsize(dest) / (1024 * 1024)
    print(f"  ✅ Saved: {dest}  ({size_mb:.1f} MB)")

def main():
    print(f"Downloading kokoro-onnx model files from GitHub releases...")
    print(f"Output dir: {OUT_DIR}\n")

    for fname, out_name in FILES:
        url  = f"{BASE_URL}/{fname}"
        dest = os.path.join(OUT_DIR, out_name)
        if os.path.exists(dest):
            size_mb = os.path.getsize(dest) / (1024 * 1024)
            print(f"  ⏭  {out_name} already exists ({size_mb:.1f} MB) — skipping")
            continue
        try:
            download(url, dest)
        except Exception as e:
            print(f"  ❌ Failed to download {fname}: {e}")
            return

    print(f"\n✅ Done! Now update tts_handler.py:")
    print(f"   MODEL_PATH  = kokoro-v1_0.onnx")
    print(f"   VOICES_PATH = voices.bin")
    print(f"\nThen run: python ai_server.py")

if __name__ == "__main__":
    main()
