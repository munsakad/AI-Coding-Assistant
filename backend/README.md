# AI Coding Assistant — backend (Python/FastAPI + PyTorch)

Owns all Gemini calls (generation, bug analysis, optimization) and hosts a
small trained PyTorch model that scores structural "bug risk" independently
of Gemini's judgment. Called server-to-server by the Next.js frontend —
never directly by the browser.

## Setup

Requires Python 3.10+.

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

`.env` is already created with a generated `INTERNAL_API_KEY` — copy that
same value into the frontend's `.env` as `FRONTEND_INTERNAL_API_KEY` (the
frontend's `.env` is pre-seeded to already match, so you likely don't need
to touch this). Add your `GEMINI_API_KEY` (free at
https://aistudio.google.com/apikey).

## Train the PyTorch model (one-time, required)

```bash
python train.py
```

Takes under a minute on a laptop CPU. This generates a synthetic labeled
dataset from an explicit risk formula (see the big comment at the top of
`train.py` for exactly how and why) and trains a small MLP, saving
`model/weights.pt`. The `/analyze` endpoint works without this — it just
returns `risk_score: -1` for the PyTorch signal until you've trained it —
but the actual risk scoring needs this step done once.

## Run

**Recommended:** from the project root, run `npm run dev` once you've done
this setup — that starts this service together with the frontend in one
terminal. See the top-level README.

**Manual**, if you'd rather run just this service on its own:

```bash
uvicorn main:app --reload --port 8000
```

Runs at http://localhost:8000. Check http://localhost:8000/health.

## Endpoints

- `POST /generate` — `{prompt, language, mentorship}` → generated code + explanation.
- `POST /analyze` — `{code, language, mentorship}` → Gemini bug findings +
  optimization suggestions + explanation, PLUS a separately-computed PyTorch
  `risk_score` (0-100) and the raw structural `risk_features` it was based
  on. These two signals are never blended — see the top-level README's
  whiteboard writeup for why.
- `POST /optimize` — `{code, language, mentorship}` → rewritten code + a
  bullet list of specific changes made.

All three require an `X-Internal-Key` header matching `INTERNAL_API_KEY`.

## Files

- `model/features.py` — language-agnostic structural feature extraction
  (brace/keyword counting, indentation depth, comment ratio — not a real
  parser, which is the deliberate trade-off for working across many
  languages without per-language grammar rules).
- `model/network.py` — the PyTorch model definition (small MLP).
- `model/infer.py` — loads trained weights, scores a snippet.
- `train.py` — generates synthetic training data and trains the model.
- `gemini_service.py` — all Gemini prompting + schema-constrained JSON +
  Pydantic validation.
