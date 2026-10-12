"use client";
// Static GitHub Pages build only (copied over src/ by demo/apply.mjs).
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { installDemo, mountPanel } from "@/demo/mockApi";

// Route /api/* to the in-browser handlers before next-auth asks for the session
if (typeof window !== "undefined") installDemo();

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    mountPanel();
  }, []);
  return <SessionProvider>{children}</SessionProvider>;
}
