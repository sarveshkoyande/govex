import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canManageIngestionKeys } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import IngestionKeysManager from "@/components/settings/IngestionKeysManager";

export const metadata = { title: "Ingestion Keys — GovEx" };

export default async function IngestionKeysPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageIngestionKeys(user.role)) redirect("/");

  const keys = await prisma.ingestionApiKey.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Ingestion Keys</h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          These bearer tokens authenticate Stage 1 ingestion — point a Power Automate flow (or the manual test
          injector) at <code className="rounded bg-muted px-1 py-0.5 font-mono">POST /api/ingest</code> with{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">Authorization: Bearer &lt;token&gt;</code>.
          No AI synthesis happens on ingestion — payloads are stored as-is for Stage 2 to read later.
        </p>
      </div>
      <IngestionKeysManager
        initialKeys={keys.map((k) => ({
          id: k.id,
          label: k.label,
          tokenPreview: k.tokenPreview,
          revoked: k.revoked,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
