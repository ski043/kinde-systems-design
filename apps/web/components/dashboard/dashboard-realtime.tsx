"use client";

import {
  type ConversationState,
  type ConversationSummary,
  type Message,
  REALTIME_PARTIES,
  type WorkspaceEvent,
  workspaceEventSchema,
} from "@marshaldesk/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
} from "react";
import {
  appendMessage,
  conversationListOptions,
  inboxKey,
  receiveSummary,
} from "@/lib/inbox/cache";
import { visitorLabel } from "@/lib/inbox/format";
import {
  knowledgeKey,
  receiveKnowledgeState,
  receiveSource,
  removeSource,
} from "@/lib/knowledge/cache";
import { client, orpc } from "@/lib/orpc/client";
import { showNotification } from "@/lib/realtime/notifications";
import {
  playNotificationSound,
  unlockSoundOnGesture,
} from "@/lib/realtime/sound";
import { useTitleBadge } from "@/lib/realtime/title-badge";
import {
  type RealtimeStatus,
  realtimeEnabled,
  useRealtimeRoom,
} from "@/lib/realtime/use-realtime-room";
import { inboxRoute } from "@/lib/routes";

const WorkspaceStatusContext = createContext<RealtimeStatus>("disabled");

/** The dashboard's workspace connection, for showing when it's reconnecting. */
export function useWorkspaceRealtimeStatus(): RealtimeStatus {
  return useContext(WorkspaceStatusContext);
}

/** PRD D-6: only conversations waiting for or handled by a person notify. */
function notifiesOwner(state: ConversationState): boolean {
  switch (state) {
    case "waiting":
    case "human":
      return true;
    case "ai":
    case "closed":
      return false;
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

function notificationBody(message: Message): string {
  const body = message.author === "system" ? "" : message.body;
  return body.length > 140 ? `${body.slice(0, 139)}…` : body;
}

/**
 * Mounted once for the whole dashboard: keeps the inbox cache live from the
 * workspace room, badges the tab and notifies about visitor messages.
 */
export function DashboardRealtime({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const openId = params.conversationId;
  const current = useQuery(orpc.member.getCurrent.queryOptions()).data;
  // Only members who can read conversations get a workspace room and a badge.
  const readsConversations =
    current?.permissions.includes("conversations:read") ?? false;
  const workspaceId = readsConversations ? current?.workspace.id : undefined;
  const conversations = useQuery({
    ...conversationListOptions(queryClient, {
      refetchInterval: realtimeEnabled ? false : 10_000,
    }),
    enabled: readsConversations,
  }).data?.conversations;

  const unread =
    conversations?.filter(
      (conversation) =>
        conversation.unread && notifiesOwner(conversation.state),
    ).length ?? 0;
  useTitleBadge(unread);

  useEffect(() => {
    unlockSoundOnGesture();
  }, []);

  const getToken = useCallback(async () => {
    const { token } = await client.realtime.getToken({});
    return token;
  }, []);

  function notify(summary: ConversationSummary, message: Message) {
    if (!notifiesOwner(summary.state)) return;
    const hidden = document.visibilityState !== "visible";
    if (hidden || openId !== summary.id) playNotificationSound();
    if (!hidden) return;
    showNotification({
      title: `New message from ${visitorLabel(summary.visitor)}`,
      body: notificationBody(message),
      tag: summary.id,
      onClick: () => router.push(inboxRoute({ conversationId: summary.id })),
    });
  }

  function onEvent(event: WorkspaceEvent) {
    switch (event.type) {
      case "conversation.upserted":
        receiveSummary(queryClient, event.summary);
        return;
      case "visitor.message":
        appendMessage(queryClient, event.message);
        receiveSummary(queryClient, event.summary);
        notify(event.summary, event.message);
        return;
      case "source.updated":
        receiveSource(queryClient, event.source);
        return;
      case "source.deleted":
        removeSource(queryClient, event.sourceId);
        return;
      case "knowledge.updated":
        receiveKnowledgeState(queryClient, {
          suggestedQuestions: event.suggestedQuestions,
          hasKnowledge: event.hasKnowledge,
        });
        return;
      default: {
        const unhandled: never = event;
        throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
      }
    }
  }

  const { status } = useRealtimeRoom({
    party: REALTIME_PARTIES.workspace,
    room: workspaceId,
    getToken,
    schema: workspaceEventSchema,
    onEvent,
    onOpen: () => {
      void queryClient.invalidateQueries({ queryKey: inboxKey() });
      void queryClient.invalidateQueries({ queryKey: knowledgeKey() });
    },
  });

  return (
    <WorkspaceStatusContext value={status}>{children}</WorkspaceStatusContext>
  );
}
