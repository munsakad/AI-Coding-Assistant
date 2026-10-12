"use client";
// Client-side replacement for middleware.ts + getServerSession redirects in
// the static GitHub Pages build.
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted">Loading…</div>;
  }
  return <>{children}</>;
}
