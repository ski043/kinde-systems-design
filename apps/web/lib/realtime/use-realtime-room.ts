"use client";

import {
  type ClientMessage,
  clientMessageSchema,
  REALTIME_REVOKED_CLOSE_CODE,
  type RealtimeParty,
} from "@marshaldesk/shared";
import { PartySocket } from "partysocket";
import { usePartySocket } from "partysocket/react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type * as z from "zod";

/** Without a host, real time is off and the inbox and widget fall back to polling. */
export const REALTIME_HOST = process.env.NEXT_PUBLIC_REALTIME_HOST || null;
export const realtimeEnabled = REALTIME_HOST !== null;

export type RealtimeStatus =
  "disabled" | "connecting" | "open" | "reconnecting" | "offline";

export type RealtimeRoom = {
  status: RealtimeStatus;
  /** Drops the message unless the socket is open: typing is only worth sending live. */
  send: (message: ClientMessage) => void;
};

type Phase = "connecting" | "open" | "reconnecting";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function parseEvent<Event>(
  data: unknown,
  schema: z.ZodType<Event>,
): Event | null {
  if (typeof data !== "string") return null;
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Whether an event came from the socket of `room`, not one being replaced. */
function fromRoom(event: globalThis.Event, room: string | null | undefined) {
  return (
    Boolean(room) &&
    event.target instanceof PartySocket &&
    event.target.room === room
  );
}

/**
 * One socket to a PartyServer room. The token is fetched on every (re)connect
 * because it only lives for a minute. Postgres stays the source of truth:
 * `onOpen` runs on every open, including the first, and is where callers
 * refetch whatever was published before the socket was listening.
 */
export function useRealtimeRoom<Event>({
  party,
  room,
  getToken,
  schema,
  onEvent,
  onOpen,
}: {
  party: RealtimeParty;
  room: string | null | undefined;
  getToken: () => Promise<string>;
  schema: z.ZodType<Event>;
  onEvent: (event: Event) => void;
  onOpen?: () => void;
}): RealtimeRoom {
  const enabled = REALTIME_HOST !== null && Boolean(room);
  const online = useOnline();
  const [connection, setConnection] = useState<{
    room: string | null;
    phase: Phase;
  }>({ room: null, phase: "connecting" });
  // Leaving a room closes its socket after `room` is already gone, so that
  // close is never recorded; reset here so a return to it starts as connecting.
  const [trackedRoom, setTrackedRoom] = useState(room);
  if (room !== trackedRoom) {
    setTrackedRoom(room);
    setConnection({ room: null, phase: "connecting" });
  }
  const getTokenRef = useRef(getToken);
  useLayoutEffect(() => {
    getTokenRef.current = getToken;
  });

  const socket = usePartySocket({
    host: REALTIME_HOST ?? undefined,
    party,
    room: room || "none",
    enabled,
    minReconnectionDelay: 1_000,
    maxReconnectionDelay: 10_000,
    query: async () => ({ token: await getTokenRef.current() }),
    // A room switch closes the old socket while these handlers already see
    // the new room, so events are matched to the socket's own room.
    onOpen(event) {
      if (!room || !fromRoom(event, room)) return;
      setConnection({ room, phase: "open" });
      onOpen?.();
    },
    onClose(event) {
      if (!room || !fromRoom(event, room)) return;
      if (event.code === REALTIME_REVOKED_CLOSE_CODE) {
        // Removed, or lost `conversations:read`: the server decides where to go now.
        window.location.reload();
        return;
      }
      setConnection({ room, phase: "reconnecting" });
    },
    onMessage(message) {
      if (!fromRoom(message, room)) return;
      const event = parseEvent(message.data, schema);
      if (event) onEvent(event);
    },
  });

  const send = useCallback(
    (message: ClientMessage) => {
      const parsed = clientMessageSchema.safeParse(message);
      if (!parsed.success || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify(parsed.data));
    },
    [socket],
  );

  let status: RealtimeStatus;
  if (!enabled) {
    status = "disabled";
  } else if (!online) {
    status = "offline";
  } else if (connection.room !== room) {
    status = "connecting";
  } else {
    status = connection.phase;
  }

  return { status, send };
}
