"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { trackerSchema, type TrackerInput } from "@/lib/validation/tracker";

export type SaveResult = { ok: false; error: string };

// Build the Prisma nested-create payload for a tracker's children + strategy layer.
function childrenCreate(input: TrackerInput) {
  return {
    stakeholders: {
      create: input.stakeholders.map((s) => ({
        name: s.name, email: s.email || null, roleOnTracker: s.roleOnTracker || null,
        ownsWhat: s.ownsWhat || null, isPrimary: s.isPrimary,
      })),
    },
    financialMetrics: {
      create: input.financialMetrics.map((f) => ({
        label: f.label, period: f.period || null, unit: f.unit,
        planned: f.planned, actual: f.actual, forecast: f.forecast, confidence: f.confidence,
      })),
    },
    risks: {
      create: input.risks.map((r) => ({
        title: r.title, severity: r.severity, status: r.status,
        mitigation: r.mitigation || null, owner: r.owner || null, confidence: r.confidence,
      })),
    },
    nextActions: {
      create: input.nextActions.map((a) => ({
        title: a.title, owner: a.owner || null, assigneeGroup: a.assigneeGroup,
        priority: a.priority, status: a.status, dueDate: a.dueDate || null,
      })),
    },
    decisionLog: {
      create: input.decisionLog.map((d) => ({
        decision: d.decision, rationale: d.rationale || null, decidedBy: d.decidedBy || null,
      })),
    },
    strategyGoals: {
      create: input.strategyGoals.map((g, i) => ({ text: g.text, order: i })),
    },
    okrs: {
      create: input.okrs.map((o, i) => ({ title: o.title, metrics: o.metrics || null, tags: o.tags || null, order: i })),
    },
    strategyInsights: {
      create: input.strategyInsights.map((s, i) => ({ title: s.title, description: s.description || null, order: i })),
    },
    microBattles: {
      create: input.microBattles.map((mb, mi) => ({
        code: mb.code || null, name: mb.name, ragStatus: mb.ragStatus, order: mi,
        executionTactics: {
          create: mb.tactics.map((t, ti) => ({
            name: t.name, expectedOutcome: t.expectedOutcome || null, status: t.status, order: ti,
            insights: {
              create: [
                ...t.executionInsights.map((ei, ii) => ({ kind: "EXECUTION", signal: ei.signal, text: ei.text, order: ii })),
                ...t.outcomeInsights.map((oi, ii) => ({ kind: "OUTCOME", signal: oi.signal, text: oi.text, order: ii })),
              ],
            },
          })),
        },
      })),
    },
  };
}

const TRACKED_KEYS = [
  "name", "lifecycleStatus", "ragStatus", "signalStatus", "ownerName",
  "targetPeriod", "budget", "spend", "forecast", "overallConfidence",
] as const;

export async function saveTracker(raw: unknown): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot create or edit trackers." };

  const parsed = trackerSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: `${first.path.join(".")}: ${first.message}` };
  }
  const input = parsed.data;

  // Guard the domain belongs to this org.
  const domain = await prisma.domain.findFirst({ where: { id: input.domainId, orgId: user.orgId } });
  if (!domain) return { ok: false, error: "Invalid domain." };

  const scalars = {
    name: input.name,
    description: input.description || null,
    strategyObjective: input.strategyObjective || null,
    okrObjective: input.okrObjective || null,
    lifecycleStatus: input.lifecycleStatus,
    ragStatus: input.ragStatus,
    signalStatus: input.signalStatus,
    ownerName: input.ownerName || null,
    targetPeriod: input.targetPeriod || null,
    currency: input.currency || "USD",
    budget: input.budget,
    spend: input.spend,
    forecast: input.forecast,
    overallConfidence: input.overallConfidence,
  };

  let trackerId: string;

  if (input.id) {
    // ---- UPDATE ---------------------------------------------------------
    const existing = await prisma.tracker.findFirst({ where: { id: input.id, orgId: user.orgId } });
    if (!existing) return { ok: false, error: "Tracker not found." };

    trackerId = existing.id;

    // Record append-only history for changed tracked fields (never overwrite
    // the past — the philosophy's non-negotiable).
    const changes = TRACKED_KEYS.flatMap((k) => {
      const oldVal = (existing as Record<string, unknown>)[k];
      const newVal = (scalars as Record<string, unknown>)[k];
      if (String(oldVal ?? "") === String(newVal ?? "")) return [];
      return [{
        trackerId, entityType: "Tracker", entityId: trackerId, fieldKey: k,
        oldValue: oldVal == null ? null : String(oldVal),
        newValue: newVal == null ? null : String(newVal),
        changedBy: user.email ?? user.id, source: "MANUAL", confidenceAfter: input.overallConfidence,
      }];
    });

    await prisma.$transaction([
      // Wipe children (cascades through micro-battles → tactics → insights) then recreate.
      prisma.stakeholder.deleteMany({ where: { trackerId } }),
      prisma.financialMetric.deleteMany({ where: { trackerId } }),
      prisma.risk.deleteMany({ where: { trackerId } }),
      prisma.nextAction.deleteMany({ where: { trackerId } }),
      prisma.decisionLogEntry.deleteMany({ where: { trackerId } }),
      prisma.strategyGoal.deleteMany({ where: { trackerId } }),
      prisma.okr.deleteMany({ where: { trackerId } }),
      prisma.strategyInsight.deleteMany({ where: { trackerId } }),
      prisma.microBattle.deleteMany({ where: { trackerId } }),
      prisma.tracker.update({
        where: { id: trackerId },
        data: { ...scalars, domainId: input.domainId, updatedBy: user.email ?? user.id, ...childrenCreate(input) },
      }),
      ...(changes.length ? [prisma.fieldChange.createMany({ data: changes })] : []),
    ]);

    // Refresh per-field confidence/staleness for changed fields.
    for (const c of changes) {
      await prisma.fieldState.upsert({
        where: { entityType_entityId_fieldKey: { entityType: "Tracker", entityId: trackerId, fieldKey: c.fieldKey } },
        update: { confidence: input.overallConfidence, source: "MANUAL", lastUpdatedAt: new Date(), lastUpdatedBy: user.email ?? user.id },
        create: { trackerId, entityType: "Tracker", entityId: trackerId, fieldKey: c.fieldKey, confidence: input.overallConfidence, source: "MANUAL", lastUpdatedBy: user.email ?? user.id },
      });
    }
  } else {
    // ---- CREATE ---------------------------------------------------------
    const created = await prisma.tracker.create({
      data: {
        orgId: user.orgId,
        domainId: input.domainId,
        ...scalars,
        createdBy: user.email ?? user.id,
        updatedBy: user.email ?? user.id,
        ...childrenCreate(input),
      },
    });
    trackerId = created.id;
  }

  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  redirect(`/trackers/${trackerId}`);
}

export async function deleteTracker(id: string): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot delete trackers." };

  const existing = await prisma.tracker.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing) return { ok: false, error: "Tracker not found." };

  await prisma.tracker.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}
