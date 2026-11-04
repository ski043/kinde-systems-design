import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  matchQuery,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { BillingScreen } from "@/components/billing/billing-screen";
import { requireSection } from "@/lib/auth/require-section";
import { orpcServer } from "@/lib/orpc/server";
import { getQueryClient } from "@/lib/query/client";

export const metadata: Metadata = {
  title: "Billing · MarshalDesk",
};

export default async function BillingPage() {
  await requireSection("billing");
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(orpcServer.billing.get.queryOptions());
  const billingKey = orpcServer.billing.key();

  return (
    // The layout already dehydrates the shared queries.
    <HydrationBoundary
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) &&
          matchQuery({ queryKey: billingKey }, query),
      })}
    >
      <BillingScreen />
    </HydrationBoundary>
  );
}
