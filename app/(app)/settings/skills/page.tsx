import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { SKILL_REGISTRY, CATEGORY_LABEL, type SkillCategory } from "@/lib/skillRegistry";
import { loadSkill } from "@/lib/skills";
import SkillsLibrary, { type SkillView } from "@/components/settings/SkillsLibrary";
import SkillPatchesPanel, { type SkillPatchView } from "@/components/settings/SkillPatchesPanel";

export const metadata = { title: "Skills Library — GovEx" };

export default async function SkillsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SYSTEM_ADMIN") redirect("/");

  const [org, pendingPatches, customSkills] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.orgId }, select: { autoApproveSkillPatches: true } }),
    prisma.skillPatchProposal.findMany({ where: { orgId: user.orgId, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    prisma.customSkill.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } }),
  ]);

  const skills: SkillView[] = [
    ...SKILL_REGISTRY.map((s) => ({ ...s, content: loadSkill(s.name) })),
    ...customSkills.map((s) => ({ name: s.name, title: s.title, description: s.description, category: s.category as SkillCategory, content: s.content, custom: true })),
  ];

  const categories = Array.from(new Set(skills.map((s) => s.category))) as SkillCategory[];

  const patches: SkillPatchView[] = pendingPatches.map((p) => ({
    id: p.id,
    skillName: p.skillName,
    currentContent: p.currentContent,
    proposedContent: p.proposedContent,
    reasoning: p.reasoning,
    createdAt: p.createdAt.toISOString(),
    isNewSkill: p.isNewSkill,
    newSkillTitle: p.newSkillTitle,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Skills Library</h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          Every modular skill file GovEx can apply — the &quot;SKILL.md&quot; pattern per the project philosophy. The chat
          assistant and the synthesis/curiosity-loop pipelines select from these on demand rather than using one
          fixed prompt; each skill is a scoped, single-purpose capability.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Skill Patches{patches.length > 0 && ` (${patches.length} pending)`}
        </p>
        <SkillPatchesPanel patches={patches} autoApprove={org?.autoApproveSkillPatches ?? false} />
      </div>

      {categories.map((cat) => (
        <div key={cat} className="flex flex-col gap-2">
          <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{CATEGORY_LABEL[cat]}</p>
          <SkillsLibrary skills={skills.filter((s) => s.category === cat)} />
        </div>
      ))}
    </div>
  );
}
