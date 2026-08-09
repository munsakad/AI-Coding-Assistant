"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  "Python", "JavaScript", "TypeScript", "Java", "Go", "Rust", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin",
];

type Bug = { line?: number | null; severity: "high" | "medium" | "low"; description: string };
type AnalyzeResult = { bugs: Bug[]; optimizations: string[]; explanation: string; risk_score: number; risk_features: Record<string, number> };
type OptimizeResult = { optimized_code: string; changes_summary: string[] };

const severityColor: Record<string, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-warn/10 text-warn",
  low: "bg-line text-muted",
};

export default function Workspace() {
  const router = useRouter();
  const [language, setLanguage] = useState("Python");
  const [mentorship, setMentorship] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");

  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [genExplanation, setGenExplanation] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [optimized, setOptimized] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (prompt.trim().length < 3) {
      setError("Describe what you want in a bit more detail.");
      return;
    }
    setGenerating(true);
    setError(null);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, language, mentorship }),
    });
    const body = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(body.error ?? "Could not generate code");
      return;
    }
    setCode(body.code);
    setGenExplanation(body.explanation);
    setAnalysis(null);
    setOptimized(null);
  }

  async function analyze() {
    if (code.trim().length < 1) {
      setError("Paste or generate some code first.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language, mentorship }),
    });
    const body = await res.json();
    setAnalyzing(false);
    if (!res.ok) {
      setError(body.error ?? "Could not analyze code");
      return;
    }
    setAnalysis(body);
  }

  async function optimize() {
    if (code.trim().length < 1) {
      setError("Paste or generate some code first.");
      return;
    }
    setOptimizing(true);
    setError(null);
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language, mentorship }),
    });
    const body = await res.json();
    setOptimizing(false);
    if (!res.ok) {
      setError(body.error ?? "Could not optimize code");
      return;
    }
    setOptimized(body);
  }

  function acceptOptimized() {
    if (!optimized) return;
    setCode(optimized.optimized_code);
    setOptimized(null);
    setAnalysis(null);
  }

  async function save() {
    if (code.trim().length < 1) {
      setError("Nothing to save yet.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || `${language} snippet`, language, code }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save");
      return;
    }
    router.push(`/snippets/${body.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Workspace</h1>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={mentorship} onChange={(e) => setMentorship(e.target.checked)} className="accent-accent" />
          Mentorship mode (step-by-step explanations)
        </label>
      </div>

      <div className="card mt-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="label">Language</label>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="label">Describe what you want generated (optional)</label>
          <div className="flex gap-2">
            <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. a function that merges two sorted arrays" />
            <button onClick={generate} disabled={generating} className="btn-primary whitespace-nowrap">{generating ? "Generating…" : "Generate"}</button>
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Code</label>
          <textarea rows={14} className="code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste code here, or generate it above…" />
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={analyze} disabled={analyzing} className="btn-outline">{analyzing ? "Analyzing…" : "Analyze (bugs + risk)"}</button>
          <button onClick={optimize} disabled={optimizing} className="btn-outline">{optimizing ? "Optimizing…" : "Optimize"}</button>
          <input className="input max-w-[200px]" placeholder="Title to save as…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save snippet"}</button>
        </div>
      </div>

      {genExplanation && (
        <div className="card mt-4">
          <h2 className="font-bold text-ink">What this does</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{genExplanation}</p>
        </div>
      )}

      {analysis && (
        <div className="mt-4 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Gemini's review</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{analysis.explanation}</p>

            {analysis.bugs.length > 0 ? (
              <div className="mt-4 space-y-2">
                {analysis.bugs.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-line p-3">
                    <span className={`badge ${severityColor[b.severity]}`}>{b.severity}</span>
                    <div>
                      {b.line != null && <p className="font-mono text-xs text-muted">Line {b.line}</p>}
                      <p className="text-sm text-ink">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ok">No bugs flagged.</p>
            )}

            {analysis.optimizations.length > 0 && (
              <div className="mt-4">
                <p className="label">Optimization suggestions</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted">
                  {analysis.optimizations.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Deliberately a SEPARATE card, not merged into Gemini's findings — see the whiteboard note in the README. */}
          <div className="card border-accent/30">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">PyTorch structural risk score</h2>
              {analysis.risk_score >= 0 ? (
                <span className={`badge text-base ${analysis.risk_score >= 60 ? "bg-danger/10 text-danger" : analysis.risk_score >= 30 ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"}`}>
                  {analysis.risk_score}/100
                </span>
              ) : (
                <span className="badge bg-line text-muted">Model not trained yet</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              An independent signal from a small trained neural net — based on nesting depth, branch density, magic
              numbers, error handling patterns, and comment ratio. Not the same as Gemini's read above; the two
              are shown separately on purpose.
            </p>
            {analysis.risk_score >= 0 && (
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-3">
                {Object.entries(analysis.risk_features).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-line/50 py-1">
                    <span>{k.replace(/_/g, " ")}</span>
                    <span className="font-mono text-ink">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {optimized && (
        <div className="card mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Optimized version</h2>
            <button onClick={acceptOptimized} className="btn-primary !py-1.5 !px-3 text-xs">Use this code</button>
          </div>
          <pre className="code-input mt-3 max-h-72 overflow-auto whitespace-pre-wrap">{optimized.optimized_code}</pre>
          <div className="mt-3">
            <p className="label">Changes made</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted">
              {optimized.changes_summary.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
