import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  matchQuery,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { KnowledgeScreen } from "@/components/knowledge/knowledge-screen";
import { requireSection } from "@/lib/auth/require-section";
import { orpcServer } from "@/lib/orpc/server";
import { getQueryClient } from "@/lib/query/client";

export const metadata: Metadata = {
  title: "Knowledge base · MarshalDesk",
};

export default async function KnowledgePage() {
  await requireSection("knowledge");
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(orpcServer.knowledge.get.queryOptions());
  const knowledgeKey = orpcServer.knowledge.key();

  return (
    // The layout already dehydrates the shared queries.
    <HydrationBoundary
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) &&
          matchQuery({ queryKey: knowledgeKey }, query),
      })}
    >
      <KnowledgeScreen />
    </HydrationBoundary>
  );
}
