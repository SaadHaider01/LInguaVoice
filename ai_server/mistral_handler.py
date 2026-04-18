import os
from dotenv import load_dotenv

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        from dotenv import load_dotenv
        load_dotenv()
        import os
        from groq import Groq
        api_key = os.environ.get('GROQ_API_KEY')
        print(f'[Groq] Initializing client... '
              f'key: {str(api_key)[:8]}...')
        _groq_client = Groq(api_key=api_key)
        print('[Groq] Client ready ✓')
    return _groq_client

def generate_response(prompt: str) -> str:
    try:
        client = get_groq_client()

        print("[Groq] Sending to cloud inference...")

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=300,
            stream=False
        )

        response = completion.choices[0].message.content.strip()
        print(f"[Groq] Response received: {response[:80]}")
        return response

    except Exception as e:
        print(f"[Groq] ERROR: {e}")
        return "I need a moment. Can you repeat that?"
