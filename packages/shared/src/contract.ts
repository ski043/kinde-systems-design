import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { billingContract } from "./contracts/billing";
import { inboxContract } from "./contracts/inbox";
import { knowledgeContract } from "./contracts/knowledge";
import { teamContract } from "./contracts/team";
import { widgetContract } from "./contracts/widget";
import {
  acceptInvitationErrors,
  authenticatedErrors,
  avatarErrors,
  ConversationNotFoundError,
  memberErrors,
  permissionErrors,
} from "./errors";
import { realtimeTokenSchema } from "./realtime";
import * as z from "zod";
import {
  avatarUploadSchema,
  confirmAvatarUploadSchema,
  createAvatarUploadSchema,
  savedWidgetSettingsSchema,
  widgetSettingsSchema,
} from "./schemas/widget";
import {
  createdWorkspaceSchema,
  createWorkspaceSchema,
  currentMembershipSchema,
} from "./schemas/workspace";

export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  WORKSPACE_REQUIRED: 403,
  PERMISSION_DENIED: 403,
  AVATAR_REJECTED: 422,
  OWNER_PROTECTED: 403,
  ALREADY_IN_WORKSPACE: 409,
  ALREADY_INVITED: 409,
  ROLE_UNAVAILABLE: 409,
  PLAN_REQUIRED: 402,
  SUGGESTION_IN_PROGRESS: 409,
  VISITOR_UNAUTHORIZED: 401,
  DOMAIN_NOT_ALLOWED: 403,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const contract = {
  member: {
    getCurrent: oc
      .errors(memberErrors)
      .meta(
        openapi({
          method: "GET",
          path: "/member",
          summary:
            "Get the signed-in member, their workspace, and their permissions",
          tags: ["Member"],
        }),
      )
      .output(currentMembershipSchema),
  },
  workspace: {
    create: oc
      .errors(authenticatedErrors)
      .meta(
        openapi({
          method: "POST",
          path: "/workspace",
          summary:
            "Create the signed-in person's workspace from their business name",
          description:
            "Idempotent: a person has at most one workspace, so calling it again returns the existing one. Open `continueUrl` next to sign in to the workspace.",
          tags: ["Workspace"],
        }),
      )
      .input(createWorkspaceSchema)
      .output(createdWorkspaceSchema),
    acceptInvitation: oc
      .errors(acceptInvitationErrors)
      .meta(
        openapi({
          method: "POST",
          path: "/workspace/invitation",
          summary:
            "Join the workspace that invited the signed-in person's verified email",
          description:
            "Idempotent: calling it again after joining returns the same workspace. Open `continueUrl` next to sign in to the workspace.",
          tags: ["Workspace"],
        }),
      )
      .output(createdWorkspaceSchema),
  },
  team: teamContract,
  billing: billingContract,
  widgetSettings: {
    get: oc
      .errors(permissionErrors)
      .meta(
        openapi({
          method: "GET",
          path: "/widget-settings",
          summary: "Get the workspace's widget settings",
          tags: ["Widget settings"],
        }),
      )
      .output(savedWidgetSettingsSchema),
    update: oc
      .errors(permissionErrors)
      .meta(
        openapi({
          method: "PUT",
          path: "/widget-settings",
          summary: "Replace the workspace's widget settings",
          description:
            "Takes the full settings snapshot, so the latest write always wins.",
          tags: ["Widget settings"],
        }),
      )
      .input(widgetSettingsSchema)
      .output(savedWidgetSettingsSchema),
    createAvatarUpload: oc
      .errors(avatarErrors)
      .meta(
        openapi({
          method: "POST",
          path: "/widget-settings/avatar/uploads",
          summary: "Get a presigned URL for uploading a new agent avatar",
          tags: ["Widget settings"],
        }),
      )
      .input(createAvatarUploadSchema)
      .output(avatarUploadSchema),
    confirmAvatarUpload: oc
      .errors(avatarErrors)
      .meta(
        openapi({
          method: "POST",
          path: "/widget-settings/avatar",
          summary: "Use an uploaded image as the agent avatar",
          description:
            "Checks the stored object's size and type, then replaces the previous avatar.",
          tags: ["Widget settings"],
        }),
      )
      .input(confirmAvatarUploadSchema)
      .output(savedWidgetSettingsSchema),
    removeAvatar: oc
      .errors(permissionErrors)
      .meta(
        openapi({
          method: "DELETE",
          path: "/widget-settings/avatar",
          summary: "Remove the agent avatar and go back to the generated one",
          tags: ["Widget settings"],
        }),
      )
      .output(savedWidgetSettingsSchema),
  },
  widget: widgetContract,
  inbox: inboxContract,
  knowledge: knowledgeContract,
  realtime: {
    getToken: oc
      .errors({
        ...permissionErrors,
        [ConversationNotFoundError.code]: ConversationNotFoundError,
      })
      .meta(
        openapi({
          method: "POST",
          path: "/realtime/token",
          summary: "Get a short-lived token to open a real-time socket",
          description:
            "Without a conversation id the token opens the workspace room; with one, that conversation's room once it's confirmed to belong to the workspace.",
          tags: ["Realtime"],
        }),
      )
      .input(z.object({ conversationId: z.string().uuid().optional() }))
      .output(realtimeTokenSchema),
  },
};

export type Contract = typeof contract;
