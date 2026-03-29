# ============================================================
# ai_server/ai_server.py
# LinguaVoice — Python Flask AI server
# Bridges the Node.js backend to local AI models:
#   - Whisper (Speech-to-Text)
#   - Mistral 7B via Ollama (LLM)
#   - Kokoro TTS (Text-to-Speech — added Step 4)
#
# Runs on: http://localhost:5000
# ============================================================

import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from whisper_handler  import transcribe_audio
from mistral_handler  import generate_response
from tts_handler      import synthesize_speech

load_dotenv()

app = Flask(__name__)

# Only allow requests from localhost (backend server and direct testing)
CORS(app, origins=[
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
])


# ─── Health check ────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":  "ok",
        "service": "linguavoice-ai-server",
        "version": "1.0.0",
    })


# ─── POST /transcribe ────────────────────────────────────────────────────────
# Accepts: multipart/form-data with field "audio" (WebM/WAV/MP3 blob)
# Returns: { "transcript": "...", "language": "en", "confidence": 0.95 }
@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided. Send as form field 'audio'."}), 400

    audio_file = request.files["audio"]

    # Save to a named temp file — Whisper needs a file path, not a stream
    suffix = os.path.splitext(audio_file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        result = transcribe_audio(tmp_path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
    finally:
        # Always clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ─── POST /generate_response ─────────────────────────────────────────────────
# Accepts: JSON body
#   {
#     "system_prompt": "...",   // the [INST] teaching context
#     "user_message":  "...",   // student's transcribed speech
#   }
# Returns: { "response": "..." }
@app.route("/generate_response", methods=["POST"])
def generate():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    system_prompt = data.get("system_prompt", "")
    user_message  = data.get("user_message", "")

    if not user_message and not system_prompt:
        return jsonify({"error": "Provide at least 'system_prompt' or 'user_message'"}), 400

    # Combine into single Mistral instruct prompt
    if system_prompt:
        full_prompt = f"[INST] {system_prompt}\n\nStudent said: {user_message} [/INST]"
    else:
        full_prompt = f"[INST] {user_message} [/INST]"

    response_text = generate_response(full_prompt)
    return jsonify({"response": response_text})


# ─── POST /synthesize ────────────────────────────────────────────────────────
# Accepts: JSON body { "text": "...", "accent": "american" | "british" }
# Returns: audio/wav file stream  (or JSON error if TTS not configured)
@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    text   = data.get("text", "")
    accent = data.get("accent", "american")

    if not text:
        return jsonify({"error": "Provide 'text' field"}), 400

    try:
        result = synthesize_speech(text, accent)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"TTS failed: {str(e)}"}), 500


# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("✅ LinguaVoice AI Server starting on http://127.0.0.1:5000")
    print("   Whisper model: base (loads on first request)")
    print("   Ollama model:  mistral-local")
    print("   TTS:           not configured (Step 4)")
    app.run(host="127.0.0.1", port=5000, debug=False)
