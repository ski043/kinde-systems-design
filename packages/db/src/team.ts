import { and } from "@prisma/orm-postgres/orm-client";
import { Temporal } from "temporal-polyfill";
import { getDb } from "./client";
import { isUniqueViolation } from "./errors";
import {
  findMembershipByKindeUserId,
  memberFields,
  type MemberRecord,
  type MemberRoleValue,
  type Membership,
  toMemberRecord,
  toWorkspaceRecord,
  workspaceFields,
} from "./workspaces";

/** Roles an invitation can give. Owners are made by changing a member's role. */
export type InvitationRoleValue = "support";

export type InvitationStatusValue = "pending" | "accepted" | "revoked";

export type InvitationRecord = {
  id: string;
  workspaceId: string;
  email: string;
  role: InvitationRoleValue;
  invitedByMemberId: string;
  status: InvitationStatusValue;
  createdAt: Temporal.Instant;
};

export type TeamMemberRecord = MemberRecord & { createdAt: Temporal.Instant };

const invitationFields = [
  "id",
  "workspaceId",
  "email",
  "role",
  "invitedByMemberId",
  "status",
  "createdAt",
] as const;

function toInvitationRecord(row: InvitationRecord): InvitationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    invitedByMemberId: row.invitedByMemberId,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/** The owner first, then everyone else in the order they joined. */
export async function listMembers(
  workspaceId: string,
): Promise<TeamMemberRecord[]> {
  const rows = await getDb()
    .orm.public.Member.select(...memberFields, "createdAt")
    .where({ workspaceId })
    .orderBy([(m) => m.createdAt.asc(), (m) => m.id.asc()])
    .all();
  const members = rows.map((row) => ({
    ...toMemberRecord(row),
    createdAt: row.createdAt,
  }));
  return [
    ...members.filter((member) => member.role === "owner"),
    ...members.filter((member) => member.role !== "owner"),
  ];
}

export async function getMember(
  workspaceId: string,
  memberId: string,
): Promise<MemberRecord | null> {
  const row = await getDb()
    .orm.public.Member.select(...memberFields)
    .where({ id: memberId, workspaceId })
    .first();
  return row ? toMemberRecord(row) : null;
}

export async function countOwners(workspaceId: string): Promise<number> {
  const owners = await getDb()
    .orm.public.Member.select("id")
    .where({ workspaceId, role: "owner" })
    .all();
  return owners.length;
}

export type RoleChangeResult =
  | { status: "changed"; member: MemberRecord }
  | { status: "not-found" }
  | { status: "last-owner" };

/**
 * Sets a member's role and bumps `access_changed_at`, so tokens issued before
 * now count as stale. Refuses to make the workspace's last owner support.
 * The workspace row stays locked until the change commits, so two owners
 * making each other support at the same time can't both succeed.
 */
