# ============================================================
# ai_server/mistral_handler.py
# LinguaVoice — LLM inference via llama-cpp-python
#
# Engine: llama-cpp-python (direct GGUF, no Ollama required)
# Model:  mistral-7b-instruct-v0.2.Q4_K_M.gguf
# Path:   C:\Users\saadh\Models\mistral-7b-instruct-v0.2.Q4_K_M.gguf
#
# n_gpu_layers=0  → pure CPU inference (stable on GTX 1650 with 4GB VRAM)
# n_ctx=512       → keeps memory tight for 8GB RAM
# n_threads=6     → matches i5-11400H (6 physical cores)
# ============================================================

from llama_cpp import Llama
import os

MODEL_PATH = r"C:\Users\saadh\Models\mistral-7b-instruct-v0.2.Q4_K_M.gguf"

print("Loading Mistral model... (first load takes 30-60 seconds)")

llm = Llama(
    model_path=MODEL_PATH,
    n_gpu_layers=0,
    n_ctx=512,
    n_threads=6,
    verbose=False
)

print("Mistral ready!")


def generate_response(prompt: str) -> str:
    try:
        response = llm(
            prompt,
            max_tokens=150,
            temperature=0.7,
            top_p=0.9,
            stop=["\n\n", "Student:", "User:"]
        )
        return response['choices'][0]['text'].strip()

    except Exception as e:
        print(f"Mistral error: {e}")
        return "I need a moment. Can you repeat that?"
