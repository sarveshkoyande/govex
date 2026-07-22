import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canManageOutboundWebhook } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import DriveSyncWebhookForm from "@/components/settings/DriveSyncWebhookForm";

export const metadata = { title: "Drive Sync Webhook — GovEx" };

export default async function DriveSyncWebhookPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageOutboundWebhook(user.role)) redirect("/");

  const config = await prisma.driveSyncConfig.findUnique({ where: { orgId: user.orgId } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Drive Sync Webhook</h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          Pull, not push — GovEx never watches your OneDrive/SharePoint folder on its own. Clicking &quot;Sync
          OneDrive&quot; on a tracker POSTs <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{ trackerId, since }"}</code> here;
          your Power Automate flow lists files modified after <code className="rounded bg-muted px-1 py-0.5 font-mono">since</code>,
          fetches each one, and POSTs it to <code className="rounded bg-muted px-1 py-0.5 font-mono">/api/ingest</code> itself
          (same file contract as a direct upload — <code className="rounded bg-muted px-1 py-0.5 font-mono">fileName</code> + <code className="rounded bg-muted px-1 py-0.5 font-mono">fileBase64</code>).
        </p>
      </div>
      <DriveSyncWebhookForm
        initial={
          config
            ? { url: config.url, secret: "", active: config.active, hasSecret: !!config.secret, lastStatus: config.lastStatus, lastError: config.lastError, lastUsedAt: config.lastUsedAt?.toISOString() ?? null }
            : { url: "", secret: "", active: false, hasSecret: false, lastStatus: null, lastError: null, lastUsedAt: null }
        }
      />
    </div>
  );
}
