import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth, authErrorResponse } from "@/lib/authorize";
import { generateCode, AiServiceError } from "@/lib/aiBackend";
import { z } from "zod";

const schema = z.object({ prompt: z.string().min(3), language: z.string().min(1), mentorship: z.boolean().default(false) });

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAuth(session);
    const body = schema.parse(await req.json());

    const result = await generateCode(body.prompt, body.language, body.mentorship);
    return Response.json(result);
  } catch (err: any) {
    if (err?.issues) return Response.json({ error: "Invalid input" }, { status: 400 });
    if (err instanceof AiServiceError) return Response.json({ error: err.message }, { status: 502 });
    return authErrorResponse(err);
  }
}
