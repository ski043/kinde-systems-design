"use client";

import {
  type ConversationEvent,
  conversationEventSchema,
  type Message,
  REALTIME_PARTIES,
  type WidgetThread,
} from "@marshaldesk/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAgentStream } from "@/lib/realtime/agent-stream";
import {
  pageInBackground,
  playNotificationSound,
  unlockSoundOnGesture,
} from "@/lib/realtime/sound";
import { useRemoteTyping, useTypingSignal } from "@/lib/realtime/typing";
import { useRealtimeRoom } from "@/lib/realtime/use-realtime-room";
import { appendToThread, newerConversation } from "@/lib/widget/thread";
import { visitorOrpc } from "@/lib/widget/visitor-client";

export const threadKey = visitorOrpc.widget.getThread.queryKey();

/**
 * The visitor's conversation room. Owner replies and state changes go
 * straight into the thread cache; every open catches up with `onOpen`.
 */
export function useVisitorRoom({
  conversationId,
  getToken,
  onVisitorMessage,
  onOpen,
}: {
  conversationId: string | undefined;
  getToken: () => Promise<string>;
  /** The saved copy of a message the visitor sent, to retire its optimistic bubble. */
  onVisitorMessage: (message: Extract<Message, { author: "visitor" }>) => void;
  onOpen: () => void;
}) {
  const queryClient = useQueryClient();
  const owner = useRemoteTyping(conversationId);
  const agent = useAgentStream(conversationId, {
    onOrphanDone: () =>
      void queryClient.invalidateQueries({ queryKey: threadKey }),
  });

  useEffect(() => {
    unlockSoundOnGesture();
  }, []);

  function onEvent(event: ConversationEvent) {
    switch (event.type) {
      case "message.created": {
        const { message } = event;
        queryClient.setQueryData<WidgetThread>(threadKey, (thread) =>
          appendToThread(thread, message),
        );
        agent.receive(event);
        if (message.author === "visitor") onVisitorMessage(message);
        if (message.author === "member") {
          owner.receive(false);
          if (pageInBackground()) playNotificationSound();
        }
        return;
      }
      case "conversation.updated":
        queryClient.setQueryData<WidgetThread>(threadKey, (thread) =>
          thread && thread.conversation?.id === event.conversation.id
            ? {
                ...thread,
                conversation: newerConversation(
                  thread.conversation,
                  event.conversation,
                ),
              }
            : thread,
        );
        if (event.conversation.id === conversationId) {
          agent.receiveState(event.conversation.state);
        }
        return;
      case "typing":
        if (event.role === "member") owner.receive(event.typing);
        return;
      case "agent.chunk":
      case "agent.done":
        agent.receive(event);
        return;
      default: {
        const unhandled: never = event;
        throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
      }
    }
  }

  const room = useRealtimeRoom({
    party: REALTIME_PARTIES.conversation,
    room: conversationId,
    getToken,
    schema: conversationEventSchema,
    onEvent,
    onOpen: () => {
      agent.clear();
      onOpen();
    },
  });

  const setTyping = useTypingSignal(room.send);

  return {
    status: room.status,
    ownerTyping: owner.typing,
    agentPartial: agent.partial,
    setTyping,
  };
}
