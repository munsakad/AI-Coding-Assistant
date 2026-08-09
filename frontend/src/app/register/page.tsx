"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not register");
      setLoading(false);
      return;
    }
    const signInRes = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/workspace");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-center text-2xl font-bold text-ink">Create your account</h1>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="label">Full name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Password</label>
          <input required type="password" minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating…" : "Sign up"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-accent">Sign in</Link>
      </p>
    </div>
  );
}
