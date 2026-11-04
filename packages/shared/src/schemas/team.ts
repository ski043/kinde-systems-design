import * as z from "zod";
import { assignableRoleSchema, memberRoleSchema } from "../permissions";

/** Trimmed and lowercased, so an invitation matches whatever casing Kinde reports. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: "Enter a valid email address." })
      .max(254, { error: "Enter a valid email address." }),
  );

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: memberRoleSchema,
  avatarUrl: z.string(),
  joinedAt: z.string(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: assignableRoleSchema,
  createdAt: z.string(),
});
export type Invitation = z.infer<typeof invitationSchema>;

/** The owner first, then members by join date, and pending invitations newest first. */
export const teamSchema = z.object({
  members: z.array(teamMemberSchema),
  invitations: z.array(invitationSchema),
});
export type Team = z.infer<typeof teamSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: assignableRoleSchema,
});
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;

export const memberIdInputSchema = z.object({ memberId: z.uuid() });

export const changeRoleSchema = z.object({
  memberId: z.uuid(),
  role: assignableRoleSchema,
});

export const invitationIdInputSchema = z.object({ invitationId: z.uuid() });
