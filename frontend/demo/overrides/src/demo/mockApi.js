// In-browser stand-in for CodeMentor's API routes (src/app/api/*) and the
// FastAPI service behind them, used only by the static GitHub Pages build.
//  - register / snippets / analyses: same validation and ownership rules,
//    stored in this visitor's localStorage instead of SQLite
//  - generate / analyze / optimize: the prompts and response schemas from
//    backend/gemini_service.py, sent straight to Gemini with the visitor's own
//    key and validated with the zod schemas from src/lib/aiBackend.ts
//  - risk score: the trained PyTorch model, exported by CI and run by ./riskModel.js
import { z } from "zod";
import { BASE, HttpError, checkPassword, createAuth, createDb, handleNextAuth, hashPassword, installFetch, json, newId } from "./runtime.js";
import { GeminiNotConfigured, generateJson, hasKey } from "./gemini.js";
import { scoreRisk } from "./riskModel.js";
import { mountDemoPanel } from "./demoPanel.js";

const REPO_URL = "https://github.com/munsakad/AI-Coding-Assistant";

// prisma/seed.ts
const db = createDb("codementor", {
  users: [{ id: "seed-sam", name: "Sam Lee", email: "sam@codementor.dev", seedPassword: "Student123!" }],
  snippets: [],
  analyses: [],
});
const auth = createAuth("codementor");

async function authorize(email, password) {
  const user = db.read().users.find((u) => u.email === email.toLowerCase().trim());
  if (!user || !(await checkPassword(user, password))) return null;
  return { id: user.id, name: user.name, email: user.email };
}

// ---- backend/gemini_service.py -----------------------------------------------------
function mentorshipInstruction(mentorship) {
  if (mentorship) {
    return (
      "Write explanations in a step-by-step, teaching style, as if mentoring " +
      "someone learning to write better code — explain the REASONING behind " +
      "each point, not just what to change, and define any non-obvious terms."
    );
  }
  return "Write explanations tersely — a few direct sentences, no teaching tone, assume an experienced developer.";
}

const GENERATE_SCHEMA = {
  type: "OBJECT",
  properties: { code: { type: "STRING" }, explanation: { type: "STRING" } },
  required: ["code", "explanation"],
};

const ANALYZE_SCHEMA = {
  type: "OBJECT",
  properties: {
    bugs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          line: { type: "INTEGER", nullable: true },
          severity: { type: "STRING", enum: ["high", "medium", "low"] },
          description: { type: "STRING" },
        },
        required: ["severity", "description"],
      },
    },
    optimizations: { type: "ARRAY", items: { type: "STRING" } },
    explanation: { type: "STRING" },
  },
  required: ["bugs", "optimizations", "explanation"],
};

