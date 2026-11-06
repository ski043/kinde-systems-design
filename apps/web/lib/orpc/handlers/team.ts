import "server-only";
import {
  changeMemberRole,
  countOwners,
  createInvitation,
  deleteMember,
  getMember,
  isEmailInAnyWorkspace,
  listMembers,
  listPendingInvitations,
  revokeInvitation as revokePendingInvitation,
} from "@marshaldesk/db";
import type { MemberRole, Team } from "@marshaldesk/shared";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  assertRoleExists,
  leaveOrganization,
  RoleNotInKindeError,
  setOrganizationRole,
} from "@/lib/kinde/members";
import { fetchLivePermissions } from "@/lib/kinde/permissions";
import { publishMemberRevoked } from "@/lib/realtime/publish";
import { memberProcedure, requirePermission } from "../procedures";

const manageMembers = memberProcedure.use(requirePermission("members:manage"));

async function loadTeam(workspaceId: string): Promise<Team> {
  const [members, invitations] = await Promise.all([
    listMembers(workspaceId),
    listPendingInvitations(workspaceId),
  ]);
  return {
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      avatarUrl: resolveAvatarUrl(member),
      joinedAt: member.createdAt.toString(),
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt.toString(),
    })),
  };
}

/** Runs `assign`, turning a role Kinde doesn't define into the typed error. */
async function withKindeRole<T>(
  assign: () => Promise<T>,
  roleUnavailable: (role: MemberRole) => Error,
): Promise<T> {
  try {
    return await assign();
  } catch (error) {
    if (error instanceof RoleNotInKindeError) {
      throw roleUnavailable(error.role);
    }
    throw error;
  }
}

export const list = memberProcedure.team.list.handler(({ context }) =>
  loadTeam(context.workspaceId),
);

export const invite = manageMembers.team.invite.handler(
  async ({ context, input, errors }) => {
    if (await isEmailInAnyWorkspace(input.email)) {
      throw errors.ALREADY_IN_WORKSPACE();
    }
    // Checked now, so the invitee isn't stuck later when acceptance assigns it.
    await withKindeRole(
      () => assertRoleExists(input.role),
      (role) => errors.ROLE_UNAVAILABLE({ data: { role } }),
    );
    await createInvitation(context.workspaceId, {
      email: input.email,
      role: input.role,
      invitedByMemberId: context.member.id,
    });
    return loadTeam(context.workspaceId);
  },
);

export const revokeInvitation = manageMembers.team.revokeInvitation.handler(
  async ({ context, input, errors }) => {
    const revoked = await revokePendingInvitation(
      context.workspaceId,
      input.invitationId,
    );
    if (!revoked) throw errors.NOT_FOUND();
    return loadTeam(context.workspaceId);
  },
);

/**
 * Kinde first, so the permissions it issues next are already the new ones;
 * then the row, whose `access_changed_at` bump makes older tokens stale.
 * Retrying converges: both steps set the role rather than toggle it.
 */
export const changeRole = manageMembers.team.changeRole.handler(
  async ({ context, input, errors }) => {
    const target = await getMember(context.workspaceId, input.memberId);
    if (!target) throw errors.NOT_FOUND();
    const demotesOwner = target.role === "owner" && input.role !== "owner";
    if (demotesOwner && (await countOwners(context.workspaceId)) === 1) {
      throw errors.LAST_OWNER();
    }

    const setKindeRole = (role: MemberRole) =>
      withKindeRole(
        () =>
          setOrganizationRole(context.kindeOrgCode, target.kindeUserId, role),
        (unavailable) =>
          errors.ROLE_UNAVAILABLE({ data: { role: unavailable } }),
      );
    await setKindeRole(input.role);

    const result = await changeMemberRole(
      context.workspaceId,
      target.id,
      input.role,
    );
    switch (result.status) {
      case "changed":
        break;
      case "not-found":
        throw errors.NOT_FOUND();
      case "last-owner":
        // Another owner was made support since the check above. Undo Kinde.
        await setKindeRole(target.role);
        throw errors.LAST_OWNER();
      default: {
        const unreachable: never = result;
        throw new Error(`Unknown role change result: ${String(unreachable)}`);
      }
    }

    const permissions = await fetchLivePermissions(
      context.kindeOrgCode,
      target.kindeUserId,
    );
    if (!permissions.includes("conversations:read")) {
      await publishMemberRevoked(context.workspaceId, target.id);
    }
    return loadTeam(context.workspaceId);
  },
);

/** Deleting the row is what cuts access: every member procedure looks it up. */
export const removeMember = manageMembers.team.removeMember.handler(
  async ({ context, input, errors }) => {
    const target = await getMember(context.workspaceId, input.memberId);
    if (!target) throw errors.NOT_FOUND();
    if (target.role === "owner") throw errors.OWNER_PROTECTED();

    await leaveOrganization(context.kindeOrgCode, target.kindeUserId);
    const removed = await deleteMember(context.workspaceId, target.id);
    if (!removed) throw errors.NOT_FOUND();
    await publishMemberRevoked(context.workspaceId, target.id);
    return loadTeam(context.workspaceId);
  },
);
