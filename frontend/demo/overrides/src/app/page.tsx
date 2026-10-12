"use client";
// Static GitHub Pages build: client-side version of src/app/page.tsx
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/workspace");
  }, [status, router]);

  return (
    <div className="border-b border-line bg-panel">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-mono text-sm text-accent">10+ languages · Gemini + a real trained PyTorch model</p>
        <h1 className="mt-3 text-4xl font-bold text-ink sm:text-5xl">Generate, debug, and optimize code — with a mentor in the loop.</h1>
        <p className="mt-4 text-lg text-muted">
          Two independent signals on every review: Gemini&apos;s semantic read on your code,
          and a structural bug-risk score from a small trained neural net. Never blended,
          always shown side by side.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary">Get started</Link>
          <Link href="/login" className="btn-outline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
