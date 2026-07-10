import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { trackerToDraft, trackerInclude } from "@/lib/toDraft";
import TrackerForm from "@/components/trackers/TrackerForm";

export const metadata = { title: "Edit Tracker — GovEx" };

export default async function EditTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canWrite(user.role)) redirect("/");

  const { id } = await params;
  const [tracker, domains] = await Promise.all([
    prisma.tracker.findFirst({ where: { id, orgId: user.orgId }, include: trackerInclude }),
    prisma.domain.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!tracker) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/trackers/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to tracker
      </Link>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-foreground">Edit: {tracker.name}</h1>
      <p className="mb-5 text-[12px] text-muted-foreground">Changes to tracked fields are recorded to the field-change history.</p>
      <TrackerForm mode="edit" domains={domains} initial={trackerToDraft(tracker)} />
    </div>
  );
}
