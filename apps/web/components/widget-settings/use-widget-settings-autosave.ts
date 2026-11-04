"use client";

import {
  type SavedWidgetSettings,
  type WidgetSettings,
  type WidgetSettingsInput,
  widgetSettingsSchema,
} from "@marshaldesk/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { client, orpc } from "@/lib/orpc/client";
import type { WidgetSettingsForm } from "./form";

export type AutosaveStatus =
  "idle" | "pending" | "saving" | "saved" | "invalid" | "failed";

export type WidgetSettingsAutosave = {
  status: AutosaveStatus;
  retry: () => void;
};

const TEXT_DELAY_MS = 900;
const DISCRETE_DELAY_MS = 100;

function delayFor(field: keyof WidgetSettingsInput): number {
  switch (field) {
    case "agentName":
    case "greeting":
      return TEXT_DELAY_MS;
    case "color":
    case "position":
    case "allowedDomains":
      return DISCRETE_DELAY_MS;
    default: {
      const unhandled: never = field;
      return unhandled;
    }
  }
}

function fieldOf(name: string | undefined): keyof WidgetSettingsInput {
  const root = name?.split(".", 1)[0];
  const fields = widgetSettingsSchema.keyof().options;
  return fields.find((field) => field === root) ?? "allowedDomains";
}

function serialize(settings: WidgetSettings): string {
  return JSON.stringify(settings);
}

/**
 * Saves the full settings snapshot after each valid edit. At most one save is
 * in flight; edits made meanwhile collapse into the latest snapshot, which is
 * sent once the current save settles, so an older response never wins.
 */
export function useWidgetSettingsAutosave(
  form: WidgetSettingsForm,
  saved: WidgetSettings,
): WidgetSettingsAutosave {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  const lastSaved = useRef(serialize(saved));
  const queued = useRef<WidgetSettings | null>(null);
  const failed = useRef<WidgetSettings | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (inFlight.current || !queued.current) return;
    inFlight.current = true;
    setStatus("saving");

    let snapshot: WidgetSettings | null;
    while ((snapshot = queued.current)) {
      queued.current = null;
      try {
        const result: SavedWidgetSettings =
          await client.widgetSettings.update(snapshot);
        lastSaved.current = serialize(snapshot);
        failed.current = null;
        void queryClient.invalidateQueries({
          queryKey: orpc.member.getCurrent.queryKey(),
        });
        queryClient.setQueryData(
          orpc.widgetSettings.get.queryKey(),
          // The avatar has its own mutations, so a cached value (even a
          // removed one) is fresher than this save's response.
          (current) => ({
            ...result,
            agentAvatarUrl: current
              ? current.agentAvatarUrl
              : result.agentAvatarUrl,
          }),
        );
      } catch {
        failed.current = snapshot;
      }
    }
    inFlight.current = false;

    if (failed.current) {
      setStatus("failed");
    } else if (timer.current) {
      setStatus("pending");
    } else {
      const valid = widgetSettingsSchema.safeParse(form.getValues()).success;
      setStatus(valid ? "saved" : "invalid");
    }
  }, [form, queryClient]);

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;

      const parsed = widgetSettingsSchema.safeParse(form.getValues());
      if (!parsed.success) {
        queued.current = null;
        if (!inFlight.current) setStatus("invalid");
        return;
      }
      const snapshot = parsed.data;
      if (serialize(snapshot) === lastSaved.current && !inFlight.current) {
        queued.current = null;
        failed.current = null;
        setStatus((current) => (current === "idle" ? "idle" : "saved"));
        return;
      }

      if (!inFlight.current) setStatus("pending");
      const send = () => {
        timer.current = null;
        queued.current = snapshot;
        void flush();
      };
      if (delay === 0) send();
      else timer.current = setTimeout(send, delay);
    },
    [form, flush],
  );

  useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      schedule(delayFor(fieldOf(name)));
    });
    return () => subscription.unsubscribe();
  }, [form, schedule]);

  // Navigating to another dashboard page shouldn't drop a debounced or failed edit.
  useEffect(
    () => () => {
      if (!timer.current && !failed.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const parsed = widgetSettingsSchema.safeParse(form.getValues());
      const snapshot = parsed.success ? parsed.data : failed.current;
      if (snapshot) {
        queued.current = snapshot;
        void flush();
      }
    },
    [form, flush],
  );

  useEffect(() => {
    const unsaved =
      status === "pending" ||
      status === "saving" ||
      status === "failed" ||
      status === "invalid";
    if (!unsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const retry = useCallback(() => {
    const parsed = widgetSettingsSchema.safeParse(form.getValues());
    const snapshot = parsed.success ? parsed.data : failed.current;
    if (!snapshot) return;
    queued.current = snapshot;
    void flush();
  }, [form, flush]);

  return { status, retry };
}
