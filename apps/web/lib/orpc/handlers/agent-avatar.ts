import "server-only";
import { replaceAgentAvatarKey } from "@marshaldesk/db";
import {
  AGENT_AVATAR_MAX_BYTES,
  AvatarRejectedError,
  WorkspaceRequiredError,
} from "@marshaldesk/shared";
import {
  deleteProfileImage,
  deleteProfileImageQuietly,
  headProfileImage,
  isAgentAvatarKey,
  isAgentAvatarMimeType,
  presignAgentAvatarUpload,
} from "@/lib/storage/agent-avatar";
import { memberProcedure, requirePermission } from "../procedures";
import { loadSavedWidgetSettings } from "./widget-settings";

const manageWidget = memberProcedure.use(requirePermission("widget:manage"));

const TOO_LARGE_MESSAGE = `Use an image under ${AGENT_AVATAR_MAX_BYTES / (1024 * 1024)} MB.`;
const WRONG_TYPE_MESSAGE = "Use a PNG, JPEG, WebP or GIF image.";
const MISSING_MESSAGE = "The upload didn't finish. Try again.";

async function swapAvatarKey(
  workspaceId: string,
  key: string | null,
): Promise<void> {
  const result = await replaceAgentAvatarKey(workspaceId, key);
  if (!result) {
    throw new WorkspaceRequiredError();
  }
  if (result.previousKey && result.previousKey !== key) {
    await deleteProfileImageQuietly(result.previousKey);
  }
}

export const createAvatarUpload =
  manageWidget.widgetSettings.createAvatarUpload.handler(
    ({ context, input }) => {
      if (!isAgentAvatarMimeType(input.contentType)) {
        throw new AvatarRejectedError({ message: WRONG_TYPE_MESSAGE });
      }
      if (input.size > AGENT_AVATAR_MAX_BYTES) {
        throw new AvatarRejectedError({ message: TOO_LARGE_MESSAGE });
      }
      return presignAgentAvatarUpload(
        context.workspaceId,
        input.contentType,
        input.size,
      );
    },
  );

export const confirmAvatarUpload =
  manageWidget.widgetSettings.confirmAvatarUpload.handler(
    async ({ context, input }) => {
      const { key } = input;
      if (!isAgentAvatarKey(context.workspaceId, key)) {
        throw new AvatarRejectedError();
      }

      const object = await headProfileImage(key);
      if (!object) {
        throw new AvatarRejectedError({ message: MISSING_MESSAGE });
      }
      if (object.size > AGENT_AVATAR_MAX_BYTES) {
        await deleteProfileImage(key);
        throw new AvatarRejectedError({ message: TOO_LARGE_MESSAGE });
      }
      if (!isAgentAvatarMimeType(object.contentType)) {
        await deleteProfileImage(key);
        throw new AvatarRejectedError({ message: WRONG_TYPE_MESSAGE });
      }

      await swapAvatarKey(context.workspaceId, key);
      return loadSavedWidgetSettings(context.workspaceId);
    },
  );

export const removeAvatar = manageWidget.widgetSettings.removeAvatar.handler(
  async ({ context }) => {
    await swapAvatarKey(context.workspaceId, null);
    return loadSavedWidgetSettings(context.workspaceId);
  },
);
