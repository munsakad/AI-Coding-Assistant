import { Session } from "next-auth";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requireAuth(session: Session | null) {
  if (!session?.user) throw new ForbiddenError("Not authenticated");
  return session.user;
}

export function requireOwner(session: Session | null, ownerId: string) {
  const user = requireAuth(session);
  if (user.id !== ownerId) throw new ForbiddenError("This isn't yours");
  return user;
}

export function authErrorResponse(err: unknown) {
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message }, { status: err.message === "Not authenticated" ? 401 : 403 });
  }
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
