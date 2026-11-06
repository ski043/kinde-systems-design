import * as z from "zod";

/** Permission keys defined in Kinde. Procedures check these, never role names. */
export const PERMISSIONS = [
  "conversations:read",
  "conversations:reply",
  "suggestions:create",
  "knowledge:manage",
  "widget:manage",
  "members:manage",
  "billing:manage",
] as const;

export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

/** Role keys defined in Kinde. `members.role` stores a display copy. */
export const MEMBER_ROLES = ["owner", "support"] as const;

export const memberRoleSchema = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof memberRoleSchema>;

/** Roles an invitation can give. Owners are made by changing a member's role. */
export const INVITABLE_ROLES = ["support"] as const;

export const invitableRoleSchema = z.enum(INVITABLE_ROLES);
export type InvitableRole = z.infer<typeof invitableRoleSchema>;
