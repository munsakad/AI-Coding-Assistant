"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-base">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-mono text-lg font-bold text-accent">{"</> CodeMentor"}</Link>
        <nav className="flex items-center gap-4 text-sm font-semibold text-ink">
          {session ? (
            <>
              <Link href="/dashboard" className="hover:text-accent">Snippets</Link>
              <Link href="/workspace" className="hover:text-accent">Workspace</Link>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-outline !py-1.5 !px-3 text-xs">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent">Sign in</Link>
              <Link href="/register" className="btn-primary !py-1.5 !px-3 text-xs">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
