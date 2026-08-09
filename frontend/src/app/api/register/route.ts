import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return Response.json({ error: "An account with that email already exists" }, { status: 409 });

    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.user.create({ data: { name: body.name, email: body.email.toLowerCase().trim(), passwordHash } });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    if (err?.issues) return Response.json({ error: "Invalid input" }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
