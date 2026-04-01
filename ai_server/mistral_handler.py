import os

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

def generate_response(prompt: str) -> str:
    try:
        from groq import Groq

        client = Groq(api_key=GROQ_API_KEY)

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
