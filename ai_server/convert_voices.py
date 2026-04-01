"""
convert_voices.py — Converts raw float32 .bin voice files into
voices.npz that kokoro-onnx can load with np.load().

The Kokoro-82M voice packs are raw float32 tensors of shape (510, 256):
    510 = max phoneme positions
    256 = style hidden dimension

Run from ai_server/:
    python convert_voices.py
"""
import os
import numpy as np

VOICES_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voices")
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voices.npz")

# Kokoro-82M voice pack shape (from model architecture)
STYLE_DIM    = 256
N_PHONEMES   = 510   # 522240 bytes / 4 bytes / 256 dim = 510

def main():
    voice_data = {}

    for fname in sorted(os.listdir(VOICES_DIR)):
        if not fname.endswith(".bin"):
            continue
        voice_id = fname[:-4]
        fpath    = os.path.join(VOICES_DIR, fname)
        size     = os.path.getsize(fpath)

        try:
            # Load as raw float32 bytes — no header, pure tensor data
            raw = np.fromfile(fpath, dtype=np.float32)
            
            # Verify expected size
            expected = N_PHONEMES * STYLE_DIM
            if raw.size != expected:
                print(f"  ⚠️  {voice_id}: got {raw.size} floats, expected {expected}")
                print(f"         {size} bytes / 4 = {raw.size} floats")
                voice_data[voice_id] = raw.reshape(-1, 1, STYLE_DIM)
            else:
                # Shape (510, 1, 256) so voicepack[n_phonemes] → (1, 256) 2D tensor
                # (the ONNX style input expects rank 2, not rank 1)
                arr = raw.reshape(N_PHONEMES, 1, STYLE_DIM)
                voice_data[voice_id] = arr
                print(f"  ✅ {voice_id} — shape: {arr.shape}, dtype: {arr.dtype}")

        except Exception as e:
            print(f"  ❌ {voice_id} — failed: {e}")

    if not voice_data:
        print("No voice files loaded.")
        return

    np.savez(OUTPUT_PATH, **voice_data)
    print(f"\n✅ Saved to: {OUTPUT_PATH}")
    print(f"   Voices: {list(voice_data.keys())}")

if __name__ == "__main__":
    main()
