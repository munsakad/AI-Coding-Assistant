"use client";
// Static GitHub Pages build: client-side version of src/app/workspace/page.tsx
import RequireAuth from "@/demo/RequireAuth";
import Workspace from "./Workspace";

export default function WorkspacePage() {
  return (
    <RequireAuth>
      <Workspace />
    </RequireAuth>
  );
}
