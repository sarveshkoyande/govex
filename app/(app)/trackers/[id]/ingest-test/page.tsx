import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import IngestTestForm from "@/components/settings/IngestTestForm";

export const metadata = { title: "Test Ingestion — GovEx" };

export default async function IngestTestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canWrite(user.role)) redirect("/");

  const { id } = await params;
  // Tenant-isolation: confirm ownership before the trackerId-scoped question query.
  const tracker = await prisma.tracker.findFirst({ where: { id, orgId: user.orgId }, select: { id: true, name: true } });
  if (!tracker) notFound();

  const askedQuestions = await prisma.openQuestion.findMany({ where: { trackerId: id, status: "ASKED" }, select: { id: true, questionText: true } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href={`/trackers/${id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to tracker
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Test Ingestion</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Simulates a Power Automate webhook call into <code className="rounded bg-muted px-1 py-0.5 font-mono">POST /api/ingest</code> for{" "}
          <span className="font-semibold text-foreground">{tracker.name}</span>. This hits the real endpoint from your
          browser — the same contract a real flow will use later. No AI processes this; it&apos;s stored as a raw event.
        </p>
      </div>
      <IngestTestForm trackerId={tracker.id} trackerName={tracker.name} askedQuestions={askedQuestions} />
    </div>
  );
}
