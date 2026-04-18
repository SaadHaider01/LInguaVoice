import os
import io
import tempfile
import gc

def transcribe_audio(audio_bytes: bytes,
                     mime_type: str = 'audio/wav',
                     context: str = None,
                     lesson_level: str = None
                     ) -> tuple:
    
    from dotenv import load_dotenv
    load_dotenv()
    
    use_local = os.environ.get(
        'USE_LOCAL_WHISPER', 'false'
    ).lower() == 'true'
    
    if use_local:
        return _transcribe_local(
            audio_bytes, mime_type, context
        )
    else:
        return _transcribe_groq(
            audio_bytes, mime_type, context,
            lesson_level
        )


def _transcribe_groq(audio_bytes: bytes,
                      mime_type: str,
                      context: str = None,
                      lesson_level: str = None
                      ) -> tuple:
    
    from groq import Groq
    import os
    
    api_key = os.environ.get('GROQ_API_KEY')
    client = Groq(api_key=api_key)
    
    # Save to temp file (Groq needs file object)
    suffix_map = {
        'audio/webm': '.webm',
        'audio/wav': '.wav',
        'audio/mp4': '.mp4',
        'audio/ogg': '.ogg',
        'audio/mpeg': '.mp3'
    }
    suffix = suffix_map.get(mime_type, '.wav')
    
    tmp_path = os.path.join(
        tempfile.gettempdir(),
        f'groq_audio_{os.getpid()}{suffix}'
    )
    
    try:
        with open(tmp_path, 'wb') as f:
            f.write(audio_bytes)
        
        print(f'[Whisper/Groq] Transcribing '
              f'{len(audio_bytes)} bytes...')
        
        # Build prompt for context
        prompt = None
        if lesson_level == 'A0' and context:
            prompt = (
                f"The student is practicing "
                f"the letter {context}. "
                f"They are saying a single "
                f"letter or its sound."
            )
        
        with open(tmp_path, 'rb') as audio_file:
            transcription_params = {
                'file': (
                    f'audio{suffix}', 
                    audio_file, 
                    mime_type
                ),
                'model': 'whisper-large-v3',
                'language': 'en',
                'response_format': 'json',
                'temperature': 0.0
            }
            if prompt:
                transcription_params['prompt'] = prompt
            
            result = client.audio.transcriptions.create(
                **transcription_params
            )
        
        transcript = result.text.strip()
        print(f'[Whisper/Groq] Transcript: '
              f'"{transcript[:80]}"')
        
        # Calculate simple confidence score
        confidence = 0.95 if transcript else 0.0
        
        # The AI server's call expect 0-100 scale here
        return transcript, int(confidence * 100)
        
    except Exception as e:
        print(f'[Whisper/Groq] ERROR: {e}')
        print('[Whisper/Groq] Falling back '
              'to local Whisper...')
        return _transcribe_local(
            audio_bytes, mime_type, context
        )
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass


def _transcribe_local(audio_bytes: bytes,
                       mime_type: str,
                       context: str = None
                       ) -> tuple:
    """
    Local Whisper fallback.
    Only used if USE_LOCAL_WHISPER=true
    or if Groq transcription fails.
    """
    import whisper
    
    suffix_map = {
        'audio/webm': '.webm',
        'audio/wav': '.wav',
        'audio/mp4': '.mp4',
    }
    suffix = suffix_map.get(mime_type, '.wav')
    
    tmp_path = os.path.join(
        tempfile.gettempdir(),
        f'whisper_local_{os.getpid()}{suffix}'
    )
    
    try:
        with open(tmp_path, 'wb') as f:
            f.write(audio_bytes)
        
        print('[Whisper/Local] Loading model...')
        model = whisper.load_model('base')
        print('[Whisper/Local] Transcribing...')
        
        options = {'language': 'en'}
        if context:
            options['initial_prompt'] = (
                f"Expected: {context}"
            )
        
        result = model.transcribe(
            tmp_path, **options
        )
        transcript = result['text'].strip()
        
        segments = result.get('segments', [])
        if segments:
            avg_logprob = sum(seg.get('avg_logprob', -1.0) for seg in segments) / len(segments)
        else:
            avg_logprob = -1.0
            
        score = max(0, min(100, int((avg_logprob + 1.0) * 100)))

        del model
        gc.collect()
        
        print(f'[Whisper/Local] Transcript: '
              f'"{transcript[:80]}"')
        return transcript, score
        
    except Exception as e:
        print(f'[Whisper/Local] ERROR: {e}')
        return '', 0
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass
