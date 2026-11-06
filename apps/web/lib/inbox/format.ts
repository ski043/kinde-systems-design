import type {
  ConversationState,
  HandoffReason,
  SystemEvent,
  Visitor,
  VisitorDetails,
} from "@marshaldesk/shared";
import type { InboxFilter } from "@/lib/inbox/filter";

const LOCALE = "en";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function stateLabel(state: ConversationState): string {
  switch (state) {
    case "ai":
      return "Agent";
    case "waiting":
      return "Waiting";
    case "human":
      return "You";
    case "closed":
      return "Closed";
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

/** A line under the state badge, or `null` when the badge says it all. */
export function stateDescription(state: ConversationState): string | null {
  switch (state) {
    case "ai":
      return "The agent is replying";
    case "waiting":
      return "Waiting for you to take over";
    case "human":
      return "You're replying";
    case "closed":
      return null;
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

/** Shown when an action lost a race with the server, e.g. the conversation closed meanwhile. */
export function conflictMessage(state: ConversationState): string {
  switch (state) {
    case "ai":
      return "This conversation changed. The agent is replying now.";
    case "waiting":
      return "This conversation changed. It's now waiting for you.";
    case "human":
      return "This conversation changed. You're already replying.";
    case "closed":
      return "This conversation changed. It's now closed.";
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled state: ${String(unhandled)}`);
    }
  }
}

export function filterLabel(filter: InboxFilter): string {
  return filter === "open" ? "All open" : stateLabel(filter);
}

export function handoffReasonLabel(reason: HandoffReason): string {
  switch (reason) {
    case "low_confidence":
      return "The agent wasn't sure of the answer";
    case "no_relevant_knowledge":
      return "The knowledge base doesn't cover this";
    case "visitor_requested":
      return "The visitor asked for a person";
    case "agent_off":
      return "The agent is off";
    case "ai_reply_limit":
      return "The plan's AI replies for this billing cycle are used up";
    default: {
      const unhandled: never = reason;
      throw new Error(`Unhandled handoff reason: ${String(unhandled)}`);
    }
  }
}

/** Plain-words text for the centered event line in the conversation. */
export function systemEventLabel(event: SystemEvent): string | null {
  switch (event.kind) {
    case "greeting":
      return null;
    case "handoff":
      return event.reason === "agent_off"
        ? "Waiting for you: the agent is off"
        : `Handed to you: ${lowerFirst(handoffReasonLabel(event.reason))}`;
    case "taken_over":
      return "You took over";
    case "handed_back":
      return "Handed back to the agent";
    case "closed":
      return event.by === "member"
        ? "Conversation closed"
        : "Closed after 24 hours without messages";
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
    }
  }
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

const regionNames = new Intl.DisplayNames([LOCALE], { type: "region" });
const languageNames = new Intl.DisplayNames([LOCALE], { type: "language" });

// Codes come from request headers and the visitor's browser, so a malformed
// one must not throw during render.
function displayName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryName(countryCode: string): string {
  return displayName(regionNames, countryCode);
}

export function languageName(language: string): string {
  return displayName(languageNames, language);
}

/** City and country when known. Both are empty locally, without location headers. */
export function locationLabel(details: VisitorDetails): string {
  const country = details.countryCode ? countryName(details.countryCode) : null;
  if (details.city && country) return `${details.city}, ${country}`;
  return details.city ?? country ?? "Unknown location";
}

/** Visitors are anonymous, so they're named after where they are. */
export function visitorLabel(visitor: Visitor): string {
  const { city, countryCode } = visitor.details;
  const place = city ?? (countryCode ? countryName(countryCode) : null);
  return place ? `Visitor from ${place}` : `Visitor ${visitor.id.slice(-4)}`;
}

export function deviceLabel(device: VisitorDetails["device"]): string {
  switch (device) {
    case "desktop":
      return "Desktop";
    case "mobile":
      return "Phone";
    case "tablet":
      return "Tablet";
    default: {
      const unhandled: never = device;
      throw new Error(`Unhandled device: ${String(unhandled)}`);
    }
  }
}

/** A URL without its protocol, for compact display. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Plain text for one-line previews of markdown the agent or a member wrote. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const shortDate = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
});

/** Compact age for list rows: "now", "5m", "3h", "2d", then a date. */
export function compactAge(iso: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  return shortDate.format(new Date(iso));
}

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export function relativeTime(iso: string, now: number): string {
  const elapsed = Date.parse(iso) - now;
  const abs = Math.abs(elapsed);
  if (abs < MINUTE) return "just now";
  if (abs < HOUR)
    return relativeFormat.format(Math.round(elapsed / MINUTE), "minute");
  if (abs < DAY)
    return relativeFormat.format(Math.round(elapsed / HOUR), "hour");
  if (abs < 30 * DAY)
    return relativeFormat.format(Math.round(elapsed / DAY), "day");
  return relativeFormat.format(Math.round(elapsed / (30 * DAY)), "month");
}

/** Wall-clock time in the viewer's own time zone. Render only after hydration. */
export function clockTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Full date and time in the viewer's own time zone. Render only after hydration. */
export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** The visitor's local time, or `null` without a valid time zone. Stable across server and client because the zone is explicit. */
export function visitorLocalTime(
  timezone: string | null,
  now: number,
): string | null {
  if (!timezone) return null;
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date(now));
  } catch {
    return null;
  }
}
