import { auth } from "@/lib/auth";
import type { Role } from "@/lib/enums";

export type SessionUser = {
  id: string;
  orgId: string;
  role: Role;
  email?: string | null;
  name?: string | null;
};

// Single accessor for the authenticated user. All authorization flows through
// here, so the underlying auth provider (Credentials now, Keycloak later) is
// irrelevant to callers.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    orgId: session.user.orgId,
    role: (session.user.role as Role) ?? "EXEC_VIEWER",
    email: session.user.email,
    name: session.user.name,
  };
}

// Roles allowed to create/edit/delete dashboard content in Stage 0.
const WRITE_ROLES: Role[] = [
  "THEME_OWNER",
  "CONTENT_ADMIN",
  "PUBLISHER",
  "SYSTEM_ADMIN",
];

export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}

// Minting/revoking ingestion webhook keys is a system-settings action.
export function canManageIngestionKeys(role: Role): boolean {
  return role === "SYSTEM_ADMIN";
}

// Configuring the outbound Power Automate webhook is a system-settings action.
export function canManageOutboundWebhook(role: Role): boolean {
  return role === "SYSTEM_ADMIN";
}

// Approving/rejecting a drafted skill-file patch (or toggling auto-approve)
// changes a shared skill for the whole org — system-settings action.
export function canManageSkillPatches(role: Role): boolean {
  return role === "SYSTEM_ADMIN";
}
