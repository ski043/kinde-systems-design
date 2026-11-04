import "server-only";
import {
  REALTIME_PARTIES,
  REALTIME_PUBLISH_PATH_PREFIX,
  type ConversationEvent,
  type WorkspaceEvent,
  type WorkspacePublication,
} from "@marshaldesk/shared";

const PUBLISH_TIMEOUT_MS = 2000;

export type Publication =
  | { party: "conversation"; room: string; event: ConversationEvent }
  | { party: "workspace"; room: string; event: WorkspacePublication };

/** Delivers one event. Never throws: the write it follows has already been saved. */
async function publish(publication: Publication): Promise<boolean> {
  const baseUrl = process.env["REALTIME_URL"];
  const secret = process.env["REALTIME_PUBLISH_SECRET"];
  if (!baseUrl || !secret) return false;

  const { party, room, event } = publication;
  const url = `${baseUrl.replace(/\/$/, "")}/${REALTIME_PUBLISH_PATH_PREFIX}/${REALTIME_PARTIES[party]}/${encodeURIComponent(room)}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
    if (response.ok) return true;
    console.error(
      `Real-time publish of ${event.type} to ${party}/${room} failed with ${response.status}`,
    );
  } catch (error) {
    console.error(
      `Real-time publish of ${event.type} to ${party}/${room} failed:`,
      error instanceof Error ? error.message : error,
    );
  }
  return false;
}

export function publishConversationEvent(
  conversationId: string,
  event: ConversationEvent,
): Promise<boolean> {
  return publish({ party: "conversation", room: conversationId, event });
}

export function publishWorkspaceEvent(
  workspaceId: string,
  event: WorkspaceEvent,
): Promise<boolean> {
  return publish({ party: "workspace", room: workspaceId, event });
}

/** Tells the Worker to close the member's sockets in every room (PRD T-7). */
export function publishMemberRevoked(
  workspaceId: string,
  memberId: string,
): Promise<boolean> {
  return publish({
    party: "workspace",
    room: workspaceId,
    event: { type: "member.revoked", memberId },
  });
}

/**
 * Publishes one at a time so clients see events in order. After a failure the
 * rest are skipped, so an unreachable server costs one timeout, not one per event.
 */
export async function publishInOrder(
  publications: readonly Publication[],
): Promise<void> {
  for (const publication of publications) {
    if (!(await publish(publication))) return;
  }
}
