"use client";

import type { suggestReplyErrors } from "@marshaldesk/shared";
import { isDefinedError, ORPCError } from "@orpc/client";
import type { ORPCErrorFromErrorMap } from "@orpc/contract";
import { useEffect, useRef, useState } from "react";
import { client } from "@/lib/orpc/client";

export type SuggestionProblem = { kind: "plan_required" } | { kind: "failed" };

export type SuggestionStatus =
  | { kind: "idle" }
  | { kind: "streaming" }
  | { kind: "problem"; problem: SuggestionProblem };

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

/** What `suggestReply` can throw: a contract error, or anything else (network, server). */
type SuggestError = ORPCErrorFromErrorMap<typeof suggestReplyErrors> | Error;

/**
 * A dropped connection, or the server still finishing the attempt it lost.
 * Retrying with the same idempotency key either resumes from a `failed` row or
 * returns the draft that already succeeded, so nothing counts twice.
 */
function isRetryable(error: SuggestError): boolean {
  if (isDefinedError(error)) return error.code === "SUGGESTION_IN_PROGRESS";
  return !(error instanceof ORPCError);
}

function toProblem(error: SuggestError): SuggestionProblem {
  return isDefinedError(error) && error.code === "PLAN_REQUIRED"
    ? { kind: "plan_required" }
    : { kind: "failed" };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Streams a reply suggestion into the draft through `onDraft`. Each call is
 * one click with its own idempotency key. A cancelled or failed suggestion
 * puts back the draft it started from, since only a finished one counts.
 */
export function useReplySuggestion(
  conversationId: string,
  onDraft: (draft: string) => void,
) {
  const [status, setStatus] = useState<SuggestionStatus>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function suggest(draft: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus({ kind: "streaming" });
    const idempotencyKey = crypto.randomUUID();
    const prefix = draft.trim() === "" ? "" : `${draft.trimEnd()}\n\n`;

    for (let attempt = 0; ; attempt++) {
      try {
        const events = await client.inbox.suggestReply(
          { conversationId, idempotencyKey },
          { signal: controller.signal },
        );
        let text = "";
        for await (const event of events) {
          text = event.type === "delta" ? text + event.text : event.body;
          onDraft(prefix + text);
        }
        setStatus({ kind: "idle" });
        return;
      } catch (caught) {
        const error = caught as SuggestError;
        onDraft(draft);
        if (controller.signal.aborted) {
          setStatus({ kind: "idle" });
          return;
        }
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          await wait(RETRY_DELAY_MS * (attempt + 1), controller.signal);
          if (controller.signal.aborted) {
            setStatus({ kind: "idle" });
            return;
          }
          continue;
        }
        setStatus({ kind: "problem", problem: toProblem(error) });
        return;
      }
    }
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  function dismiss() {
    setStatus((current) =>
      current.kind === "problem" ? { kind: "idle" } : current,
    );
  }

  return { status, suggest, cancel, dismiss };
}
