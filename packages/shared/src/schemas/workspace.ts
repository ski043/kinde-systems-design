import * as z from "zod";
import { memberRoleSchema, permissionSchema } from "../permissions";
import { WIDGET_COLORS } from "./widget";

export const businessNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your business name." })
  .max(80, { error: "Keep the name under 80 characters." });

export const createWorkspaceSchema = z.object({ name: businessNameSchema });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const createdWorkspaceSchema = z.object({
  workspace: workspaceSchema,
  /** Signs the person in again so their session carries the new workspace. */
  continueUrl: z.string(),
});
export type CreatedWorkspace = z.infer<typeof createdWorkspaceSchema>;

/** The signed-in member, as the dashboard shows them. */
export const currentMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string(),
  role: memberRoleSchema,
});
export type CurrentMember = z.infer<typeof currentMemberSchema>;

/**
 * What every member's dashboard needs, whatever their permissions: the accent
 * and the agent's name and avatar come from the widget settings, which only
 * `widget:manage` may read in full.
 */
export const currentWorkspaceSchema = workspaceSchema.extend({
  accentColor: z.enum(WIDGET_COLORS),
  agent: z.object({ name: z.string(), avatarUrl: z.string().nullable() }),
});

export const currentMembershipSchema = z.object({
  member: currentMemberSchema,
  workspace: currentWorkspaceSchema,
  /** For hiding what the member can't use (PRD T-5). The server checks every call regardless. */
  permissions: z.array(permissionSchema),
});
export type CurrentMembership = z.infer<typeof currentMembershipSchema>;
