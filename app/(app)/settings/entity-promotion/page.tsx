import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser, canManageOutboundWebhook } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import EntityPromotionToggle from "@/components/settings/EntityPromotionToggle";

export const metadata = { title: "Entity Promotion — GovEx" };

export default async function EntityPromotionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canManageOutboundWebhook(user.role)) redirect("/");

  const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { autoPromoteEntities: true } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Entity Promotion</h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          Names, projects, and terms mentioned repeatedly in ingested text but not yet tracked (see the Unresolved
          Entities panel on each tracker) can either be created automatically once they cross the mention threshold,
          or held for a human to confirm — this setting controls which.
        </p>
      </div>
      <EntityPromotionToggle initial={org?.autoPromoteEntities ?? true} />
    </div>
  );
}
