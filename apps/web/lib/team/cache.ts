import type { Team } from "@marshaldesk/shared";
import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/client";

/** Every team mutation returns the whole team, which replaces the cached one. */
export function writeTeam(queryClient: QueryClient, team: Team): void {
  queryClient.setQueryData(orpc.team.list.queryKey(), team);
}
