import "server-only";
import { getWidgetSettings, type WorkspaceRecord } from "@marshaldesk/db";
import { WorkspaceRequiredError } from "@marshaldesk/shared";
import { resolveAvatarUrl } from "@/lib/avatar";
import { joinInvitedWorkspace } from "@/lib/kinde/join";
import { RoleNotInKindeError } from "@/lib/kinde/members";
import { provisionWorkspace } from "@/lib/kinde/provision";
import { signInToOrganizationUrl } from "@/lib/kinde/urls";
import {
  confirmAvatarUpload,
  createAvatarUpload,
  removeAvatar,
} from "./handlers/agent-avatar";
import * as billing from "./handlers/billing";
import * as inbox from "./handlers/inbox";
import * as knowledge from "./handlers/knowledge";
import { getToken } from "./handlers/realtime";
import * as team from "./handlers/team";
import {
  getConfig,
  getRealtimeToken,
  getThread,
  requestHuman,
  sendMessage,
  start,
} from "./handlers/widget";
import {
  getSettings,
  toSavedWidgetSettings,
  updateSettings,
} from "./handlers/widget-settings";
import { authenticatedProcedure, base, memberProcedure } from "./procedures";

const getCurrentMember = memberProcedure.member.getCurrent.handler(
  async ({ context }) => {
    const settings = await getWidgetSettings(context.workspaceId);
    if (!settings) {
      throw new WorkspaceRequiredError();
    }
    const { settings: widget, agentAvatarUrl } =
      toSavedWidgetSettings(settings);
    return {
      member: {
        id: context.member.id,
        name: context.member.name,
        email: context.member.email,
        avatarUrl: resolveAvatarUrl(context.member),
        role: context.member.role,
      },
      workspace: {
        id: context.workspaceId,
        name: settings.workspaceName,
        accentColor: widget.color,
        agent: { name: widget.agentName, avatarUrl: agentAvatarUrl },
      },
      permissions: context.permissions,
    };
  },
);

function createdWorkspace(workspace: WorkspaceRecord) {
  return {
    workspace: { id: workspace.id, name: workspace.name },
    continueUrl: signInToOrganizationUrl(workspace.kindeOrgCode),
  };
}

const createWorkspace = authenticatedProcedure.workspace.create.handler(
  async ({ context, input }) => {
    const { workspace } = await provisionWorkspace(context.session, input.name);
    return createdWorkspace(workspace);
  },
);

const acceptInvitation =
  authenticatedProcedure.workspace.acceptInvitation.handler(
    async ({ context, errors }) => {
      try {
        const membership = await joinInvitedWorkspace(context.session);
        if (!membership) throw errors.NOT_FOUND();
        return createdWorkspace(membership.workspace);
      } catch (error) {
        if (error instanceof RoleNotInKindeError) {
          throw errors.ROLE_UNAVAILABLE({ data: { role: error.role } });
        }
        throw error;
      }
    },
  );

export const router = base.router({
  member: { getCurrent: getCurrentMember },
  workspace: { create: createWorkspace, acceptInvitation },
  team: {
    list: team.list,
    invite: team.invite,
    revokeInvitation: team.revokeInvitation,
    changeRole: team.changeRole,
    removeMember: team.removeMember,
  },
  billing: { get: billing.get, createPortalLink: billing.createPortalLink },
  widgetSettings: {
    get: getSettings,
    update: updateSettings,
    createAvatarUpload,
    confirmAvatarUpload,
    removeAvatar,
  },
  widget: {
    getConfig,
    start,
    getThread,
    sendMessage,
    requestHuman,
    getRealtimeToken,
  },
  inbox: {
    list: inbox.list,
    get: inbox.get,
    reply: inbox.reply,
    takeOver: inbox.takeOver,
    handBack: inbox.handBack,
    close: inbox.close,
    markRead: inbox.markRead,
    suggestReply: inbox.suggestReply,
  },
  knowledge: {
    get: knowledge.get,
    getSource: knowledge.getSource,
    createUpload: knowledge.createUpload,
    createText: knowledge.createText,
    updateText: knowledge.updateText,
    deleteSource: knowledge.deleteSource,
    abandonUpload: knowledge.abandonUpload,
    listChunks: knowledge.listChunks,
  },
  realtime: { getToken },
});

export type Router = typeof router;
