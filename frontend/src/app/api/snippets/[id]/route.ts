import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner, authErrorResponse } from "@/lib/authorize";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const snippet = await prisma.snippet.findUnique({
      where: { id: params.id },
      include: { analyses: { orderBy: { createdAt: "desc" } } },
    });
    if (!snippet) return Response.json({ error: "Not found" }, { status: 404 });
    requireOwner(session, snippet.userId);
    return Response.json(snippet);
  } catch (err) {
    return authErrorResponse(err);
  }
}

const updateSchema = z.object({ title: z.string().min(1).optional(), code: z.string().min(1).optional() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const existing = await prisma.snippet.findUnique({ where: { id: params.id } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    requireOwner(session, existing.userId);

    const body = updateSchema.parse(await req.json());
    const snippet = await prisma.snippet.update({ where: { id: params.id }, data: body });
    return Response.json(snippet);
  } catch (err: any) {
    if (err?.issues) return Response.json({ error: "Invalid input" }, { status: 400 });
    return authErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const existing = await prisma.snippet.findUnique({ where: { id: params.id } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    requireOwner(session, existing.userId);
    await prisma.snippet.delete({ where: { id: params.id } });
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
