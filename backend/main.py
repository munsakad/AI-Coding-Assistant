import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from schemas import GenerateRequest, GenerateResponse, AnalyzeRequest, AnalyzeResponse, OptimizeRequest, OptimizeResponse
from gemini_service import generate_code, analyze_code, optimize_code, GenerationError
from model.infer import score_risk, ModelNotTrainedError

load_dotenv()

app = FastAPI(title="AI Coding Assistant Service")

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def verify_internal_key(x_internal_key: str | None):
    """Same trust-boundary pattern as the resume builder's backend: only
    the Next.js server (never the browser) should be calling this service,
    enforced by a header both .env files are pre-seeded to match."""
    expected = os.environ.get("INTERNAL_API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="INTERNAL_API_KEY is not configured on the backend")
    if x_internal_key != expected:
        raise HTTPException(status_code=401, detail="Missing or invalid internal API key")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest, x_internal_key: str | None = Header(default=None)):
    verify_internal_key(x_internal_key)
    try:
        return generate_code(req.prompt, req.language, req.mentorship)
    except GenerationError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, x_internal_key: str | None = Header(default=None)):
    verify_internal_key(x_internal_key)

    # Two independent signals, computed separately and never blended — see
    # the whiteboard writeup in the top-level README.
    try:
        gemini_result = analyze_code(req.code, req.language, req.mentorship)
    except GenerationError as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        risk = score_risk(req.code)
    except ModelNotTrainedError as e:
        # Degrade gracefully: Gemini's analysis still works even before
        # the PyTorch model has been trained locally.
        risk = {"risk_score": -1, "features": {}}

    return AnalyzeResponse(
        bugs=gemini_result["bugs"],
        optimizations=gemini_result["optimizations"],
        explanation=gemini_result["explanation"],
        risk_score=risk["risk_score"],
        risk_features=risk["features"],
    )


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest, x_internal_key: str | None = Header(default=None)):
    verify_internal_key(x_internal_key)
    try:
        return optimize_code(req.code, req.language, req.mentorship)
    except GenerationError as e:
        raise HTTPException(status_code=502, detail=str(e))
