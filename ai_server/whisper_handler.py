import os
import sys
import gc
import whisper
import tempfile

# Force ffmpeg path for Windows
os.environ["PATH"] = (
    r"C:\Windows\System32" + os.pathsep + 
    os.environ.get("PATH", "")
)

# Also set ffmpeg path directly for whisper
import whisper.audio
whisper.audio.FFMPEG = r"C:\Windows\System32\ffmpeg.exe"

def transcribe_audio(audio_bytes: bytes,
                     mime_type: str = 'audio/webm') -> str:

    ext_map = {
        'audio/webm': '.webm',
        'audio/wav': '.wav',
        'audio/mp4': '.mp4',
        'audio/ogg': '.ogg',
        'audio/mpeg': '.mp3',
    }
    suffix = ext_map.get(mime_type, '.webm')

    tmp_path = os.path.join(
        tempfile.gettempdir(),
        f'whisper_audio_{os.getpid()}{suffix}'
    )

    try:
        with open(tmp_path, 'wb') as f:
            f.write(audio_bytes)

        print(f'[Whisper] Saved to {tmp_path}')
        print(f'[Whisper] Size: {os.path.getsize(tmp_path)} bytes')
        
        # Verify ffmpeg is accessible
        import subprocess
        result = subprocess.run(
            ['ffmpeg', '-version'], 
            capture_output=True, 
            text=True
        )
        print(f'[Whisper] ffmpeg check: {result.returncode}')

        print(f'[Whisper] Loading model...')
        model = whisper.load_model('base')
        print(f'[Whisper] Transcribing...')

        result = model.transcribe(tmp_path, language='en')
        transcript = result['text'].strip()

        print(f'[Whisper] Transcript: {transcript[:100]}')

        # Cleanup model from memory
        del model
        gc.collect()
        import ctypes
        ctypes.windll.kernel32.SetProcessWorkingSetSize(-1, -1, -1)

        print(f'[Whisper] Done.')
        return transcript

    except Exception as e:
        print(f'[Whisper] ERROR: {type(e).__name__}: {e}')
        import traceback
        traceback.print_exc()
        raise e

    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception as cleanup_err:
                print(f'[Whisper] Cleanup warning: {cleanup_err}')
