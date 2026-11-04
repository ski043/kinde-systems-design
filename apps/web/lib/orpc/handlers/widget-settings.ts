import "server-only";
import {
  getWidgetSettings,
  updateWidgetSettings,
  type WidgetSettingsRecord,
} from "@marshaldesk/db";
import {
  DEFAULT_GREETING,
  defaultAgentName,
  type SavedWidgetSettings,
  WorkspaceRequiredError,
} from "@marshaldesk/shared";
import { profileImageUrl } from "@/lib/storage/public-url";
import { memberProcedure, requirePermission } from "../procedures";

const manageWidget = memberProcedure.use(requirePermission("widget:manage"));

export function toSavedWidgetSettings(
  record: WidgetSettingsRecord,
): SavedWidgetSettings {
  return {
    settings: {
      agentName: record.agentName ?? defaultAgentName(record.workspaceName),
      color: record.color,
      position: record.position,
      greeting: record.greeting ?? DEFAULT_GREETING,
      allowedDomains: record.allowedDomains,
    },
    agentAvatarUrl: record.agentAvatarKey
      ? profileImageUrl(record.agentAvatarKey)
      : null,
    snippetInstalledAt: record.snippetInstalledAt,
  };
}

export async function loadSavedWidgetSettings(
  workspaceId: string,
): Promise<SavedWidgetSettings> {
  const record = await getWidgetSettings(workspaceId);
  if (!record) {
    throw new WorkspaceRequiredError();
  }
  return toSavedWidgetSettings(record);
}

export const getSettings = manageWidget.widgetSettings.get.handler(
  ({ context }) => loadSavedWidgetSettings(context.workspaceId),
);

export const updateSettings = manageWidget.widgetSettings.update.handler(
  async ({ context, input }) => {
    const record = await updateWidgetSettings(context.workspaceId, {
      ...input,
      allowedDomains: [...new Set(input.allowedDomains)],
    });
    if (!record) {
      throw new WorkspaceRequiredError();
    }
    return toSavedWidgetSettings(record);
  },
);
