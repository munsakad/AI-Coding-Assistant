"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Bug = { line?: number | null; severity: string; description: string };
type Analysis = {
  id: string;
  bugs: Bug[];
  optimizations: string[];
  explanation: string;
  riskScore: number;
  riskFeatures: Record<string, number>;
  createdAt: string;
};

const severityColor: Record<string, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-warn/10 text-warn",
  low: "bg-line text-muted",
};

export default function SnippetDetail({
  snippet,
  analyses,
}: {
  snippet: { id: string; title: string; language: string; code: string };
  analyses: Analysis[];
}) {
  const router = useRouter();
  const [list, setList] = useState(analyses);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reanalyze() {
    setAnalyzing(true);
    setError(null);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snippetId: snippet.id, code: snippet.code, language: snippet.language, mentorship: false }),
    });
    const body = await res.json();
    setAnalyzing(false);
    if (!res.ok) {
      setError(body.error ?? "Could not analyze");
      return;
    }
    setList((l) => [{ id: body.id, bugs: body.bugs, optimizations: body.optimizations, explanation: body.explanation, riskScore: body.risk_score, riskFeatures: body.risk_features, createdAt: body.createdAt }, ...l]);
  }

  async function remove() {
    if (!confirm("Delete this snippet and its analysis history?")) return;
    setDeleting(true);
    const res = await fetch(`/api/snippets/${snippet.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.push("/dashboard");
  }

  const latest = list[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{snippet.title}</h1>
          <span className="badge mt-1 bg-line text-muted">{snippet.language}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={reanalyze} disabled={analyzing} className="btn-outline">{analyzing ? "Analyzing…" : "Re-analyze"}</button>
          <button onClick={remove} disabled={deleting} className="btn-danger">{deleting ? "…" : "Delete"}</button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="card mt-4">
        <pre className="code-input max-h-80 overflow-auto whitespace-pre-wrap">{snippet.code}</pre>
      </div>

      {latest && (
        <div className="mt-4 space-y-4">
          <div className="card">
            <h2 className="font-bold text-ink">Gemini's review</h2>
            <p className="mt-2 text-sm text-muted">{latest.explanation}</p>
            {latest.bugs.length > 0 ? (
              <div className="mt-4 space-y-2">
                {latest.bugs.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-line p-3">
                    <span className={`badge ${severityColor[b.severity] ?? "bg-line text-muted"}`}>{b.severity}</span>
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
          </div>

          <div className="card border-accent/30">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">PyTorch structural risk score</h2>
              {latest.riskScore >= 0 ? (
                <span className={`badge text-base ${latest.riskScore >= 60 ? "bg-danger/10 text-danger" : latest.riskScore >= 30 ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"}`}>
                  {latest.riskScore}/100
                </span>
              ) : (
                <span className="badge bg-line text-muted">Model not trained yet</span>
              )}
            </div>
          </div>
        </div>
      )}

      {list.length > 1 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-ink">Analysis history</h2>
          <div className="mt-3 space-y-2">
            {list.slice(1).map((a) => (
              <div key={a.id} className="card !p-4 flex items-center justify-between">
                <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</p>
                <div className="flex items-center gap-2">
                  <span className="badge bg-line text-muted">{a.bugs.length} bugs</span>
                  {a.riskScore >= 0 && (
                    <span className={`badge ${a.riskScore >= 60 ? "bg-danger/10 text-danger" : a.riskScore >= 30 ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"}`}>
                      Risk: {a.riskScore}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
