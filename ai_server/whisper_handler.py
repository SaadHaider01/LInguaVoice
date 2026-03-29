# ============================================================
# ai_server/whisper_handler.py
# Handles speech-to-text using OpenAI Whisper (local, base model)
#
# Memory strategy: model is loaded fresh per request and released
# after transcription — keeps VRAM usage low on GTX 1650 (4GB).
# This adds ~2-3s overhead per call but is necessary on 8GB RAM.
# ============================================================

import gc
import torch
import whisper

# Whisper model size — "base" uses ~1GB VRAM, good for GTX 1650
WHISPER_MODEL_SIZE = "base"


def transcribe_audio(audio_path: str) -> dict:
    """
    Transcribe an audio file using Whisper.

    Args:
        audio_path: Absolute path to audio file (WAV, WebM, MP3, etc.)

    Returns:
        dict with keys:
          - transcript  (str): the transcribed text
          - language    (str): detected language code, e.g. "en"
          - confidence  (float): average log-probability as a 0-1 score
    """
    model = None
    try:
        print(f"[Whisper] Loading {WHISPER_MODEL_SIZE} model...")
        # Load model to GPU if available, else CPU
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = whisper.load_model(WHISPER_MODEL_SIZE, device=device)
        print(f"[Whisper] Model loaded on {device}. Transcribing...")

        result = model.transcribe(
            audio_path,
            language="en",       # force English — MVP scope
            fp16=torch.cuda.is_available(),  # fp16 only on GPU
        )

        transcript = result.get("text", "").strip()
        language   = result.get("language", "en")

        # Calculate rough confidence from segment log-probs
        segments = result.get("segments", [])
        if segments:
            avg_logprob = sum(s.get("avg_logprob", -1.0) for s in segments) / len(segments)
            # Convert log-prob to 0-1 (clamp: -1.0 → ~0.37, 0.0 → 1.0)
            import math
            confidence = round(min(1.0, max(0.0, math.exp(avg_logprob))), 3)
        else:
            confidence = 0.0

        print(f"[Whisper] Done. Transcript length: {len(transcript)} chars. Confidence: {confidence}")
        return {
            "transcript": transcript,
            "language":   language,
            "confidence": confidence,
        }

    finally:
        # Unload model and free VRAM immediately
        if model is not None:
            del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        print("[Whisper] Model unloaded, memory freed.")
