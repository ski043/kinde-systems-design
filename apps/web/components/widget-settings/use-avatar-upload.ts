"use client";

import {
  AGENT_AVATAR_MAX_BYTES,
  agentAvatarMimeTypeSchema,
  type SavedWidgetSettings,
} from "@marshaldesk/shared";
import { isDefinedError, type ORPCError, safe } from "@orpc/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { client, orpc } from "@/lib/orpc/client";
import { putFile } from "./put-file";

const maxMegabytes = AGENT_AVATAR_MAX_BYTES / (1024 * 1024);

export const avatarRequirements = `PNG, JPEG, WebP or GIF, up to ${maxMegabytes} MB.`;

const UPLOAD_FAILED = "Couldn't upload the image. Try again.";

export type AvatarUpload = {
  /** The saved avatar's public URL, or null when the generated one is used. */
  url: string | null;
  /** 0–100 while an upload is running, otherwise null. */
  progress: number | null;
  removing: boolean;
  error: string | null;
  select: (file: File) => void;
  fail: (message: string) => void;
  remove: () => void;
};

function rejectionMessage(error: Error | ORPCError<string, unknown>): string {
  return isDefinedError(error) && error.code === "AVATAR_REJECTED"
    ? error.message
    : UPLOAD_FAILED;
}

/** Uploads the agent avatar to storage and keeps the previous one on any failure. */
export function useAvatarUpload(): AvatarUpload {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(orpc.widgetSettings.get.queryOptions());
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applySaved(saved: SavedWidgetSettings) {
    void queryClient.invalidateQueries({
      queryKey: orpc.member.getCurrent.queryKey(),
    });
    queryClient.setQueryData(orpc.widgetSettings.get.queryKey(), (current) => ({
      ...saved,
      settings: current?.settings ?? saved.settings,
    }));
  }

  async function upload(file: File) {
    const contentType = agentAvatarMimeTypeSchema.safeParse(file.type);
    if (!contentType.success) {
      setError("Use a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > AGENT_AVATAR_MAX_BYTES) {
      setError(`Use an image under ${maxMegabytes} MB.`);
      return;
    }

    setError(null);
    setProgress(0);
    try {
      const [presignError, target] = await safe(
        client.widgetSettings.createAvatarUpload({
          contentType: contentType.data,
          size: file.size,
        }),
      );
      if (presignError) {
        setError(rejectionMessage(presignError));
        return;
      }

      const stored = await putFile(
        target.uploadUrl,
        target.headers,
        file,
        setProgress,
      );
      if (!stored) {
        setError(UPLOAD_FAILED);
        return;
      }

      const [confirmError, saved] = await safe(
        client.widgetSettings.confirmAvatarUpload({ key: target.key }),
      );
      if (confirmError) {
        setError(rejectionMessage(confirmError));
        return;
      }
      applySaved(saved);
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    setError(null);
    setRemoving(true);
    const [removeError, saved] = await safe(
      client.widgetSettings.removeAvatar(),
    );
    setRemoving(false);
    if (removeError) {
      setError("Couldn't remove the image. Try again.");
      return;
    }
    applySaved(saved);
  }

  return {
    url: data.agentAvatarUrl,
    progress,
    removing,
    error,
    select: (file) => {
      if (progress === null) void upload(file);
    },
    fail: setError,
    remove: () => void remove(),
  };
}
