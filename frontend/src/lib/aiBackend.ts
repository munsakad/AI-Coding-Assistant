import { z } from "zod";

// Second, independent validation layer on top of the Python service's own
// Pydantic check, same pattern as the resume builder's aiBackend.ts.

const GenerateSchema = z.object({ code: z.string(), explanation: z.string() });

const BugSchema = z.object({
  line: z.number().int().nullable().optional(),
  severity: z.enum(["high", "medium", "low"]),
  description: z.string(),
});
const AnalyzeSchema = z.object({
  bugs: z.array(BugSchema),
  optimizations: z.array(z.string()),
  explanation: z.string(),
  risk_score: z.number(),
  risk_features: z.record(z.number()),
});

const OptimizeSchema = z.object({ optimized_code: z.string(), changes_summary: z.array(z.string()) });

export class AiServiceError extends Error {}

function backendUrl() {
  return process.env.AI_BACKEND_URL || "http://localhost:8000";
}
function internalKey() {
  const key = process.env.FRONTEND_INTERNAL_API_KEY;
  if (!key) throw new AiServiceError("FRONTEND_INTERNAL_API_KEY is not set");
  return key;
}

async function callBackend(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${backendUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": internalKey() },
      body: JSON.stringify(body),
      // Generation/analysis can take a few seconds — give it real headroom.
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new AiServiceError("Could not reach the AI backend. Is it running on port 8000?");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new AiServiceError(detail.detail || `AI backend returned ${res.status}`);
  }
  return res.json();
}

export async function generateCode(prompt: string, language: string, mentorship: boolean) {
  const data = await callBackend("/generate", { prompt, language, mentorship });
  const parsed = GenerateSchema.safeParse(data);
  if (!parsed.success) throw new AiServiceError("AI backend response didn't match the expected format");
  return parsed.data;
}

export async function analyzeCode(code: string, language: string, mentorship: boolean) {
  const data = await callBackend("/analyze", { code, language, mentorship });
  const parsed = AnalyzeSchema.safeParse(data);
  if (!parsed.success) throw new AiServiceError("AI backend response didn't match the expected format");
  return parsed.data;
}

export async function optimizeCode(code: string, language: string, mentorship: boolean) {
  const data = await callBackend("/optimize", { code, language, mentorship });
  const parsed = OptimizeSchema.safeParse(data);
  if (!parsed.success) throw new AiServiceError("AI backend response didn't match the expected format");
  return parsed.data;
}
