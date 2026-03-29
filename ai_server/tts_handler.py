# ============================================================
# ai_server/tts_handler.py
# Text-to-Speech — STUB for Step 1
#
# Will be implemented in Step 4 with Kokoro TTS or Chatterbox TTS.
# Until then, returns a structured error so the frontend can fall
# back to displaying text only (Step 8 fallback UX).
# ============================================================


def synthesize_speech(text: str, accent: str = "american") -> dict:
    """
    Convert text to speech audio.
    STUB: Returns error until Step 4 wires in Kokoro/Chatterbox TTS.

    Args:
        text:   Text to synthesize
        accent: "american" or "british"

    Returns:
        dict — error message in Step 1, audio bytes in Step 4+
    """
    print(f"[TTS] STUB called — text='{text[:40]}...', accent={accent}")
    print("[TTS] TTS not configured yet. Will be implemented in Step 4.")

    return {
        "error":   "TTS not configured yet",
        "message": "Kokoro/Chatterbox TTS will be wired in Step 4.",
        "text":    text,    # return original text so frontend can display it
        "accent":  accent,
    }
