import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import AppHeader from "@/components/dashboard/AppHeader";
import TopNav from "@/components/dashboard/TopNav";
import ActionRail, { type RailAction } from "@/components/dashboard/ActionRail";
import ChatWidget from "@/components/chat/ChatWidget";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [domains, actions] = await Promise.all([
    prisma.domain.findMany({
      where: { orgId: user.orgId, active: true },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { trackers: true } },
        trackers: { select: { id: true }, take: 2, orderBy: { updatedAt: "desc" } },
      },
    }),
    prisma.nextAction.findMany({
      where: { tracker: { orgId: user.orgId } },
      orderBy: { createdAt: "desc" },
      include: { tracker: { select: { id: true, name: true, domain: { select: { name: true } } } } },
    }),
  ]);

  const navDomains = domains.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    trackerCount: d._count.trackers,
    // A domain with exactly one tracker jumps straight to it (matches the
    // sample's 1:1 tab-to-theme-page behavior); domains with 0 or 2+
    // trackers fall back to the filtered Home list.
    soloTrackerId: d._count.trackers === 1 ? d.trackers[0]?.id : undefined,
  }));

  const railActions: RailAction[] = actions.map((a) => ({
    id: a.id,
    title: a.title,
    owner: a.owner ?? "—",
    dueDate: a.dueDate ?? "—",
    status: a.status,
    priority: a.priority,
    assigneeGroup: a.assigneeGroup,
    theme: a.tracker.domain.name,
    trackerId: a.tracker.id,
  }));

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Animated colour blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="animate-blob absolute -top-40 -left-32 h-[600px] w-[600px] rounded-full bg-[oklch(0.58_0.18_245)] opacity-[0.07] blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-[oklch(0.46_0.20_258)] opacity-[0.06] blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute -bottom-20 left-1/3 h-[550px] w-[550px] rounded-full bg-[oklch(0.68_0.13_232)] opacity-[0.05] blur-3xl" />
      </div>

      <div className="relative z-10 flex-shrink-0">
        <AppHeader userName={user.name ?? ""} userEmail={user.email ?? ""} role={user.role} />
      </div>
      <div className="relative z-10 flex-shrink-0">
        <TopNav domains={navDomains} />
      </div>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-y-auto bg-background/60 p-5 backdrop-blur-[1px]">{children}</main>
        <ActionRail actions={railActions} scopeLabel="All themes" />
      </div>

      <ChatWidget />
    </div>
  );
}
