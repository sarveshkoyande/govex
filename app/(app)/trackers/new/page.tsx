import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { blankTracker } from "@/lib/types";
import TrackerForm from "@/components/trackers/TrackerForm";

export const metadata = { title: "New Tracker — GovEx" };

export default async function NewTrackerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canWrite(user.role)) redirect("/");

  const domains = await prisma.domain.findMany({
    where: { orgId: user.orgId, active: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-foreground">New Tracker</h1>
      <p className="mb-5 text-[12px] text-muted-foreground">Create a theme/tracker with its financials, stakeholders, risks, actions, decisions, and strategy hierarchy.</p>
      <TrackerForm mode="create" domains={domains} initial={blankTracker(domains[0]?.id ?? "")} />
    </div>
  );
}