const OPTIMIZE_SCHEMA = {
  type: "OBJECT",
  properties: {
    optimized_code: { type: "STRING" },
    changes_summary: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["optimized_code", "changes_summary"],
};

const numbered = (code) => code.split("\n").map((line, i) => i + 1 + ": " + line).join("\n");
const Q3 = '"' + '"' + '"';

function generatePrompt(prompt, language, mentorship) {
  return (
    "Write " + language + " code for this request:\n\n" +
    '"' + prompt + '"\n\n' +
    "Return working, idiomatic " + language + " code (no markdown fences inside the\n" +
    "code field, just raw code) plus an explanation of what it does and any\n" +
    "notable design choices. " + mentorshipInstruction(mentorship)
  );
}

function analyzePrompt(code, language, mentorship) {
  return (
    "You are reviewing " + language + " code for bugs and optimization\n" +
    "opportunities. Be specific and honest — if the code looks fine, say so with\n" +
    "an empty bugs list rather than inventing issues.\n\n" +
    "For each bug: give a severity (high/medium/low), a description, and a line\n" +
    "number if you can identify one (the code below is 1-indexed by line as\n" +
    "shown).\n\n" +
    "For optimizations: list concrete, specific improvements (performance,\n" +
    "readability, idiom) — not vague advice.\n\n" +
    mentorshipInstruction(mentorship) + "\n\n" +
    "CODE:\n" + Q3 + "\n" + numbered(code) + "\n" + Q3
  );
}

function optimizePrompt(code, language, mentorship) {
  return (
    "Rewrite this " + language + " code with concrete optimizations —\n" +
    "performance, readability, and idiomatic style. Preserve behavior exactly.\n" +
    "Return the full optimized code (no markdown fences, just raw code) plus a\n" +
    "bullet list summarizing each specific change you made and why.\n\n" +
    mentorshipInstruction(mentorship) + "\n\n" +
    "ORIGINAL CODE:\n" + Q3 + "\n" + code.slice(0, 8000) + "\n" + Q3
  );
}

// ---- src/lib/aiBackend.ts response validation ------------------------------------------
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

async function gemini(prompt, schema, validator) {
  let data;
  try {
    data = await generateJson("", prompt, schema);
  } catch (err) {
    if (err instanceof GeminiNotConfigured) {
      throw new HttpError(502, "Generation needs a Gemini API key in this static demo. Add yours in the demo panel (bottom-right).");
    }
    throw new HttpError(502, err.message);
  }
  if (!validator) return data;
  const parsed = validator.safeParse(data);
  if (!parsed.success) throw new HttpError(502, "AI backend response didn't match the expected format");
  return parsed.data;
}

let riskModel;
const loadRiskModel = () =>
  (riskModel =
    riskModel ||
    fetch(BASE + "/demo/risk-model.json").then((r) => {
      if (!r.ok) throw new Error("risk model not found");
      return r.json();
    }));

const OFFLINE_REVIEW =
  "Offline demo: Gemini's semantic review needs an API key, so no bugs were checked. " +
  "Add a key in the demo panel to get the full review. The structural risk score below " +
  "is real: it comes from the trained PyTorch model, running in your browser.";

async function analyze({ code, language, mentorship }) {
  const review = hasKey()
    ? await gemini(analyzePrompt(code, language, mentorship), ANALYZE_SCHEMA)
    : { bugs: [], optimizations: [], explanation: OFFLINE_REVIEW };
  let risk = { risk_score: -1, features: {} }; // same graceful fallback as main.py
  try {
    risk = scoreRisk(await loadRiskModel(), code);
  } catch {
    /* model unavailable */
  }
  const parsed = AnalyzeSchema.safeParse({
    bugs: review.bugs || [],
    optimizations: review.optimizations || [],
    explanation: String(review.explanation || ""),
    risk_score: risk.risk_score,
    risk_features: risk.features,
  });
  if (!parsed.success) throw new HttpError(502, "AI backend response didn't match the expected format");
  return parsed.data;
}

// ---- route handlers (src/app/api/*) ------------------------------------------------------
const generateInput = z.object({ prompt: z.string().min(3), language: z.string().min(1), mentorship: z.boolean().default(false) });
const codeInput = z.object({ code: z.string().min(1), language: z.string().min(1), mentorship: z.boolean().default(false) });
const analyzeInput = codeInput.extend({ snippetId: z.string().optional() });
const registerInput = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8) });
const snippetInput = z.object({ title: z.string().min(1), language: z.string().min(1), code: z.string().min(1) });
const snippetUpdate = z.object({ title: z.string().min(1).optional(), code: z.string().min(1).optional() });

function ownedSnippet(id, user, notFound = "Not found") {
  const snippet = db.read().snippets.find((s) => s.id === id);
  if (!snippet) throw new HttpError(404, notFound);
  if (snippet.userId !== user.id) throw new HttpError(403, "This isn't yours");
  return snippet;
}

