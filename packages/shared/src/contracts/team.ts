import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import {
  invitationErrors,
  inviteErrors,
  memberChangeErrors,
  memberErrors,
  roleChangeErrors,
} from "../errors";
import {
  changeRoleSchema,
  invitationIdInputSchema,
  inviteMemberSchema,
  memberIdInputSchema,
  teamSchema,
} from "../schemas/team";

/** Every change returns the whole team, so the page shows the server's view right away. */
export const teamContract = {
  list: oc
    .errors(memberErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/team",
        summary: "List the workspace's members and pending invitations",
        description:
          "Any member can see the team. Changing it needs `members:manage`.",
        tags: ["Team"],
      }),
    )
    .output(teamSchema),
  invite: oc
    .errors(inviteErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/team/invitations",
        summary: "Invite a person by email with a role",
        description:
          "The invited person joins when they sign in with that email. Inviting the same email again keeps the existing invitation. Emails that already belong to any workspace are rejected, since a person can only be in one.",
        tags: ["Team"],
      }),
    )
    .input(inviteMemberSchema)
    .output(teamSchema),
  revokeInvitation: oc
    .errors(invitationErrors)
    .meta(
      openapi({
        method: "DELETE",
        path: "/team/invitations/{invitationId}",
        summary: "Revoke a pending invitation",
        tags: ["Team"],
      }),
    )
    .input(invitationIdInputSchema)
    .output(teamSchema),
  changeRole: oc
    .errors(roleChangeErrors)
    .meta(
      openapi({
        method: "PATCH",
        path: "/team/members/{memberId}",
        summary: "Change a member's role",
        description:
          "Makes a member an owner or support. Takes effect within a minute, including for a member who is signed in. The workspace's last owner can't be made support.",
        tags: ["Team"],
      }),
    )
    .input(changeRoleSchema)
    .output(teamSchema),
  removeMember: oc
    .errors(memberChangeErrors)
    .meta(
      openapi({
        method: "DELETE",
        path: "/team/members/{memberId}",
        summary: "Remove a member from the workspace",
        description:
          "Their requests fail right away and their real-time connections close. An owner can't be removed: make them support first.",
        tags: ["Team"],
      }),
    )
    .input(memberIdInputSchema)
    .output(teamSchema),
};
