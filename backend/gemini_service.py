import os
import json
import google.generativeai as genai
from pydantic import ValidationError

from schemas import GenerateResponse, BugFinding, OptimizeResponse

# Same reliability pattern as the other services in this suite:
# response_schema constrains Gemini's output shape, Pydantic validates it
# before anything is trusted or returned to the frontend.


class GenerationError(Exception):
    pass


def _get_model(response_schema: dict):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise GenerationError("GEMINI_API_KEY is not set on the backend")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        "gemini-2.0-flash",
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": response_schema,
        },
    )


def _mentorship_instruction(mentorship: bool) -> str:
    if mentorship:
        return (
            "Write explanations in a step-by-step, teaching style, as if mentoring "
            "someone learning to write better code — explain the REASONING behind "
            "each point, not just what to change, and define any non-obvious terms."
        )
    return "Write explanations tersely — a few direct sentences, no teaching tone, assume an experienced developer."


def _call(prompt: str, schema: dict) -> dict:
    model = _get_model(schema)
    try:
        result = model.generate_content(prompt)
        raw = result.text
    except Exception as e:
        raise GenerationError(f"Gemini request failed: {e}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise GenerationError("The AI returned a response we couldn't parse")


GENERATE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "code": {"type": "STRING"},
        "explanation": {"type": "STRING"},
    },
    "required": ["code", "explanation"],
}


def generate_code(prompt: str, language: str, mentorship: bool) -> GenerateResponse:
    full_prompt = f"""Write {language} code for this request:

"{prompt}"

Return working, idiomatic {language} code (no markdown fences inside the
code field, just raw code) plus an explanation of what it does and any
notable design choices. {_mentorship_instruction(mentorship)}"""

    data = _call(full_prompt, GENERATE_SCHEMA)
    try:
        return GenerateResponse.model_validate(data)
    except ValidationError as e:
        raise GenerationError(f"AI response didn't match the expected format: {e}")


ANALYZE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "bugs": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "line": {"type": "INTEGER", "nullable": True},
                    "severity": {"type": "STRING", "enum": ["high", "medium", "low"]},
                    "description": {"type": "STRING"},
                },
                "required": ["severity", "description"],
            },
        },
        "optimizations": {"type": "ARRAY", "items": {"type": "STRING"}},
        "explanation": {"type": "STRING"},
    },
    "required": ["bugs", "optimizations", "explanation"],
}


def analyze_code(code: str, language: str, mentorship: bool) -> dict:
    """Returns the raw dict (bugs/optimizations/explanation) — the caller
    merges in the separately-computed PyTorch risk_score, since the two
    signals are deliberately never blended by the model itself."""
    prompt = f"""You are reviewing {language} code for bugs and optimization
opportunities. Be specific and honest — if the code looks fine, say so with
an empty bugs list rather than inventing issues.

For each bug: give a severity (high/medium/low), a description, and a line
number if you can identify one (the code below is 1-indexed by line as
shown).

For optimizations: list concrete, specific improvements (performance,
readability, idiom) — not vague advice.

{_mentorship_instruction(mentorship)}

CODE:
\"\"\"
{_numbered(code)}
\"\"\""""

    data = _call(prompt, ANALYZE_SCHEMA)
    # Validate bugs/optimizations/explanation shape via a partial model
    # (risk_score/risk_features get merged in by the caller afterward).
    try:
        bugs = [BugFinding.model_validate(b) for b in data.get("bugs", [])]
        optimizations = list(data.get("optimizations", []))
        explanation = str(data.get("explanation", ""))
    except ValidationError as e:
        raise GenerationError(f"AI response didn't match the expected format: {e}")

    return {"bugs": bugs, "optimizations": optimizations, "explanation": explanation}


def _numbered(code: str) -> str:
    lines = code.split("\n")
    return "\n".join(f"{i + 1}: {line}" for i, line in enumerate(lines))


OPTIMIZE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "optimized_code": {"type": "STRING"},
        "changes_summary": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["optimized_code", "changes_summary"],
}


def optimize_code(code: str, language: str, mentorship: bool) -> OptimizeResponse:
    prompt = f"""Rewrite this {language} code with concrete optimizations —
performance, readability, and idiomatic style. Preserve behavior exactly.
Return the full optimized code (no markdown fences, just raw code) plus a
bullet list summarizing each specific change you made and why.

{_mentorship_instruction(mentorship)}

ORIGINAL CODE:
\"\"\"
{code[:8000]}
\"\"\""""

    data = _call(prompt, OPTIMIZE_SCHEMA)
    try:
        return OptimizeResponse.model_validate(data)
    except ValidationError as e:
        raise GenerationError(f"AI response didn't match the expected format: {e}")
