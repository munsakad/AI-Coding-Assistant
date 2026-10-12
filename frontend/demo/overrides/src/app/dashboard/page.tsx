"use client";
// Static GitHub Pages build: client-side version of src/app/dashboard/page.tsx
// (same markup; data comes from GET /api/snippets instead of Prisma)
import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/demo/RequireAuth";

type SnippetSummary = {
  id: string;
  title: string;
  language: string;
  code: string;
  analyses: { riskScore: number }[];
  _count: { analyses: number };
};

function Snippets() {
  const [snippets, setSnippets] = useState<SnippetSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/snippets")
      .then((r) => r.json())
      .then(setSnippets);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Your snippets</h1>
        <Link href="/workspace" className="btn-primary">New in workspace</Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {snippets === null && <p className="col-span-full text-center text-sm text-muted">Loading…</p>}
        {snippets?.map((s) => {
          const latest = s.analyses[0];
          return (
            <Link key={s.id} href={`/snippets/view?id=${s.id}`} className="card block hover:border-accent">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-ink">{s.title}</h2>
                <span className="badge bg-line text-muted">{s.language}</span>
              </div>
              <p className="mt-2 truncate font-mono text-xs text-muted">{s.code.split("\n")[0]}</p>
              <div className="mt-3 flex items-center gap-2">
                {latest && latest.riskScore >= 0 && (
                  <span className={`badge ${latest.riskScore >= 60 ? "bg-danger/10 text-danger" : latest.riskScore >= 30 ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"}`}>
                    Risk: {latest.riskScore}/100
                  </span>
                )}
                <span className="text-xs text-muted">{s._count.analyses} analysis{s._count.analyses === 1 ? "" : "es"}</span>
              </div>
            </Link>
          );
        })}
        {snippets?.length === 0 && (
          <p className="col-span-full card text-center text-muted">No saved snippets yet — generate or analyze something in the workspace, then save it.</p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Snippets />
    </RequireAuth>
  );
}
