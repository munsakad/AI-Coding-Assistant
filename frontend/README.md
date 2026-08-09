# CodeMentor AI — frontend (Next.js)

Auth, snippet storage, and the workspace UI. All Gemini + PyTorch work is
delegated to the Python backend in `../backend` — get that running first
(including training the model — see its README).

## Run it locally

Requires Node.js 18+, and the Python backend running on port 8000.

```bash
cd frontend
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000. Sign in with the seeded account
(`sam@codementor.dev` / `Student123!`) or register your own.

`.env` is pre-populated with a generated `NEXTAUTH_SECRET` and a
`FRONTEND_INTERNAL_API_KEY` already matched to the backend's
`INTERNAL_API_KEY` — no manual wiring needed unless you regenerate one
side and forget the other.

## Running both services

**Recommended:** from the project root, run `npm run dev` once (after doing
each service's one-time setup below) — that starts both frontend and
backend together in a single terminal. See the top-level README.

**Manual (two terminals)**, if you'd rather run this one on its own:

```bash
# Terminal 1
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

## How it works

- **Workspace** (`/workspace`) — pick a language, optionally describe what
  to generate, then Generate / Analyze / Optimize. The mentorship toggle
  changes explanation style (step-by-step vs terse) on every AI call.
- **Analyze** shows two things deliberately kept apart: Gemini's bug list +
  optimization suggestions in one card, and the PyTorch structural risk
  score (with its underlying features) in a separate card — see the
  top-level README for why they're never merged into one number.
- **Save snippet** persists the current code; saved snippets get an
  analysis history you can revisit and re-run analysis against.

## Data model

See `prisma/schema.prisma`: `User` → `Snippet[]` → `Analysis[]`.

## Going to production

- Swap Prisma's `sqlite` provider for `postgresql`.
- Set fresh `NEXTAUTH_SECRET` and `FRONTEND_INTERNAL_API_KEY` (update both
  services to match).
- Point `AI_BACKEND_URL` at wherever the Python service is deployed, and
  update `FRONTEND_ORIGIN` in the backend's `.env` accordingly.
