import os
import io
from dotenv import load_dotenv

def synthesize_speech(text: str,
                      accent: str = 'american',
                      native_language: str = 'english'
                      ) -> bytes:
    load_dotenv()
    
    # Route native language text to gTTS
    if _is_native_language_text(text, native_language):
        return _gtts_synthesize(text, native_language)
    
    # English text → Azure Neural TTS
    return _azure_synthesize(text, accent)


def _azure_synthesize(text: str, 
                       accent: str) -> bytes:
    
    import azure.cognitiveservices.speech as speechsdk
    
    load_dotenv()
    speech_key = os.environ.get('AZURE_SPEECH_KEY')
    speech_region = os.environ.get('AZURE_SPEECH_REGION')
    
    # Best Azure Neural voices per accent
    voice_map = {
        'american':   'en-US-AriaNeural',
        'british':    'en-GB-SoniaNeural',
        'indian':     'en-IN-NeerjaNeural',
        'australian': 'en-AU-NatashaNeural'
    }
    voice = voice_map.get(accent, 'en-GB-SoniaNeural')
    
    print(f'[TTS] Azure Neural | voice={voice}')
    print(f'[TTS] Text: "{text[:60]}"')
    
    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            region=speech_region
        )
        speech_config.speech_synthesis_voice_name = voice
        
        # Output to memory (no speaker, no file)
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config,
            audio_config=None
        )
        
        result = synthesizer.speak_text_async(
            text
        ).get()
        
        if result.reason == (
            speechsdk.ResultReason
            .SynthesizingAudioCompleted
        ):
            audio_bytes = result.audio_data
            print(f'[TTS] Azure generated '
                  f'{len(audio_bytes)} bytes ✓')
            return audio_bytes
            
        else:
            cancellation = (
                speechsdk.CancellationDetails
                .from_result(result)
            )
            print(f'[TTS] Azure error: '
                  f'{cancellation.reason}')
            print(f'[TTS] Detail: '
                  f'{cancellation.error_details}')
            # Fallback to gTTS
            return _gtts_synthesize(text, 'english')
            
    except Exception as e:
        print(f'[TTS] Azure ERROR: {e}')
        import traceback
        traceback.print_exc()
        # Fallback to gTTS on any error
        return _gtts_synthesize(text, 'english')


def _gtts_synthesize(text: str,
                      native_language: str
                      ) -> bytes:
    """gTTS for native language speech"""
    from gtts import gTTS
    
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
    lang = lang_map.get(
        native_language.lower(), 'en'
    )
    
    print(f'[TTS] gTTS | lang={lang} | '
          f'"{text[:50]}"')
    
    try:
        tts = gTTS(text=text, lang=lang, 
                   slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        audio = buf.read()
        print(f'[TTS] gTTS generated '
              f'{len(audio)} bytes')
        return audio
    except Exception as e:
        print(f'[TTS] gTTS ERROR: {e}')
        raise e


def _is_native_language_text(text: str,
                               native_language: str
                               ) -> bool:
    if native_language == 'english':
        return False
    
    # Detect non-Latin scripts
    has_devanagari = any(
        '\u0900' <= c <= '\u097F' for c in text
    )
    has_arabic_script = any(
        '\u0600' <= c <= '\u06FF' for c in text
    )
    has_cjk = any(
        '\u4E00' <= c <= '\u9FFF' for c in text
    )
    
    if has_devanagari or has_arabic_script or has_cjk:
        return True
    
    # Detect romanized Hindi/Urdu
    if native_language in ['hindi', 'urdu']:
        markers = [
            'aaj', 'hum', 'yeh', 'kya', 'hai',
            'mein', 'boliye', 'seekhenge',
            'accha', 'bahut', 'nahi', 'bolo',
            'suno', 'ab', 'theek', 'chaliye'
        ]
        text_lower = text.lower()
        marker_count = sum(
            1 for m in markers 
            if m in text_lower
        )
        return marker_count >= 2
    
    return False
