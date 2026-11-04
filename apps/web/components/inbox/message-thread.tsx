"use client";

import type {
  AgentTurnSummary,
  ConversationDetail,
  Message,
  ReplySource,
  SystemEvent,
  Visitor,
} from "@marshaldesk/shared";
import {
  ArrowLeftRightIcon,
  BanIcon,
  CircleCheckIcon,
  FileTextIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { AgentTurnDetails } from "@/components/inbox/agent-turn-details";
import {
  AgentAvatar,
  MemberAvatar,
  useAgent,
  useCurrentMember,
  VisitorAvatar,
} from "@/components/inbox/participant-avatar";
import { ChunkPreviewDialog } from "@/components/dashboard/chunk-preview-dialog";
import { RelativeTime } from "@/components/inbox/relative-time";
import { TypingDots } from "@/components/inbox/typing-dots";
import { systemEventLabel, visitorLabel } from "@/lib/inbox/format";
import { type AgentPartial, visiblePartial } from "@/lib/realtime/agent-stream";
import { useArrivals } from "@/lib/use-arrivals";
import { cn } from "@/lib/utils";

const ENTER = "animate-enter motion-reduce:animate-none";
const FADE = "animate-fade-in motion-reduce:animate-none";

type SystemMessage = Extract<Message, { author: "system" }>;
type SpokenMessage = Exclude<Message, SystemMessage>;

type ThreadItem =
  | { kind: "event"; message: SystemMessage }
  | {
      kind: "group";
      author: SpokenMessage["author"];
      messages: SpokenMessage[];
    };

const GROUP_GAP_MS = 5 * 60_000;
/** How close to the end counts as reading the latest messages. */
const STICK_TO_END_PX = 96;

function groupMessages(messages: readonly Message[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  for (const message of messages) {
    if (message.author === "system") {
      items.push({ kind: "event", message });
      continue;
    }
    const previous = items.at(-1);
    const previousMessage =
      previous?.kind === "group" ? previous.messages.at(-1) : undefined;
    if (
      previous?.kind === "group" &&
      previous.author === message.author &&
      previousMessage &&
      Date.parse(message.createdAt) - Date.parse(previousMessage.createdAt) <
        GROUP_GAP_MS
    ) {
      previous.messages.push(message);
    } else {
      items.push({
        kind: "group",
        author: message.author,
        messages: [message],
      });
    }
  }
  return items;
}

export function MessageThread({
  conversation,
  visitorTyping = false,
  agentPartial = null,
}: {
  conversation: ConversationDetail;
  visitorTyping?: boolean;
  /** The agent reply streaming in, shown only while the agent has the conversation. */
  agentPartial?: AgentPartial | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const stickToEnd = useRef(true);
  const shown = useRef<{ id: string; lastMessageId: string | undefined }>(null);
  const partial = visiblePartial(
    agentPartial,
    conversation.state,
    conversation.messages,
  );
  const messages: readonly Message[] = partial
    ? [
        ...conversation.messages,
        {
          id: partial.messageId,
          conversationId: conversation.id,
          createdAt: partial.startedAt,
          author: "agent",
          body: partial.text,
        },
      ]
    : conversation.messages;
  const items = groupMessages(messages);
  const isNew = useArrivals(
    messages.map((message) => message.id),
    conversation.id,
  );
  const lastMessage = messages.at(-1);
  const lastMessageId = lastMessage?.id;
  const lastMessageLength =
    lastMessage && "body" in lastMessage ? lastMessage.body.length : 0;
  const ownReplyLast = lastMessage?.author === "member";

  useEffect(() => {
    const viewport = endRef.current?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!viewport) return;
    function onScroll() {
      if (!viewport) return;
      stickToEnd.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        STICK_TO_END_PX;
    }
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  // Follows new messages only while the owner is reading the end, so
  // scrolling back through the history isn't interrupted.
  useEffect(() => {
    const switched = shown.current?.id !== conversation.id;
    const newOwnReply =
      ownReplyLast && shown.current?.lastMessageId !== lastMessageId;
    shown.current = { id: conversation.id, lastMessageId };
    if (switched) stickToEnd.current = true;
    if (switched || newOwnReply || stickToEnd.current) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [
    conversation.id,
    lastMessageId,
    lastMessageLength,
    ownReplyLast,
    visitorTyping,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 lg:px-6">
      <div
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="flex flex-col gap-5"
      >
        {items.map((item) => (
          <Fragment
            key={item.kind === "event" ? item.message.id : item.messages[0]?.id}
          >
            {item.kind === "event" ? (
              <div className={cn(isNew(item.message.id) && ENTER)}>
                <EventItem message={item.message} />
              </div>
            ) : (
              <MessageGroup
                visitor={conversation.visitor}
                item={item}
                streamingId={partial?.messageId ?? null}
                agentSources={conversation.agentSources}
                agentTurns={conversation.agentTurns}
                isNew={isNew}
              />
            )}
          </Fragment>
        ))}
      </div>
      <div aria-live="polite" className="empty:-mt-5">
        {visitorTyping ? (
          <VisitorTyping visitor={conversation.visitor} />
        ) : null}
      </div>
      <div ref={endRef} />
    </div>
  );
}

function VisitorTyping({ visitor }: { visitor: Visitor }) {
  return (
    <div className="flex items-end gap-3">
      <VisitorAvatar visitorId={visitor.id} />
      <div className="rounded-xl rounded-tl-sm bg-muted px-3.5 py-2 text-muted-foreground">
        <TypingDots />
        <span className="sr-only">{visitorLabel(visitor)} is typing</span>
      </div>
    </div>
  );
}

function eventIcon(event: SystemEvent): ReactNode {
  switch (event.kind) {
    case "greeting":
      return null;
    case "handoff":
      return <ArrowLeftRightIcon className="size-3.5" aria-hidden />;
    case "taken_over":
      return <UserRoundCheckIcon className="size-3.5" aria-hidden />;
    case "handed_back":
      return <ArrowLeftRightIcon className="size-3.5" aria-hidden />;
    case "closed":
      return <CircleCheckIcon className="size-3.5" aria-hidden />;
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
    }
  }
}

function EventItem({ message }: { message: SystemMessage }) {
  const { event } = message;
  if (event.kind === "greeting") {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="px-1 text-xs text-muted-foreground">Greeting</p>
        <div className="max-w-[85%] rounded-xl border border-dashed px-3.5 py-2 text-sm text-muted-foreground">
          {event.body}
        </div>
      </div>
    );
  }

  return (
    <div
      role="note"
      className={cn(
        "flex items-center gap-3 text-xs",
        event.kind === "handoff"
          ? "font-medium text-foreground"
          : "text-muted-foreground",
      )}
    >
      <span className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1.5 text-center text-balance">
        {eventIcon(event)}
        <span>
          {systemEventLabel(event)}
          <span className="font-normal text-muted-foreground">
            {" · "}
            <RelativeTime iso={message.createdAt} />
          </span>
        </span>
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageGroup({
  visitor,
  item,
  streamingId,
  agentSources,
  agentTurns,
  isNew,
}: {
  visitor: Visitor;
  item: Extract<ThreadItem, { kind: "group" }>;
  streamingId: string | null;
  agentSources: ConversationDetail["agentSources"];
  agentTurns: ConversationDetail["agentTurns"];
  isNew: (id: string) => boolean;
}) {
  const agent = useAgent();
  const currentMember = useCurrentMember();
  const fromVisitor = item.author === "visitor";
  const first = item.messages[0];
  if (!first) {
    return null;
  }

  let name: string;
  let avatar: ReactNode;
  switch (first.author) {
    case "visitor":
      name = visitorLabel(visitor);
      avatar = <VisitorAvatar visitorId={visitor.id} />;
      break;
    case "agent":
      name = agent.name;
      avatar = <AgentAvatar />;
      break;
    case "member":
      name =
        first.member.id === currentMember.id
          ? `${first.member.name} (you)`
          : first.member.name;
      avatar = <MemberAvatar member={first.member} />;
      break;
    default: {
      const unhandled: never = first;
      throw new Error(`Unhandled author: ${JSON.stringify(unhandled)}`);
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        fromVisitor ? "flex-row" : "flex-row-reverse",
      )}
    >
      <div className="shrink-0 pt-5">{avatar}</div>
      <div
        className={cn(
          "flex max-w-[85%] min-w-0 flex-col gap-1",
          fromVisitor ? "items-start" : "items-end",
        )}
      >
        <p
          className={cn(
            "flex items-baseline gap-1.5 px-1 text-xs",
            !fromVisitor && "flex-row-reverse",
          )}
        >
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">
            <RelativeTime iso={first.createdAt} />
          </span>
        </p>
        {item.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            streaming={message.id === streamingId}
            sources={agentSources?.[message.id] ?? []}
            turn={agentTurns?.[message.id] ?? null}
            entering={isNew(message.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ReplySources({
  sources,
  entering,
}: {
  sources: readonly ReplySource[];
  /** Sources are logged after the reply arrives, so they fade in on their own. */
  entering: boolean;
}) {
  const [preview, setPreview] = useState<{
    open: boolean;
    source: { id: string; name: string } | null;
  }>({ open: false, source: null });
  if (sources.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1.5 px-1 text-xs text-muted-foreground",
        entering && FADE,
      )}
    >
      <span>Answered from</span>
      {sources.map((source) => {
        const { name } = source;
        return name ? (
          <button
            key={source.id}
            type="button"
            title={`View the chunks of ${name}`}
            onClick={() =>
              setPreview({ open: true, source: { id: source.id, name } })
            }
            className="flex max-w-56 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 transition-colors outline-none hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <FileTextIcon className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{name}</span>
          </button>
        ) : (
          <span
            key={source.id}
            className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 italic"
          >
            <FileTextIcon className="size-3 shrink-0" aria-hidden />A deleted
            source
          </span>
        );
      })}
      <ChunkPreviewDialog
        open={preview.open}
        source={preview.source}
        onOpenChange={(open) => setPreview((current) => ({ ...current, open }))}
      />
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
  sources,
  turn,
  entering,
}: {
  message: SpokenMessage;
  streaming: boolean;
  sources: readonly ReplySource[];
  /** How the agent handled this visitor message, if it did. */
  turn: AgentTurnSummary | null;
  /** The message arrived while the conversation was open. */
  entering: boolean;
}) {
  const enter = entering && ENTER;
  switch (message.author) {
    case "visitor":
      return (
        <>
          <div
            className={cn(
              "rounded-xl rounded-tl-sm bg-muted px-3.5 py-2 text-sm wrap-anywhere whitespace-pre-wrap",
              enter,
            )}
          >
            {message.body}
          </div>
          {message.declined ? (
            <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <BanIcon className="size-3.5" aria-hidden />
              Declined as off-topic. The agent didn&apos;t search the knowledge
              base.
            </p>
          ) : null}
          {turn ? (
            <div className={cn(entering && FADE)}>
              <AgentTurnDetails turn={turn} />
            </div>
          ) : null}
        </>
      );
    case "agent":
      return (
        <>
          <div
            className={cn(
              "rounded-xl rounded-tr-sm border border-primary/45 bg-primary/8 px-3.5 py-2 text-sm",
              enter,
            )}
          >
            <MessageMarkdown body={message.body} streaming={streaming} />
          </div>
          {streaming ? null : (
            <ReplySources sources={sources} entering={entering} />
          )}
        </>
      );
    case "member":
      return (
        <div
          className={cn(
            "rounded-xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground [&_a]:text-primary-foreground [&_code]:bg-primary-foreground/15 [&_code]:text-primary-foreground",
            enter,
          )}
        >
          <MessageMarkdown body={message.body} />
        </div>
      );
    default: {
      const unhandled: never = message;
      throw new Error(`Unhandled message: ${JSON.stringify(unhandled)}`);
    }
  }
}

function MessageMarkdown({
  body,
  streaming = false,
}: {
  body: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      controls={false}
      className="space-y-2 wrap-anywhere [&_ol]:space-y-0.5 [&_ul]:space-y-0.5"
    >
      {body}
    </Streamdown>
  );
}
