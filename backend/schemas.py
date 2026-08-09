from pydantic import BaseModel, Field
from typing import List, Optional


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3)
    language: str = Field(min_length=1)
    mentorship: bool = False


class GenerateResponse(BaseModel):
    code: str
    explanation: str


class AnalyzeRequest(BaseModel):
    code: str = Field(min_length=1)
    language: str = Field(min_length=1)
    mentorship: bool = False


class BugFinding(BaseModel):
    line: Optional[int] = None
    severity: str  # "high" | "medium" | "low"
    description: str


class AnalyzeResponse(BaseModel):
    bugs: List[BugFinding]
    optimizations: List[str]
    explanation: str
    risk_score: float
    risk_features: dict


class OptimizeRequest(BaseModel):
    code: str = Field(min_length=1)
    language: str = Field(min_length=1)
    mentorship: bool = False


class OptimizeResponse(BaseModel):
    optimized_code: str
    changes_summary: List[str]
