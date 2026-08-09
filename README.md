# CodeMentor AI — AI Coding Assistant

Multi-language code generation, bug detection, and optimization, backed by
two independent signals: Gemini (semantic review) and a small, actually
trained PyTorch model (structural bug-risk scoring). A mentorship toggle
switches every AI explanation between step-by-step teaching style and
terse expert style.

Two services, no Docker:
- **`frontend/`** — Next.js/React. Auth, snippet storage, workspace UI.
- **`backend/`** — Python/FastAPI. Owns all Gemini calls + hosts the
  PyTorch model.

## Quick start

One-time setup for each service, then one command to run both together.

```bash
# Backend setup (once)
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python train.py                 # trains the PyTorch risk model (~1 min)
# add your GEMINI_API_KEY to backend/.env (see backend/README.md)
deactivate
cd ..

# Frontend setup (once)
cd frontend
npm install
npm run db:push
npm run db:seed
cd ..

# Install the root runner (once)
npm install
```

Then, every time you want to work on it — **one command, one terminal**:

```bash
npm run dev
```

This starts both the Next.js frontend and the FastAPI backend together,
with color-coded, prefixed output (`FRONTEND` in blue, `BACKEND` in green)
so you can tell them apart in the same terminal. Ctrl+C stops both.

Open http://localhost:3000.

If you'd rather run them separately (e.g. to restart just one), each
service's own README still documents that.

## Whiteboard: why two separate, never-blended signals

Gemini is good at semantic bugs (off-by-one logic, wrong API usage,
misunderstood requirements) but can hallucinate issues that aren't there.
A small structural model (nesting depth, branch density, magic numbers,
empty catch blocks, comment ratio) is shallow but consistent and cheap to
run. Averaging them into one "quality score" would hide *which* signal is
saying what — if they disagree, that disagreement is itself useful
information a blended number would throw away. So the UI always shows
Gemini's findings and the PyTorch risk score in separate cards, never
merged.

The PyTorch model is real, not a stub: `backend/train.py` generates a
synthetic labeled dataset from an explicit, documented risk formula and
trains a small MLP on it. It's not claiming real-world bug statistics —
it's a legitimate way to bootstrap a working model for v1; swap in a real
labeled dataset later without touching anything else (see the comment at
the top of `train.py`).

## Trust boundary between services

Same pattern as this suite's other AI-backed apps: the Python service
only accepts requests carrying a shared-secret header (`X-Internal-Key`),
generated automatically into both `.env` files so they match out of the
box. See `backend/main.py`.

## Reliability

Every Gemini call is schema-constrained (`response_schema`) and validated
twice — Pydantic in Python, zod in Next.js — before anything is trusted,
saved, or shown.
