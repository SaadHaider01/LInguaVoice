import os
import io
import numpy as np
import soundfile as sf

# Paths relative to this file's location
_DIR         = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH   = os.path.join(_DIR, 'model_quantized.onnx')
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


def synthesize_speech(text: str, accent: str = 'american') -> bytes:
    """
    Synthesize text to speech using Kokoro ONNX.

    Args:
        text:   Text to synthesize
        accent: 'american' or 'british'

    Returns:
        bytes: Raw WAV audio (in-memory, never saved to disk)

    Raises:
        RuntimeError on failure — caller returns HTTP 503
    """
    from kokoro_onnx import Kokoro

    # Resolve voice, fallback if .bin not found
    preferred = VOICE_MAP.get(accent, 'af_heart')
    if os.path.exists(_voice_path(preferred)):
        voice = preferred
    else:
        # Pick first available voice as fallback
        voice = next(
            (v for v in AVAILABLE_VOICES if os.path.exists(_voice_path(v))),
            None
        )
        if voice is None:
            raise RuntimeError(
                f"No voice .bin files found in {VOICES_DIR}. "
                "Run: python -c \"from huggingface_hub import hf_hub_download; "
                "hf_hub_download('onnx-community/Kokoro-82M-v1.0-ONNX', 'voices/af_heart.bin', local_dir='.')\""
            )
        print(f'[TTS] Preferred voice {preferred} not found, using fallback: {voice}')

    print(f'[TTS] Synthesizing | accent={accent} | voice={voice}')
    print(f'[TTS] Text ({len(text)} chars): "{text[:60]}{"..." if len(text) > 60 else ""}"')
    print(f'[TTS] Model: {MODEL_PATH}')

    kokoro = Kokoro(MODEL_PATH, _voice_path(voice))

    samples, sample_rate = kokoro.create(
        text,
        voice=voice,
        speed=1.0,
        lang='en-us' if accent == 'american' else 'en-gb',
    )

    # Encode to WAV in-memory
    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format='WAV')
    buffer.seek(0)
    audio_bytes = buffer.read()

    print(f'[TTS] Generated {len(audio_bytes):,} bytes of WAV audio')
    return audio_bytes
