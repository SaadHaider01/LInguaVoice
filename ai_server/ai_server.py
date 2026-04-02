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
os.environ["NO_COLOR"] = "1"
os.environ["TERM"] = "dumb"

import colorama
colorama.init(strip=True, convert=False)

import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from whisper_handler  import transcribe_audio
# mistral_handler is imported lazily inside /generate_response to avoid
# loading the 4GB model at startup — it loads on first request instead.
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
@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file'}), 400
        
        audio_file = request.files['audio']
        audio_bytes = audio_file.read()
        mime_type = audio_file.content_type or 'audio/webm'
        
        print(f'[Transcribe] Received {len(audio_bytes)} bytes, mime: {mime_type}')
        
        from whisper_handler import transcribe_audio
        transcript = transcribe_audio(audio_bytes, mime_type)
        
        # Force memory release before Mistral loads
        import gc
        import ctypes
        gc.collect()
        ctypes.windll.kernel32.SetProcessWorkingSetSize(-1, -1, -1)
        
        return jsonify({
            'status': 'success',
            'transcript': transcript,
            'confidence': 0.95
        })
        
    except Exception as e:
        print(f'[Transcribe] ERROR: {str(e)}')
        return jsonify({'error': str(e)}), 500


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

    # Lazy import — model loads here (not at startup) and unloads after response
    from mistral_handler import generate_response
    response_text = generate_response(full_prompt)
    return jsonify({"response": response_text})


# ─── POST /synthesize ────────────────────────────────────────────────────────
# Accepts: JSON body { "text": "...", "accent": "american" | "british" }
# Returns: audio/wav binary stream (in-memory, never saved)
@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    text   = data.get("text", "").strip()
    accent = data.get("accent", "american")

    if not text:
        return jsonify({"error": "Provide 'text' field"}), 400

    if accent not in ("american", "british"):
        accent = "american"

    try:
        wav_bytes = synthesize_speech(text, accent)
        from flask import Response
        return Response(
            wav_bytes,
            mimetype="audio/wav",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as e:
        print(f"[TTS] Error: {e}")
        return jsonify({"error": f"TTS failed: {str(e)}"}), 500


# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import flask.cli
    flask.cli.show_server_banner = lambda *args: None

    print("✅ LinguaVoice AI Server starting on http://127.0.0.1:5000")
    print("   Whisper: local base model (loads per request, then unloads)")
    print("   LLM:     Groq cloud API — llama-3.1-8b-instant")
    print("   TTS:     Kokoro local ONNX")
    print("   ⚡ Fast start — no local model pre-loading")
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