export async function changeMemberRole(
  workspaceId: string,
  memberId: string,
  role: MemberRoleValue,
): Promise<RoleChangeResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const lockWorkspace = db.raw.sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId}::uuid FOR UPDATE`
      .returnsRow({ id: "pg/uuid@1" })
      .build();
    await tx.query(lockWorkspace);

    const target = await tx.orm.public.Member.select("role")
      .where({ id: memberId, workspaceId })
      .first();
    if (!target) return { status: "not-found" };

    if (target.role === "owner" && role !== "owner") {
      const owners = await tx.orm.public.Member.select("id")
        .where({ workspaceId, role: "owner" })
        .all();
      if (owners.length === 1) return { status: "last-owner" };
    }

    const row = await tx.orm.public.Member.select(...memberFields)
      .where({ id: memberId, workspaceId })
      .update({ role, accessChangedAt: Temporal.Now.instant() });
    if (!row) return { status: "not-found" };
    return { status: "changed", member: toMemberRecord(row) };
  });
}

/** Deletes a non-owner. `null` when there's no such member, or they're an owner. */
export async function deleteMember(
  workspaceId: string,
  memberId: string,
): Promise<MemberRecord | null> {
  const row = await getDb()
    .orm.public.Member.select(...memberFields)
    .where((m) =>
      and(
        m.id.eq(memberId),
        m.workspaceId.eq(workspaceId),
        m.role.neq("owner"),
      ),
    )
    .delete();
  return row ? toMemberRecord(row) : null;
}

/** Newest first. */
export async function listPendingInvitations(
  workspaceId: string,
): Promise<InvitationRecord[]> {
  const rows = await getDb()
    .orm.public.Invitation.select(...invitationFields)
    .where({ workspaceId, status: "pending" })
    .orderBy([(i) => i.createdAt.desc(), (i) => i.id.desc()])
    .all();
  return rows.map(toInvitationRecord);
}

// Not workspace-scoped: a person belongs to at most one workspace, whichever it is.

/** Whether any workspace has a member with this email, ignoring case. */
export async function isEmailInAnyWorkspace(email: string): Promise<boolean> {
  const db = getDb();
  const plan = db.raw.sql`
    SELECT id FROM members WHERE lower(email) = lower(${email}) LIMIT 1`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const rows = await db.runtime().query(plan);
  return rows.length > 0;
}

export type NewInvitation = {
  email: string;
  role: InvitationRoleValue;
  invitedByMemberId: string;
};

/**
 * Creates a pending invitation, or returns the one already pending for this
 * email (`created: false`). One pending invitation per
 * workspace and email is a unique index, so concurrent invites converge.
 */
export async function createInvitation(
  workspaceId: string,
  input: NewInvitation,
): Promise<{ invitation: InvitationRecord; created: boolean }> {
  const email = input.email.toLowerCase();
  try {
    const row = await getDb()
      .orm.public.Invitation.select(...invitationFields)
      .create({
        workspaceId,
        email,
        role: input.role,
        invitedByMemberId: input.invitedByMemberId,
      });
    return { invitation: toInvitationRecord(row), created: true };
  } catch (error) {
    if (
      !isUniqueViolation(error, { prefix: "invitations_one_pending_per_email" })
    ) {
      throw error;
    }
    const existing = await getDb()
      .orm.public.Invitation.select(...invitationFields)
      .where({ workspaceId, email, status: "pending" })
      .first();
    if (!existing) throw error;
    return { invitation: toInvitationRecord(existing), created: false };
  }
}

/** Marks a pending invitation revoked. `null` when it isn't pending in this workspace. */
export async function revokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<InvitationRecord | null> {
  const row = await getDb()
    .orm.public.Invitation.select(...invitationFields)
    .where({ id: invitationId, workspaceId, status: "pending" })
    .update({ status: "revoked" });
  return row ? toInvitationRecord(row) : null;
}

export type PendingInvitation = InvitationRecord & { kindeOrgCode: string };

/**
 * The oldest pending invitation for this email in any workspace, with that
 * workspace's Kinde organization. Establishes the invitee's workspace scope.
 */
export async function findPendingInvitationByEmail(
  email: string,
): Promise<PendingInvitation | null> {
  const row = await getDb()
    .orm.public.Invitation.select(...invitationFields)
    .include("workspace", (workspace) => workspace.select(...workspaceFields))
    .where({ email: email.toLowerCase(), status: "pending" })
    .orderBy([(i) => i.createdAt.asc(), (i) => i.id.asc()])
    .first();
  if (!row) return null;
  if (!row.workspace) throw new Error(`Invitation ${row.id} has no workspace`);
  return {
    ...toInvitationRecord(row),
    kindeOrgCode: toWorkspaceRecord(row.workspace).kindeOrgCode,
  };
}

export type InvitationAcceptance = {
  invitationId: string;
  kindeUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

class InvitationNoLongerPending extends Error {}

/**
 * Creates the invitee's member row with the invited role and marks the
 * invitation accepted, in one transaction. Idempotent: if the person already
 * has a membership (an earlier or concurrent call won the unique constraint on
 * `kinde_user_id`), that membership is returned. `null` when the invitation is
 * no longer pending and the person has no membership.
 */
export async function acceptInvitation(
  input: InvitationAcceptance,
): Promise<Membership | null> {
  const existing = await findMembershipByKindeUserId(input.kindeUserId);
  if (existing) return existing;

  try {
    await getDb().transaction(async (tx) => {
      const invitation = await tx.orm.public.Invitation.select(
        "workspaceId",
        "role",
      )
        .where({ id: input.invitationId, status: "pending" })
        .update({ status: "accepted", acceptedAt: Temporal.Now.instant() });
      if (!invitation) throw new InvitationNoLongerPending();
      await tx.orm.public.Member.select("id").create({
        workspaceId: invitation.workspaceId,
        kindeUserId: input.kindeUserId,
        email: input.email,
        role: invitation.role,
        name: input.name,
        avatarUrl: input.avatarUrl,
        avatarKey: null,
      });
    });
  } catch (error) {
    const lostRace =
      error instanceof InvitationNoLongerPending ||
      isUniqueViolation(error, "members_kinde_user_id_key");
    if (!lostRace) throw error;
  }
  return findMembershipByKindeUserId(input.kindeUserId);
}
