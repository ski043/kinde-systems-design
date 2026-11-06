"use client";

import {
  type AgentTurnMatch,
  type AgentTurnSummary,
  type MessageClassification,
  RETRIEVAL_CONTEXT_SIMILARITY,
  RETRIEVAL_MIN_SIMILARITY,
} from "@marshaldesk/shared";
import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

function classificationLabel(classification: MessageClassification): string {
  switch (classification) {
    case "support_question":
      return "Support question";
    case "small_talk":
      return "Small talk";
    case "off_topic":
      return "Off-topic";
    case "human_request":
      return "Asked for a person";
    default: {
      const unhandled: never = classification;
      throw new Error(`Unhandled classification: ${String(unhandled)}`);
    }
  }
}

function handoffSentence(reason: AgentTurnSummary["handoffReason"]): string {
  switch (reason) {
    case "no_relevant_knowledge":
      return "Handed off: nothing in the knowledge base matched closely enough";
    case "low_confidence":
      return "Handed off: the agent couldn't answer from what it found";
    case "visitor_requested":
      return "Handed off: the visitor asked for a person";
    case "agent_off":
      return "Handed off: the agent is off";
    case "ai_reply_limit":
      return "Handed off: the plan's AI replies for this cycle are used up";
    case null:
      return "Handed off to you";
    default: {
      const unhandled: never = reason;
      throw new Error(`Unhandled handoff reason: ${String(unhandled)}`);
    }
  }
}

function outcomeSentence(turn: AgentTurnSummary): string {
  switch (turn.outcome) {
    case "answered":
      return "Answered from the knowledge base";
    case "small_talk":
      return "Replied with small talk";
    case "declined":
      return "Declined as off-topic, no knowledge base search";
    case "handoff":
      return handoffSentence(turn.handoffReason);
    case "discarded":
      return "Skipped: a newer message or a take-over replaced this reply";
    case "failed":
      return "Failed, so it handed off";
    default: {
      const unhandled: never = turn.outcome;
      throw new Error(`Unhandled outcome: ${String(unhandled)}`);
    }
  }
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function matchStatus(match: AgentTurnMatch, best: number): string {
  if (match.used) return "Used";
  if (
    best < RETRIEVAL_MIN_SIMILARITY ||
    match.score < RETRIEVAL_CONTEXT_SIMILARITY
  ) {
    return "Below threshold";
  }
  return "Read, not used";
}

function Matches({ matches }: { matches: readonly AgentTurnMatch[] }) {
  const best = matches[0]?.score ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground">
        {matches.length === 0
          ? "The knowledge base search found nothing."
          : `The best match needs ${formatScore(RETRIEVAL_MIN_SIMILARITY)} for the agent to answer, and others from ${formatScore(RETRIEVAL_CONTEXT_SIMILARITY)} join it.`}
      </p>
      {matches.length > 0 ? (
        <ol className="flex flex-col gap-1.5">
          {matches.map((match) => (
            <li
              key={match.chunkId}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2"
            >
              <span
                className={cn(
                  "truncate",
                  match.sourceName === null && "text-muted-foreground italic",
                )}
                title={match.sourceName ?? undefined}
              >
                {match.sourceName ?? "An earlier version of a source"}
              </span>
              <span
                className="h-1.5 w-14 overflow-hidden rounded-full bg-foreground/10"
                aria-hidden
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    match.used ? "bg-primary" : "bg-muted-foreground/50",
                  )}
                  style={{
                    width: `${Math.round(Math.min(Math.max(match.score, 0), 1) * 100)}%`,
                  }}
                />
              </span>
              <span className="font-mono text-muted-foreground tabular-nums">
                {formatScore(match.score)}
              </span>
              <span
                className={cn(
                  "w-24 text-right",
                  match.used ? "font-medium" : "text-muted-foreground",
                )}
              >
                {matchStatus(match, best)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function TurnMeta({ turn }: { turn: AgentTurnSummary }) {
  const models = [
    ...new Set([turn.classifierModel, turn.model].filter((m) => m !== null)),
  ];
  const parts = [
    models.join(", "),
    turn.firstTokenMs === null
      ? null
      : `First word in ${seconds(turn.firstTokenMs)}`,
    `Done in ${seconds(turn.latencyMs)}`,
    `${turn.tokensIn.toLocaleString("en-US")} tokens in, ${turn.tokensOut.toLocaleString("en-US")} out`,
  ].filter((part) => part !== null);
  return (
    <p className="border-t border-foreground/10 pt-2 text-muted-foreground">
      {parts.join(" · ")}
    </p>
  );
}

/** Owner-only: how the agent classified and handled one visitor message. */
export function AgentTurnDetails({ turn }: { turn: AgentTurnSummary }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex w-104 max-w-full flex-col items-start gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <SparklesIcon className="size-3.5" aria-hidden />
        How the agent handled this
        <ChevronDownIcon
          className={cn(
            "size-3.5 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={panelId}
          className="flex w-full animate-enter flex-col gap-3 rounded-lg bg-muted/60 p-3 text-xs ring-1 ring-foreground/10 motion-reduce:animate-none"
        >
          <div className="flex flex-col gap-1">
            <span className="w-fit rounded-md bg-background px-1.5 py-0.5 font-medium ring-1 ring-foreground/10">
              {classificationLabel(turn.classification)}
            </span>
            <p className="text-sm">{outcomeSentence(turn)}</p>
            {turn.error ? (
              <p className="font-mono wrap-anywhere text-muted-foreground">
                {turn.error}
              </p>
            ) : null}
          </div>
          {turn.matches.length > 0 ||
          turn.handoffReason === "no_relevant_knowledge" ? (
            <Matches matches={turn.matches} />
          ) : null}
          <TurnMeta turn={turn} />
        </div>
      ) : null}
    </div>
  );
}
