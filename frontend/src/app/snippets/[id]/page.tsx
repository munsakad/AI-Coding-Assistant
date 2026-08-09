import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SnippetDetail from "./SnippetDetail";

export default async function SnippetPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const snippet = await prisma.snippet.findUnique({
    where: { id: params.id },
    include: { analyses: { orderBy: { createdAt: "desc" } } },
  });
  if (!snippet) notFound();
  if (snippet.userId !== session.user.id) redirect("/dashboard");

  const analyses = snippet.analyses.map((a) => ({
    id: a.id,
    bugs: JSON.parse(a.bugs) as { line?: number | null; severity: string; description: string }[],
    optimizations: JSON.parse(a.optimizations) as string[],
    explanation: a.explanation,
    riskScore: a.riskScore,
    riskFeatures: JSON.parse(a.riskFeatures) as Record<string, number>,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <SnippetDetail
      snippet={{ id: snippet.id, title: snippet.title, language: snippet.language, code: snippet.code }}
      analyses={analyses}
    />
  );
}
