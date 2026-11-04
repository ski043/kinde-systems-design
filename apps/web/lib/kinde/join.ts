import "server-only";
import {
  acceptInvitation,
  findMembershipByKindeUserId,
  findPendingInvitationByEmail,
  type Membership,
} from "@marshaldesk/db";
import { joinOrganization, leaveOrganization } from "./members";
import type { KindeSession } from "./session";

/**
 * Invitation acceptance (PRD T-2). Kinde never sees the invitation: the app
 * matches the person's verified email to a pending one, adds them to the
 * workspace's organization with the invited role, then writes the member row
 * and marks the invitation accepted in one transaction.
 *
 * Safe to retry and to run concurrently: Kinde membership converges, and the
 * unique `kinde_user_id` lets exactly one member row win. Returns null when
 * there's nothing to accept. Throws `RoleNotInKindeError` when the invited
 * role isn't defined in Kinde.
 */
export async function joinInvitedWorkspace(
  session: KindeSession,
): Promise<Membership | null> {
  const existing = await findMembershipByKindeUserId(session.kindeUserId);
  if (existing) return existing;
  if (!session.emailVerified) return null;

  const invitation = await findPendingInvitationByEmail(session.email);
  if (!invitation) return null;

  await joinOrganization(
    invitation.kindeOrgCode,
    session.kindeUserId,
    invitation.role,
  );
  const membership = await acceptInvitation({
    invitationId: invitation.id,
    kindeUserId: session.kindeUserId,
    email: session.email,
    name: session.name,
    avatarUrl: session.picture,
  });
  if (!membership) {
    // Revoked while we were adding them: undo the organization membership.
    await leaveOrganization(invitation.kindeOrgCode, session.kindeUserId);
  }
  return membership;
}
