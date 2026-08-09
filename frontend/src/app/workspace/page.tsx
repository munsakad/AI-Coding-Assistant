import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Workspace from "./Workspace";

export default async function WorkspacePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <Workspace />;
}
