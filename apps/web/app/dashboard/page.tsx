import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  matchQuery,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { WidgetSettingsScreen } from "@/components/widget-settings/widget-settings-screen";
import { requireSection } from "@/lib/auth/require-section";
import { orpcServer } from "@/lib/orpc/server";
import { getQueryClient } from "@/lib/query/client";

export const metadata: Metadata = {
  title: "Home · MarshalDesk",
};

export default async function DashboardHomePage() {
  await requireSection("home");
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(orpcServer.knowledge.get.queryOptions()),
    queryClient.prefetchQuery(orpcServer.widgetSettings.get.queryOptions()),
  ]);
  const knowledgeKey = orpcServer.knowledge.key();
  const widgetSettingsKey = orpcServer.widgetSettings.key();

  return (
    // The layout already dehydrates the shared queries.
    <HydrationBoundary
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) &&
          (matchQuery({ queryKey: knowledgeKey }, query) ||
            matchQuery({ queryKey: widgetSettingsKey }, query)),
      })}
    >
      <WidgetSettingsScreen />
    </HydrationBoundary>
  );
}