const analysesFor = (snippetId) =>
  db.read().analyses.filter((a) => a.snippetId === snippetId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

async function handle(path, init) {
  const method = (init.method || "GET").toUpperCase();
  const body = () => JSON.parse(init.body || "{}");
  let m;

  if (path.startsWith("/api/auth/")) return handleNextAuth(path.slice("/api/auth/".length), init, auth, authorize);

  if (path === "/api/register" && method === "POST") {
    const input = registerInput.parse(body());
    const email = input.email.toLowerCase().trim();
    if (db.read().users.some((u) => u.email === email))
      return json({ error: "An account with that email already exists" }, 409);
    const passwordHash = await hashPassword(input.password);
    db.write((d) => d.users.push({ id: newId(), name: input.name, email, passwordHash, createdAt: new Date().toISOString() }));
    return json({ ok: true }, 201);
  }

  if (path === "/api/generate" && method === "POST") {
    auth.requireUser();
    const input = generateInput.parse(body());
    return json(await gemini(generatePrompt(input.prompt, input.language, input.mentorship), GENERATE_SCHEMA, GenerateSchema));
  }

  if (path === "/api/optimize" && method === "POST") {
    auth.requireUser();
    const input = codeInput.parse(body());
    return json(await gemini(optimizePrompt(input.code, input.language, input.mentorship), OPTIMIZE_SCHEMA, OptimizeSchema));
  }

  if (path === "/api/analyze" && method === "POST") {
    const user = auth.requireUser();
    const input = analyzeInput.parse(body());
    if (input.snippetId) ownedSnippet(input.snippetId, user, "Snippet not found");
    const result = await analyze(input);
    if (!input.snippetId) return json(result);
    const saved = {
      id: newId(),
      snippetId: input.snippetId,
      bugs: JSON.stringify(result.bugs),
      optimizations: JSON.stringify(result.optimizations),
      explanation: result.explanation,
      riskScore: result.risk_score,
      riskFeatures: JSON.stringify(result.risk_features),
      createdAt: new Date().toISOString(),
    };
    db.write((d) => d.analyses.push(saved));
    return json({ ...result, id: saved.id, createdAt: saved.createdAt });
  }

  if (path === "/api/snippets") {
    const user = auth.requireUser();
    if (method === "POST") {
      const input = snippetInput.parse(body());
      const now = new Date().toISOString();
      const snippet = { id: newId(), userId: user.id, ...input, createdAt: now, updatedAt: now };
      db.write((d) => d.snippets.push(snippet));
      return json(snippet, 201);
    }
    const list = db.read().snippets
      .filter((s) => s.userId === user.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((s) => {
        const analyses = analysesFor(s.id);
        return { ...s, _count: { analyses: analyses.length }, analyses: analyses.slice(0, 1) };
      });
    return json(list);
  }

  if ((m = path.match(/^\/api\/snippets\/([^/]+)$/))) {
    const user = auth.requireUser();
    const snippet = ownedSnippet(m[1], user);
    if (method === "GET") return json({ ...snippet, analyses: analysesFor(snippet.id) });
    if (method === "PATCH") {
      const input = snippetUpdate.parse(body());
      const updated = db.write((d) => {
        const s = d.snippets.find((x) => x.id === snippet.id);
        Object.assign(s, input, { updatedAt: new Date().toISOString() });
        return s;
      });
      return json(updated);
    }
    if (method === "DELETE") {
      db.write((d) => {
        d.snippets = d.snippets.filter((s) => s.id !== snippet.id);
        d.analyses = d.analyses.filter((a) => a.snippetId !== snippet.id); // onDelete: Cascade
      });
      return json({ ok: true });
    }
  }

  return json({ error: "Not found" }, 404);
}

let installed = false;
export function installDemo() {
  if (installed) return;
  installed = true;
  installFetch(handle);
  const mount = () =>
    mountDemoPanel({
      repoUrl: REPO_URL,
      note:
        "Static build: the Next.js API routes and the FastAPI service run in your browser. Sign in with " +
        "<b>sam@codementor.dev / Student123!</b> or create an account (stored only in this browser).",
      offlineNote: "Without a key, Analyze still shows the PyTorch risk score, computed in your browser.",
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
}
