"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push("/workspace");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-center text-2xl font-bold text-ink">Sign in</h1>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="label">Email</label>
          <input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input required type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        No account? <Link href="/register" className="font-semibold text-accent">Sign up</Link>
      </p>
      <p className="mt-6 text-center text-xs text-muted">Seeded account: sam@codementor.dev / Student123!</p>
    </div>
  );
}
