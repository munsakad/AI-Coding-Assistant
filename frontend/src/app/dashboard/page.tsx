import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const snippets = await prisma.snippet.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { analyses: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Your snippets</h1>
        <Link href="/workspace" className="btn-primary">New in workspace</Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {snippets.map((s) => {
          const latest = s.analyses[0];
          return (
            <Link key={s.id} href={`/snippets/${s.id}`} className="card block hover:border-accent">
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
        {snippets.length === 0 && (
          <p className="col-span-full card text-center text-muted">No saved snippets yet — generate or analyze something in the workspace, then save it.</p>
        )}
      </div>
    </div>
  );
}
