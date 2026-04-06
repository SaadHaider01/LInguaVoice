import os
import io
import numpy as np
import soundfile as sf

_DIR         = os.path.dirname(os.path.abspath(__file__))
# Official kokoro-onnx v1.0 release files — download: python download_kokoro_models.py
MODEL_PATH   = os.path.join(_DIR, 'kokoro-v1.0.int8.onnx')  # 88MB int8 quantized
VOICES_PATH  = os.path.join(_DIR, 'voices-v1.0.bin')         # npz file, all 26 voices
VOICES_DIR   = os.path.join(_DIR, 'voices')

# Voice map — uses .bin files in the voices/ directory
VOICE_MAP = {
    'american': 'af_heart',   # warm American female
    'british':  'bf_emma',    # clear British female
}

# Available fallback voices (in priority order)
AVAILABLE_VOICES = ['af_heart', 'af_bella', 'bf_emma', 'am_michael', 'bm_george']


def _voice_path(voice_id: str) -> str:
    """Return absolute path to a voice .bin file."""
    return os.path.join(VOICES_DIR, f'{voice_id}.bin')


def _gtts_synthesize(text: str, native_language: str) -> bytes:
    from gtts import gTTS
    import io
    
    lang_map = {
        'hindi':    'hi',
        'urdu':     'ur',
        'bengali':  'bn',
        'tamil':    'ta',
        'telugu':   'te',
        'marathi':  'mr',
        'punjabi':  'pa',
        'arabic':   'ar',
        'spanish':  'es',
        'mandarin': 'zh-CN',
        'english':  'en'
    }
    lang = lang_map.get(native_language.lower(), 'hi')
    
    print(f'[TTS] gTTS | lang={lang} | text="{text[:50]}"')
    
    try:
        tts = gTTS(text=text, lang=lang, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        audio = buf.read()
        print(f'[TTS] gTTS generated {len(audio)} bytes')
        return audio
    except Exception as e:
        print(f'[TTS] gTTS ERROR: {e}')
        # Fallback to English TTS
        return _kokoro_synthesize(text, 'american')

def _estimate_native_ratio(text: str) -> float:
    """
    Estimate if romanized text is native language.
    Simple heuristic: check for common Hindi/Urdu romanized words.
    """
    hindi_markers = [
        'aaj', 'hum', 'yeh', 'kya', 'hai',
        'mein', 'aap', 'boliye', 'seekhenge',
        'accha', 'theek', 'bahut', 'phir',
        'nahi', 'karo', 'bolo', 'suno'
    ]
    
    text_lower = text.lower()
    words = text_lower.split()
    
    if len(words) == 0:
        return 0.0
    
    native_word_count = sum(
        1 for word in words 
        if any(marker in word for marker in hindi_markers)
    )
    
    return native_word_count / len(words)

def synthesize_speech(text: str, accent: str = 'american', native_language: str = 'english', speed: float = 1.0) -> bytes:
    """Routes speech synthesis between native (gTTS) and English (Kokoro)."""
    
    # Detect if text contains native script
    has_devanagari = any('\u0900' <= c <= '\u097F' for c in text)
    has_arabic = any('\u0600' <= c <= '\u06FF' for c in text)
    has_chinese = any('\u4E00' <= c <= '\u9FFF' for c in text)
    
    is_native_script = has_devanagari or has_arabic or has_chinese
    
    if is_native_script:
        return _gtts_synthesize(text, native_language)
    
    native_ratio = _estimate_native_ratio(text)
    if native_ratio > 0.4 and native_language.lower() != 'english':
        return _gtts_synthesize(text, native_language)
    
    return _kokoro_synthesize(text, accent, speed)

def _kokoro_synthesize(text: str, accent: str = 'american', speed: float = 1.0) -> bytes:
    """
    Synthesize text to speech using Kokoro ONNX.
    """
    from kokoro_onnx import Kokoro

    preferred = VOICE_MAP.get(accent, 'af_heart')
    if os.path.exists(_voice_path(preferred)):
        voice = preferred
    else:
        voice = next(
            (v for v in AVAILABLE_VOICES if os.path.exists(_voice_path(v))),
            None
        )
        if voice is None:
            raise RuntimeError(f"No voice .bin files found in {VOICES_DIR}.")
        print(f'[TTS] Preferred voice {preferred} not found, using fallback: {voice}')

    print(f'[TTS] Synthesizing | accent={accent} | voice={voice}')
    print(f'[TTS] Text ({len(text)} chars): "{text[:60]}{"..." if len(text) > 60 else ""}"')
    print(f'[TTS] Model: {MODEL_PATH}')

    if not os.path.exists(MODEL_PATH) or not os.path.exists(VOICES_PATH):
        raise RuntimeError(f"Kokoro models not found.")

    kokoro = Kokoro(MODEL_PATH, VOICES_PATH)

    samples, sample_rate = kokoro.create(
        text,
        voice=voice,
        speed=speed,
        lang='en-us' if accent == 'american' else 'en-gb',
    )

    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format='WAV')
    buffer.seek(0)
    audio_bytes = buffer.read()

    print(f'[TTS] Generated {len(audio_bytes):,} bytes of WAV audio')
    return audio_bytes
