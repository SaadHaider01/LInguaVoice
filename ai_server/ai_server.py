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
        transcript, score = transcribe_audio(audio_bytes, mime_type)
        
        # Force memory release before Mistral loads
        import gc
        import ctypes
        gc.collect()
        ctypes.windll.kernel32.SetProcessWorkingSetSize(-1, -1, -1)
        
        return jsonify({
            'status': 'success',
            'transcript': transcript,
            'pronunciation_score': score,
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


# ─── POST /lesson ─────────────────────────────────────────────────────────────
# New A0-aware lesson endpoint that uses Groq directly.
# A1+ users continue using /generate_response (unchanged).
# Groq API key is always loaded inside this function — never at module level.
# Whisper uses manual temp file paths — never tempfile context manager on Windows.
@app.route("/lesson", methods=["POST"])
def lesson():
    import base64
    import os
    import json
    import time
    from groq import Groq

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    # ── Extract request fields ──────────────────────────────────────
    audio_b64       = data.get("audio", "")
    step            = data.get("step", "warmup")
    level           = data.get("level", "A1")
    native_language = data.get("native_language", "other")
    lesson_topic    = data.get("lesson_topic", "")
    history         = data.get("history", [])
    is_zero_knowledge = data.get("is_zero_knowledge", False)
    accent_preference = data.get("accent_preference", "american")
    review_mode     = data.get("review_mode", False)
    session_stats   = data.get("session_stats", {"total_attempts": 0, "correct_attempts": 0})

    total_attempts   = int(session_stats.get("total_attempts", 0))
    correct_attempts = int(session_stats.get("correct_attempts", 0))

    # ── Transcribe audio (Whisper) ─────────────────────────────────
    transcript = ""
    if audio_b64:
        tmp_input  = None
        tmp_wav    = None
        try:
            # Manual temp file path — never tempfile context manager on Windows
            tmp_input = os.path.join(os.environ.get("TEMP", "C:\\Temp"), f"lv_lesson_in_{int(time.time()*1000)}.webm")
            tmp_wav   = os.path.join(os.environ.get("TEMP", "C:\\Temp"), f"lv_lesson_out_{int(time.time()*1000)}.wav")

            audio_bytes = base64.b64decode(audio_b64)
            with open(tmp_input, "wb") as f:
                f.write(audio_bytes)

            # Convert to WAV for Whisper using ffmpeg
            import subprocess
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_input, tmp_wav],
                capture_output=True, check=True
            )

            from whisper_handler import transcribe_audio
            with open(tmp_wav, "rb") as wf:
                wav_bytes = wf.read()
            transcript, _ = transcribe_audio(wav_bytes, "audio/wav")

        except Exception as e:
            print(f"[/lesson Whisper] Error: {e}")
            transcript = ""
        finally:
            # Clean up temp files manually
            for tmp_path in [tmp_input, tmp_wav]:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass

    # ── Build system prompt ────────────────────────────────────────
    use_a0_mode = (level == "A0") or is_zero_knowledge

    # Bilingual ratios for A1-B1
    BILINGUAL_RATIO = {
        "A0": {"native": 100, "english": 0},
        "A1": {"native": 70,  "english": 30},
        "A2": {"native": 50,  "english": 50},
        "B1": {"native": 20,  "english": 80},
        "B2": {"native": 0,   "english": 100},
        "C1": {"native": 0,   "english": 100},
        "C2": {"native": 0,   "english": 100},
    }

    history_text = "\n".join([
        f"{'Luna' if m.get('role') == 'assistant' else 'Student'}: {m.get('content', '')}"
        for m in history[-3:]  # last 3 turns only
    ])

    if use_a0_mode:
        # ── A0 Bilingual prompt ────────────────────────────────────
        base_prompt = f"""You are Luna, a warm and endlessly patient English teacher.
Your student speaks {native_language} and knows zero English.

Today's lesson: {lesson_topic}
Current step: {step}
Conversation so far:
{history_text}

RULES — follow strictly:
- Communicate ONLY in {native_language} except when demonstrating English sounds/words
- English sounds/words: write in quotes, describe using familiar {native_language} sound references
- Maximum 2 sentences per response — never more
- Never use the word "wrong" — say "let's try once more"
- Celebrate every attempt before correcting
- Be warm and human — like a beloved teacher
"""
        # Step-specific additions
        step_additions = {
            "warmup": f"Greet the student warmly in {native_language}. State today's lesson in one sentence. Ask if ready with a yes/no question. Max 2 sentences.",
            "teaching": f"Teach {lesson_topic}. Explain in {native_language}. Relate to closest {native_language} sound. Show English version in quotes. Invite student to try. Max 3 sentences.",
            "guided": f"Student said: '{transcript}'\nIf correct: celebrate specifically, say what was good, move on.\nIf close: praise first, demonstrate correct sound again gently.\nIf unclear: encourage warmly, demonstrate again, ask to retry.\nNever say wrong. Max 2 sentences.",
            "freetalk": f"Have a simple exchange about what was just learned. Ask one question answerable using only today's sounds. Stay in {native_language} with English sounds in quotes only. Max 1 question.",
            "feedback": f"Summarize today in {native_language}. Name 2 specific things the student did well (be concrete). Give 1 simple home practice task (repeating sounds only — no writing). Encourage warmly. Max 4 sentences.",
        }
        system_prompt = base_prompt + "\n" + step_additions.get(step, "Respond helpfully in 2 sentences.")

    else:
        # ── Standard prompt with bilingual ratio injection ──────────
        ratio = BILINGUAL_RATIO.get(level, {"native": 0, "english": 100})
        system_prompt = f"""You are Luna, a professional and warm English teacher.
Student level: {level}
Native language: {native_language}
Lesson topic: {lesson_topic}
Step: {step}

Conversation so far:
{history_text}

Student said: "{transcript}"

"""
        if ratio["native"] > 0:
            system_prompt += f"Respond approximately {ratio['native']}% in {native_language} and {ratio['english']}% in English. Shift naturally toward more English as the student improves.\n"
        system_prompt += "Keep response under 60 words. Be encouraging and clear."

    # ── Review mode flag ──────────────────────────────────────────
    if review_mode:
        system_prompt += "\n\nThis student has attempted this lesson multiple times. Use even simpler language, more examples, slower progression. Be extra encouraging."

    # ── Update session stats based on step ───────────────────────
    # We increment total_attempts on every guided turn.
    # We determine correct if Groq response lacks correction language.
    # Final scoring happens on feedback step.
    if step == "guided":
        total_attempts += 1

    # ── Call Groq ─────────────────────────────────────────────────
    # Key always loaded inside function — never module level (absolute rule)
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_api_key:
        return jsonify({"error": "GROQ_API_KEY not configured"}), 500

    response_text = ""
    try:
        client = Groq(api_key=groq_api_key)
        messages = [{"role": "system", "content": system_prompt}]
        if transcript:
            messages.append({"role": "user", "content": transcript})

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            max_tokens=200,
            temperature=0.7,
        )
        response_text = completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"[/lesson Groq] Error: {e}")
        response_text = "I'm here with you. Let's try that again." if use_a0_mode else "Let's try that again. You're doing great!"

    # ── Heuristic: was guided attempt correct? ─────────────────────
    # Simple keyword check — if response contains celebration language, count as correct
    if step == "guided":
        celebration_keywords = ["great", "perfect", "excellent", "wonderful", "correct",
                                 "well done", "amazing", "fantastic", "शानदार", "बहुत अच्छे",
                                 "زبردست", "চমৎকার", "அருமை", "అద్భుతం"]
        if any(kw.lower() in response_text.lower() for kw in celebration_keywords):
            correct_attempts += 1

    # ── Score calculation on feedback step ────────────────────────
    score = None
    lesson_complete = False
    if step == "feedback":
        if total_attempts > 0:
            score = round((correct_attempts / total_attempts) * 100)
        else:
            score = 75  # default if no guided turns tracked
        lesson_complete = True

    # ── Generate TTS ──────────────────────────────────────────────
    audio_out_b64 = None
    try:
        from tts_handler import synthesize_speech
        wav_bytes = synthesize_speech(response_text, accent_preference)
        audio_out_b64 = base64.b64encode(wav_bytes).decode("utf-8")
    except Exception as e:
        print(f"[/lesson TTS] Error: {e}")

    # ── Build response ────────────────────────────────────────────
    response_payload = {
        "text":  response_text,
        "audio": audio_out_b64,
        "step":  step,
        "session_stats": {
            "total_attempts":   total_attempts,
            "correct_attempts": correct_attempts,
        },
    }

    if lesson_complete:
        response_payload["score"]           = score
        response_payload["lesson_complete"] = True

    return jsonify(response_payload)




# ─── POST /pronounce ─────────────────────────────────────────────────────────
@app.route("/pronounce", methods=["POST"])
def pronounce():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    word   = data.get("word", "").strip()
    accent = data.get("accent", "american")

    if not word:
        return jsonify({"error": "Provide 'word' field"}), 400

    try:
        import eng_to_ipa
        import base64
        
        phonetic = eng_to_ipa.convert(word)
        
        wav_normal = synthesize_speech(word, accent, speed=1.0)
        wav_slow = synthesize_speech(word, accent, speed=0.5)
        
        return jsonify({
            "normal": base64.b64encode(wav_normal).decode('utf-8'),
            "slow": base64.b64encode(wav_slow).decode('utf-8'),
            "phonetic": phonetic
        })
    except Exception as e:
        print(f"[Pronounce] Error: {e}")
        return jsonify({"error": f"Pronounce failed: {str(e)}"}), 500

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
