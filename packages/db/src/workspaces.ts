import type { Temporal } from "temporal-polyfill";
import { getDb } from "./client";
import { isUniqueViolation } from "./errors";

export type MemberRoleValue = "owner" | "support" | "billing-admin";
export type WorkspaceRecord = {
  id: string;
  name: string;
  kindeOrgCode: string;
  kindeBillingCustomerId: string | null;
  billingChangedAt: Temporal.Instant;
};

export type MemberRecord = {
  id: string;
  workspaceId: string;
  kindeUserId: string;
  email: string;
  role: MemberRoleValue;
  name: string;
  avatarUrl: string | null;
  avatarKey: string | null;
  accessChangedAt: Temporal.Instant;
};

export type Membership = { member: MemberRecord; workspace: WorkspaceRecord };

export const workspaceFields = [
  "id",
  "name",
  "kindeOrgCode",
  "kindeBillingCustomerId",
  "billingChangedAt",
] as const;

export const memberFields = [
  "id",
  "workspaceId",
  "kindeUserId",
  "email",
  "role",
  "name",
  "avatarUrl",
  "avatarKey",
  "accessChangedAt",
] as const;

export function toMemberRecord(row: MemberRecord): MemberRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kindeUserId: row.kindeUserId,
    email: row.email,
    role: row.role,
    name: row.name,
    avatarUrl: row.avatarUrl,
    avatarKey: row.avatarKey,
    accessChangedAt: row.accessChangedAt,
  };
}

export function toWorkspaceRecord(row: WorkspaceRecord): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    kindeOrgCode: row.kindeOrgCode,
    kindeBillingCustomerId: row.kindeBillingCustomerId,
    billingChangedAt: row.billingChangedAt,
  };
}

// Not workspace-scoped: these two lookups are what establish the caller's workspace scope.

/** The person's membership, wherever it is. A person belongs to at most one workspace. */
export async function findMembershipByKindeUserId(
  kindeUserId: string,
): Promise<Membership | null> {
  const row = await getDb()
    .orm.public.Member.select(...memberFields)
    .include("workspace", (workspace) => workspace.select(...workspaceFields))
    .where({ kindeUserId })
    .first();
  if (!row) return null;
  if (!row.workspace) throw new Error(`Member ${row.id} has no workspace`);
  return {
    member: toMemberRecord(row),
    workspace: toWorkspaceRecord(row.workspace),
  };
}

/** The person's membership in the workspace linked to `kindeOrgCode`, or null if they aren't in it. */
export async function findMembership(
  kindeOrgCode: string,
  kindeUserId: string,
): Promise<Membership | null> {
  const membership = await findMembershipByKindeUserId(kindeUserId);
  return membership?.workspace.kindeOrgCode === kindeOrgCode
    ? membership
    : null;
}

export type NewWorkspaceWithOwner = {
  workspaceId: string;
  kindeOrgCode: string;
  kindeBillingCustomerId: string | null;
  workspaceName: string;
  kindeUserId: string;
  email: string;
  ownerName: string;
  avatarUrl: string | null;
};

/**
 * Creates the workspace and its owner in one transaction. Idempotent: if the
 * person already has a membership (an earlier attempt, or a concurrent one that
 * won the unique constraint), that membership is returned with `created: false`.
 */
export async function createWorkspaceWithOwner(
  input: NewWorkspaceWithOwner,
): Promise<Membership & { created: boolean }> {
  const existing = await findMembershipByKindeUserId(input.kindeUserId);
  if (existing) return { ...existing, created: false };

  try {
    const membership = await getDb().transaction(async (tx) => {
      const workspace = await tx.orm.public.Workspace.select(
        ...workspaceFields,
      ).create({
        id: input.workspaceId,
        name: input.workspaceName,
        kindeOrgCode: input.kindeOrgCode,
        kindeBillingCustomerId: input.kindeBillingCustomerId,
      });
      const member = await tx.orm.public.Member.select(...memberFields).create({
        workspaceId: workspace.id,
        kindeUserId: input.kindeUserId,
        email: input.email,
        role: "owner",
        name: input.ownerName,
        avatarUrl: input.avatarUrl,
        avatarKey: null,
      });
      return {
        member: toMemberRecord(member),
        workspace: toWorkspaceRecord(workspace),
      };
    });
    return { ...membership, created: true };
  } catch (error) {
    const lostRace =
      isUniqueViolation(error, "members_kinde_user_id_key") ||
      isUniqueViolation(error, "workspaces_kinde_org_code_key") ||
      isUniqueViolation(error, "workspaces_pkey");
    if (!lostRace) throw error;
    const winner = await findMembershipByKindeUserId(input.kindeUserId);
    if (!winner) throw error;
    return { ...winner, created: false };
  }
}

export async function getWorkspace(
  workspaceId: string,
): Promise<WorkspaceRecord | null> {
  const row = await getDb()
    .orm.public.Workspace.select(...workspaceFields)
    .where({ id: workspaceId })
    .first();
  return row ? toWorkspaceRecord(row) : null;
}
