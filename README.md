# LinguaVoice 🎤

AI-Powered Conversational English Coach — built lean, bootstrapped, zero paid APIs.

---

## Folder Structure

```
linguavoice/
├── frontend/          React + Vite (port 5173)
├── backend/           Node.js + Express (port 3001)
├── ai_server/         Python Flask AI server (port 5000)
└── curriculum/        Lesson content JSON files
```

---

## ⚡ Quick Start (All 3 Servers)

Open **3 separate terminals**.

**Terminal 1 — Frontend**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

**Terminal 2 — Backend**
```bash
cd backend
cp .env.example .env   # then fill in your values
node server.js
# → http://localhost:3001/health
```

**Terminal 3 — AI Server (MUST use Python 3.11 venv)**
```bash
cd ai_server
venv\Scripts\activate
python ai_server.py
# → http://localhost:5000/health
# Mistral loads on startup (~30-60 seconds first time)
```

---

## 🐍 Python 3.11 Setup (ONE-TIME — Required for AI Server)

> **Why Python 3.11?** `openai-whisper` and PyTorch CUDA wheels are not stable on Python 3.14. Python 3.11 is the most compatible version for the entire ML stack on Windows with a GTX 1650.

### Step 1: Download Python 3.11

Go to: **https://www.python.org/downloads/release/python-3119/**

Download: **Windows installer (64-bit)** → `python-3.11.9-amd64.exe`

**IMPORTANT during install:**
- ✅ Check "Add python.exe to PATH"
- ✅ Check "Install for all users" (optional but recommended)

### Step 2: Create the venv using Python 3.11

```bash
cd ai_server
py -3.11 -m venv venv
venv\Scripts\activate
```

### Step 3: Install PyTorch (required by Whisper)

```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

> ⚠️ This download is ~2.5GB. Use a good connection.

### Step 4: Install llama-cpp-python (LLM engine)

```bash
pip install llama-cpp-python
```

> **Optional CUDA acceleration** (may be unstable on GTX 1650 — use CPU build first):
> ```bash
> set CMAKE_ARGS=-DLLAMA_CUDA=on
> pip install llama-cpp-python --force-reinstall
> ```

### Step 5: Install remaining dependencies

```bash
pip install -r requirements.txt
```

### Step 6: Verify

```bash
python -c "import torch; print('CUDA:', torch.cuda.is_available()); import whisper; print('Whisper OK')"
python -c "from llama_cpp import Llama; print('llama-cpp-python OK')"
```

---

## 🤖 Mistral Setup (ONE-TIME — Required for Step 3+)

**Engine: llama-cpp-python** (direct GGUF inference — no Ollama required)

### Model

- **File:** `mistral-7b-instruct-v0.2.Q4_K_M.gguf`
- **Location:** `C:\Users\saadh\Models\mistral-7b-instruct-v0.2.Q4_K_M.gguf`
- **Download:** [HuggingFace — TheBloke/Mistral-7B-Instruct-v0.2-GGUF](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF)

### Hardware config used
```python
llm = Llama(
    model_path=MODEL_PATH,
    n_gpu_layers=0,   # CPU inference (stable on 4GB VRAM)
    n_ctx=512,        # Keeps memory tight for 8GB RAM
    n_threads=6,      # i5-11400H has 6 physical cores
    verbose=False
)
```

### Verify the model loads

```bash
cd ai_server
venv\Scripts\activate
python -c "from mistral_handler import llm; print('Mistral loaded OK')"
```

---

## 🔥 Firebase Setup (ONE-TIME — Step 1 walkthrough)

Follow these steps **in order** in your browser.

### Step 1: Create Firebase project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Project name: `linguavoice`
4. **Disable** Google Analytics (not needed for MVP)
5. Click **"Create project"**

### Step 2: Enable Firestore

1. **Build → Firestore Database → Create database**
2. Choose **"Start in test mode"** (security rules added in Step 8)
3. Location: region closest to your users (e.g., `asia-south1` for India)

### Step 3: Enable Authentication

1. **Build → Authentication → Get started**
2. Enable: **Email/Password** and **Google**

### Step 4: Get your frontend config

1. **Project Settings → Your apps → Web (`</>`)** → Register app
2. Copy the config values into `frontend/.env`:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=linguavoice-abc12.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=linguavoice-abc12
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123:web:abc123
   VITE_API_URL=http://localhost:3001
   ```
   > **Note:** Firebase Storage is NOT used. No `VITE_FIREBASE_STORAGE_BUCKET` needed.

### Step 5: Get the backend service account

1. **Project Settings → Service Accounts → Generate new private key**
2. Save the downloaded JSON to `backend/` (it's gitignored)
3. In `backend/.env`, set:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./your-key-file.json
   ```

---

## 📁 Environment Files

| File | Purpose | Committed to git? |
|------|---------|-------------------|
| `frontend/.env` | Real Firebase keys | ❌ Never |
| `backend/.env` | Backend secrets + service account path | ❌ Never |
| `frontend/.env.example` | Template | ✅ Yes |
| `backend/.env.example` | Template | ✅ Yes |

---

## 🏗️ Build Steps

| Step | Feature | Status |
|------|---------|--------|
| 1 | Project Setup & Firebase | ✅ Complete |
| 2 | User Auth (Signup/Login) | ✅ Complete |
| 3 | Diagnostic Conversation | 🔒 Pending sign-off |
| 4 | Accent Selection + TTS | 🔒 Pending |
| 5 | Lesson Engine | 🔒 Pending |
| 6 | Freemium Paywall + Stripe | 🔒 Pending |
| 7 | Progress Dashboard | 🔒 Pending |
| 8 | Launch Prep | 🔒 Pending |

---

## 🔍 Health Checks

```bash
# Backend
curl http://localhost:3001/health

# Flask AI server
curl http://localhost:5000/health
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, port 5173 |
| Backend | Node.js + Express, port 3001 |
| AI Server | Python Flask, port 5000 |
| Database | Firebase Firestore (free tier) |
| Auth | Firebase Authentication |
| Storage | ❌ Not used — audio in-memory only |
| STT | OpenAI Whisper (local, base model) |
| LLM | Mistral 7B via llama-cpp-python (direct GGUF) |
| TTS | Kokoro TTS (added Step 4) |
| Deploy | Vercel (free tier) |
