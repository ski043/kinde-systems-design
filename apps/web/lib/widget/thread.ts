import type {
  Conversation,
  HandoffReason,
  Message,
  SystemEvent,
  WidgetThread,
} from "@marshaldesk/shared";
import type { WidgetMessage } from "@/components/widget/types";
import { isOlder, laterIso, mergeMessages } from "@/lib/realtime/messages";

function handoffCopy(reason: HandoffReason): string {
  switch (reason) {
    case "agent_off":
      return "You'll be connected to a person shortly. It can take a little while, so please hang on.";
    case "visitor_requested":
      return "A person will join shortly. Replies will appear here.";
    case "no_relevant_knowledge":
      return "We couldn't find the answer to that, so we're bringing in a person. They'll reply here shortly.";
    case "low_confidence":
    case "ai_reply_limit":
      return "We're bringing in a person to help with this. They'll reply here shortly.";
    default: {
      const unhandled: never = reason;
      throw new Error(`Unhandled handoff reason: ${String(unhandled)}`);
    }
  }
}

/** The name of the member who replied next in the same conversation. */
function joiningMemberName(
  messages: readonly Message[],
  index: number,
): string | null {
  const event = messages[index];
  if (!event) return null;
  for (const message of messages.slice(index + 1)) {
    if (message.conversationId !== event.conversationId) return null;
    if (message.author === "member") return message.member.name;
  }
  return null;
}

function systemCopy(
  event: Exclude<SystemEvent, { kind: "greeting" }>,
  memberName: () => string | null,
): string {
  switch (event.kind) {
    case "handoff":
      return handoffCopy(event.reason);
    case "taken_over": {
      const name = memberName();
      return name
        ? `${name} joined the conversation`
        : "A person joined the conversation";
    }
    case "handed_back":
      return "You're now chatting with the AI agent.";
    case "closed":
      return "This conversation has ended. Send a message to start a new one.";
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled system event: ${JSON.stringify(unhandled)}`);
    }
  }
}

/** Resolves server messages into what the widget shows. */
export function toWidgetMessages(
  messages: readonly Message[],
): WidgetMessage[] {
  return messages.map((message, index): WidgetMessage => {
    switch (message.author) {
      case "visitor":
        return { id: message.id, author: "visitor", body: message.body };
      case "agent":
        return { id: message.id, author: "agent", body: message.body };
      case "member":
        return {
          id: message.id,
          author: "member",
          body: message.body,
          member: {
            name: message.member.name,
            avatarUrl: message.member.avatarUrl,
          },
        };
      case "system": {
        const { event } = message;
        if (event.kind === "greeting") {
          return { id: message.id, author: "agent", body: event.body };
        }
        return {
          id: message.id,
          author: "system",
          body: systemCopy(event, () => joiningMemberName(messages, index)),
        };
      }
      default: {
        const unhandled: never = message;
        throw new Error(`Unhandled message: ${JSON.stringify(unhandled)}`);
      }
    }
  });
}

/**
 * The newer of two conversations: for the same one the later `updatedAt`,
 * otherwise the one started later (a new conversation after a close).
 */
export function newerConversation(
  current: Conversation | null,
  next: Conversation | null,
): Conversation | null {
  if (!current) return next;
  if (!next) return current;
  if (current.id !== next.id) {
    return Date.parse(next.createdAt) >= Date.parse(current.createdAt)
      ? next
      : current;
  }
  const winner = isOlder(next, current) ? current : next;
  return {
    ...winner,
    lastMessageAt: laterIso(current.lastMessageAt, next.lastMessageAt),
  };
}

/**
 * Takes a thread from the server without losing messages a socket delivered
 * while the request was in flight, or going back to an older state.
 */
export function mergeThread(
  current: WidgetThread | undefined,
  next: WidgetThread,
): WidgetThread {
  if (!current) return next;
  return {
    conversation: newerConversation(current.conversation, next.conversation),
    messages: mergeMessages(current.messages, next.messages),
  };
}

export function appendToThread(
  thread: WidgetThread | undefined,
  message: Message,
): WidgetThread | undefined {
  if (!thread) return thread;
  const messages = mergeMessages(thread.messages, [message]);
  if (messages.length === thread.messages.length) return thread;
  const { conversation } = thread;
  return {
    messages,
    conversation:
      conversation && conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessageAt: laterIso(
              conversation.lastMessageAt,
              message.createdAt,
            ),
          }
        : conversation,
  };
}

/** The member who wrote last, to put a face on the typing indicator. */
export function lastMember(
  messages: readonly Message[],
): { name: string; avatarUrl: string } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.author === "member") {
      return { name: message.member.name, avatarUrl: message.member.avatarUrl };
    }
  }
  return null;
}

/** The line under the agent's name in the widget header, or `null` for none. */
export function headerStatus(
  agentEnabled: boolean,
  conversation: Conversation | null,
  member: { name: string } | null,
): string | null {
  if (!conversation) {
    return agentEnabled ? "Replies right away" : "A person will reply soon";
  }
  switch (conversation.state) {
    case "ai":
      return "Replies right away";
    case "waiting":
      return "A person will join shortly";
    case "human":
      return `You're chatting with ${member?.name ?? "a person"}`;
    case "closed":
      return null;
    default: {
      const unhandled: never = conversation.state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

/** Whether the visitor's next message starts a new conversation. */
export function startsNewConversation(
  conversation: Conversation | null,
): boolean {
  if (!conversation) return true;
  switch (conversation.state) {
    case "closed":
      return true;
    case "ai":
    case "waiting":
    case "human":
      return false;
    default: {
      const unhandled: never = conversation.state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

/** PRD W-8: offered while the agent is answering or before a conversation. */
export function canRequestHuman(
  agentEnabled: boolean,
  conversation: Conversation | null,
): boolean {
  if (!agentEnabled) return false;
  if (!conversation) return true;
  switch (conversation.state) {
    case "ai":
    case "closed":
      return true;
    case "waiting":
    case "human":
      return false;
    default: {
      const unhandled: never = conversation.state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}
