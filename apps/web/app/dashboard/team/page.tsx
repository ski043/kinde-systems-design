import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  matchQuery,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { TeamScreen } from "@/components/team/team-screen";
import { requireSection } from "@/lib/auth/require-section";
import { orpcServer } from "@/lib/orpc/server";
import { getQueryClient } from "@/lib/query/client";

export const metadata: Metadata = {
  title: "Team · MarshalDesk",
};

export default async function TeamPage() {
  await requireSection("team");
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(orpcServer.team.list.queryOptions());
  const teamKey = orpcServer.team.key();

  return (
    // The layout already dehydrates the shared queries.
    <HydrationBoundary
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) &&
          matchQuery({ queryKey: teamKey }, query),
      })}
    >
      <TeamScreen />
    </HydrationBoundary>
  );
}
