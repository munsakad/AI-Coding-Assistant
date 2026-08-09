import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner, authErrorResponse } from "@/lib/authorize";
import { analyzeCode, AiServiceError } from "@/lib/aiBackend";
import { z } from "zod";

const schema = z.object({
  snippetId: z.string().optional(), // omit to analyze ad-hoc code without saving
  code: z.string().min(1),
  language: z.string().min(1),
  mentorship: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = schema.parse(await req.json());

    let ownerId = session?.user?.id;
    if (body.snippetId) {
      const snippet = await prisma.snippet.findUnique({ where: { id: body.snippetId } });
      if (!snippet) return Response.json({ error: "Snippet not found" }, { status: 404 });
      requireOwner(session, snippet.userId);
      ownerId = snippet.userId;
    } else {
      requireOwner(session, ownerId ?? ""); // just requires auth when no snippet given
    }

    const result = await analyzeCode(body.code, body.language, body.mentorship);

    if (body.snippetId) {
      const saved = await prisma.analysis.create({
        data: {
          snippetId: body.snippetId,
          bugs: JSON.stringify(result.bugs),
          optimizations: JSON.stringify(result.optimizations),
          explanation: result.explanation,
          riskScore: result.risk_score,
          riskFeatures: JSON.stringify(result.risk_features),
        },
      });
      return Response.json({ ...result, id: saved.id, createdAt: saved.createdAt });
    }

    return Response.json(result);
  } catch (err: any) {
    if (err?.issues) return Response.json({ error: "Invalid input" }, { status: 400 });
    if (err instanceof AiServiceError) return Response.json({ error: err.message }, { status: 502 });
    return authErrorResponse(err);
  }
}
