"use client";
// Static GitHub Pages build: replaces src/app/snippets/[id]/page.tsx. Static
// export can't pre-render per-user ids, so the id travels as ?id= instead.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/demo/RequireAuth";
import SnippetDetail from "./SnippetDetail";

type Detail = React.ComponentProps<typeof SnippetDetail>;

function SnippetView() {
  const id = useSearchParams().get("id");
  const [data, setData] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) {
      setMissing(true);
      return;
    }
    fetch(`/api/snippets/${encodeURIComponent(id)}`).then(async (res) => {
      if (!res.ok) {
        setMissing(true);
        return;
      }
      const s = await res.json();
      setData({
        snippet: { id: s.id, title: s.title, language: s.language, code: s.code },
        // same JSON decoding the server page did
        analyses: s.analyses.map((a: any) => ({
          id: a.id,
          bugs: JSON.parse(a.bugs),
          optimizations: JSON.parse(a.optimizations),
          explanation: a.explanation,
          riskScore: a.riskScore,
          riskFeatures: JSON.parse(a.riskFeatures),
          createdAt: a.createdAt,
        })),
      });
    });
  }, [id]);

  if (missing) return <p className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">Snippet not found.</p>;
  if (!data) return <p className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted">Loading…</p>;
  return <SnippetDetail key={data.snippet.id} snippet={data.snippet} analyses={data.analyses} />;
}

export default function SnippetPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <SnippetView />
      </Suspense>
    </RequireAuth>
  );
}
