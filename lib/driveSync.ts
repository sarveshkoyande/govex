import { prisma } from "@/lib/db";

export type DriveSyncResult =
  | { triggered: true; status: "TRIGGERED" }
  | { triggered: false; status: "NOT_CONFIGURED" }
  | { triggered: false; status: "FAILED"; error: string };

// Triggers the org's configured "list/fetch OneDrive files" Power Automate
// flow — pull, not push: this only fires when a user clicks "Sync OneDrive"
// (see app/actions/driveSync.ts), never on a standing file-watcher trigger.
// GovEx is the caller here, same direction as lib/outbound.ts's sendQuestion
// — the receiving flow is expected to list files modified since `since`,
// fetch each one's content, and POST it to /api/ingest itself (same contract
// lib/fileExtraction.ts already handles: fileName + fileBase64).
export async function triggerDriveSync(
  orgId: string,
  trackerId: string,
): Promise<DriveSyncResult> {
  const config = await prisma.driveSyncConfig.findUnique({ where: { orgId } });
  if (!config || !config.active || !config.url) {
    return { triggered: false, status: "NOT_CONFIGURED" };
  }

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId }, select: { name: true, driveLastSyncedAt: true } });
  if (!tracker) return { triggered: false, status: "FAILED", error: "Tracker not found in this organization." };

  const triggeredAt = new Date();

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.secret ? { Authorization: `Bearer ${config.secret}` } : {}),
      },
      // trackerName lets the flow build a per-tracker folder path (e.g.
      // "GovEx/<trackerName>") without needing its own copy of every
      // trackerId -> folder mapping. `since` is null on a tracker's very
      // first sync — the flow should treat that as "list everything."
      body: JSON.stringify({ trackerId, trackerName: tracker.name, since: tracker.driveLastSyncedAt?.toISOString() ?? null }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const error = `Webhook returned ${res.status}`;
      await prisma.driveSyncConfig.update({ where: { orgId }, data: { lastUsedAt: new Date(), lastStatus: "FAILED", lastError: error } });
      return { triggered: false, status: "FAILED", error };
    }

    // Optimistic cursor advance — set to when we fired the trigger, not when
    // the flow (which we don't wait on) finishes. See the schema comment on
    // Tracker.driveLastSyncedAt for the tradeoff this accepts.
    await prisma.tracker.update({ where: { id: trackerId }, data: { driveLastSyncedAt: triggeredAt } });
    await prisma.driveSyncConfig.update({ where: { orgId }, data: { lastUsedAt: new Date(), lastStatus: "SUCCESS", lastError: null } });
    return { triggered: true, status: "TRIGGERED" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown network error.";
    await prisma.driveSyncConfig.update({ where: { orgId }, data: { lastUsedAt: new Date(), lastStatus: "FAILED", lastError: error } });
    return { triggered: false, status: "FAILED", error };
  }
}
