"use server";

import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { triggerDriveSync } from "@/lib/driveSync";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Fired only by a user clicking "Sync OneDrive" on a tracker page — never on
// a timer/webhook trigger of our own. See lib/driveSync.ts.
export async function syncTrackerDrive(trackerId: string): Promise<ActionResult<{ status: string; error?: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot trigger a drive sync." };

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId: user.orgId }, select: { id: true } });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  const result = await triggerDriveSync(user.orgId, trackerId);
  return { ok: true, data: { status: result.status, error: result.status === "FAILED" ? result.error : undefined } };
}
