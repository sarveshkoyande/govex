import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canManageOutboundWebhook } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import OutboundWebhookForm from "@/components/settings/OutboundWebhookForm";

export const metadata = { title: "Outbound Webhook — GovEx" };

export default async function OutboundWebhookPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageOutboundWebhook(user.role)) redirect("/");

  const config = await prisma.outboundWebhookConfig.findUnique({ where: { orgId: user.orgId } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Outbound Webhook</h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          Stage 3 — when a question is approved, GovEx POSTs it here for a Power Automate flow to actually deliver
          (email/Teams) to the stakeholder. Leave inactive/unconfigured and questions are still recorded as
          &quot;asked&quot; with delivery status <code className="rounded bg-muted px-1 py-0.5 font-mono">NOT_CONFIGURED</code> —
          the review/approve loop stays fully testable either way.
        </p>
      </div>
      <OutboundWebhookForm
        initial={
          config
            ? { url: config.url, secret: "", active: config.active, hasSecret: !!config.secret, lastStatus: config.lastStatus, lastError: config.lastError, lastUsedAt: config.lastUsedAt?.toISOString() ?? null }
            : { url: "", secret: "", active: false, hasSecret: false, lastStatus: null, lastError: null, lastUsedAt: null }
        }
      />
    </div>
  );
}
