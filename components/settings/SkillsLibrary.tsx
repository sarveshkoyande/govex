"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, FileText } from "lucide-react";
import type { SkillCategory } from "@/lib/skillRegistry";

export interface SkillView {
  name: string;
  title: string;
  description: string;
  category: SkillCategory;
  content: string;
  custom?: boolean;
}

function SkillCard({ skill }: { skill: SkillView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
        <FileText size={14} className="flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{skill.title}</p>
          <p className="text-[11px] text-muted-foreground">{skill.description}</p>
        </div>
        {skill.custom && <span className="flex-shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">Org-authored</span>}
        <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{skill.name}.md</span>
        <ChevronDown size={14} className={cn("flex-shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <pre className="whitespace-pre-wrap border-t border-border bg-muted/20 p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
          {skill.content}
        </pre>
      )}
    </div>
  );
}

export default function SkillsLibrary({ skills }: { skills: SkillView[] }) {
  return (
    <div className="flex flex-col gap-2">
      {skills.map((s) => <SkillCard key={s.name} skill={s} />)}
    </div>
  );
}
