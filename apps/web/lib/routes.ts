export const routes = {
  home: "/",
  welcome: "/auth/welcome",
  dashboard: "/dashboard",
  knowledge: "/dashboard/knowledge",
  inbox: "/dashboard/inbox",
  team: "/dashboard/team",
  billing: "/dashboard/billing",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

/** The inbox, optionally with a conversation open and a state filter applied. */
export function inboxRoute({
  conversationId,
  state,
}: { conversationId?: string; state?: string } = {}): string {
  const path = conversationId
    ? `${routes.inbox}/${encodeURIComponent(conversationId)}`
    : routes.inbox;
  return state ? `${path}?${new URLSearchParams({ state })}` : path;
}
