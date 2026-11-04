"use client";

import {
  type ConversationState,
  type ConversationSummary,
  MESSAGE_MAX_LENGTH,
  nextState,
} from "@marshaldesk/shared";
import { useQuery } from "@tanstack/react-query";
import { SendHorizontalIcon, SparklesIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react";
import { useHydrated } from "@/components/inbox/use-hydrated";
import { useConversationActions } from "@/components/inbox/use-inbox";
import {
  type SuggestionProblem,
  useReplySuggestion,
} from "@/components/inbox/use-reply-suggestion";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { orpc } from "@/lib/orpc/client";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function problemText(
  problem: SuggestionProblem,
  canManageBilling: boolean,
): ReactNode {
  switch (problem.kind) {
    case "plan_required":
      return canManageBilling ? (
        <>
          Reply suggestions aren&apos;t part of your workspace&apos;s plan.{" "}
          <Link
            href={routes.billing}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Upgrade your plan
          </Link>{" "}
          to use them.
        </>
      ) : (
        "Reply suggestions aren't part of your workspace's plan. Ask your workspace owner to upgrade."
      );
    case "failed":
      return "Couldn't write a reply suggestion. Try again.";
    default: {
      const unhandled: never = problem;
      throw new Error(`Unhandled problem: ${String(unhandled)}`);
    }
  }
}

function hintFor(state: ConversationState): string {
  switch (state) {
    case "ai":
      return "Sending a reply takes over from the agent.";
    case "waiting":
      return "Sending a reply takes over this conversation.";
    case "human":
      return "The agent stays out of this conversation until you hand it back.";
    case "closed":
      return "This conversation is closed. The visitor can start a new one from the widget.";
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

function useIsApple(): boolean {
  const hydrated = useHydrated();
  return hydrated && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

export function Composer({
  conversation,
  onTyping,
}: {
  conversation: ConversationSummary;
  onTyping?: (typing: boolean) => void;
}) {
  const { reply } = useConversationActions(conversation.id);
  const [draft, setDraft] = useState("");
  const suggestion = useReplySuggestion(conversation.id, setDraft);
  const permissions =
    useQuery(orpc.member.getCurrent.queryOptions()).data?.permissions ?? [];
  const canSuggest = permissions.includes("suggestions:create");
  const isApple = useIsApple();
  const closed = nextState(conversation.state, "reply") === null;
  const suggesting = suggestion.status.kind === "streaming";
  const hasDraft = draft.trim().length > 0;
  const canSend = !closed && !reply.isPending && !suggesting && hasDraft;
  const problem =
    suggestion.status.kind === "problem" ? suggestion.status.problem : null;

  function send() {
    if (!canSend) return;
    onTyping?.(false);
    const body = draft;
    // The draft stays editable while sending; keep whatever was typed since.
    reply.mutate(
      { id: conversation.id, body },
      {
        onSuccess: () =>
          setDraft((current) =>
            current.startsWith(body)
              ? current.slice(body.length).trimStart()
              : current,
          ),
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form onSubmit={onSubmit} className="shrink-0 p-3 lg:px-4 lg:pb-4">
      <InputGroup className="mx-auto max-w-3xl rounded-xl bg-card shadow-soft">
        <InputGroupTextarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            suggestion.dismiss();
            if (!closed) onTyping?.(event.target.value.trim().length > 0);
          }}
          onBlur={() => onTyping?.(false)}
          onKeyDown={onKeyDown}
          disabled={closed && !hasDraft}
          readOnly={suggesting}
          aria-busy={suggesting}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={
            closed ? "This conversation is closed" : "Reply to the visitor…"
          }
          aria-label="Reply"
          className="max-h-48 min-h-20"
        />
        <InputGroupAddon align="block-end" className="gap-3">
          <p
            role={problem ? "status" : undefined}
            className={cn(
              "min-w-0 flex-1 text-left text-xs font-normal text-muted-foreground",
              problem?.kind === "failed" && "text-destructive",
            )}
          >
            {closed && hasDraft
              ? "This conversation is closed, so your reply wasn't sent. Copy it if you still need it."
              : problem
                ? problemText(problem, permissions.includes("billing:manage"))
                : suggesting
                  ? "Writing a reply suggestion from your knowledge base…"
                  : hintFor(conversation.state)}
          </p>
          {canSuggest ? (
            suggesting ? (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={suggestion.cancel}
                className="shrink-0"
              >
                <SquareIcon data-icon="inline-start" />
                Stop
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="sm"
                disabled={closed}
                onClick={() => void suggestion.suggest(draft)}
                className="shrink-0"
              >
                <SparklesIcon data-icon="inline-start" />
                Suggest reply
              </InputGroupButton>
            )
          ) : null}
          {closed ? null : (
            <>
              <kbd className="hidden shrink-0 font-sans text-xs font-normal text-muted-foreground sm:inline">
                {isApple ? "⌘ Enter" : "Ctrl Enter"}
              </kbd>
              <InputGroupButton
                type="submit"
                variant="default"
                size="sm"
                disabled={!canSend}
                className="shrink-0"
              >
                Send
                <SendHorizontalIcon data-icon="inline-end" />
              </InputGroupButton>
            </>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
