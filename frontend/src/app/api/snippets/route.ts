import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth, authErrorResponse } from "@/lib/authorize";
import { z } from "zod";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = requireAuth(session);
    const snippets = await prisma.snippet.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { analyses: true } }, analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return Response.json(snippets);
  } catch (err) {
    return authErrorResponse(err);
  }
}

const schema = z.object({ title: z.string().min(1), language: z.string().min(1), code: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = requireAuth(session);
    const body = schema.parse(await req.json());

    const snippet = await prisma.snippet.create({ data: { userId: user.id, ...body } });
    return Response.json(snippet, { status: 201 });
  } catch (err: any) {
    if (err?.issues) return Response.json({ error: "Invalid input" }, { status: 400 });
    return authErrorResponse(err);
  }
}
