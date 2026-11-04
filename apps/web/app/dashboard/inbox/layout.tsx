import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Inbox } from "@/components/inbox/inbox";
import {
  INBOX_LAYOUT_COOKIE,
  parseInboxLayout,
} from "@/lib/inbox/layout-cookie";
import { requireSection } from "@/lib/auth/require-section";
import { orpcServer } from "@/lib/orpc/server";
import { getQueryClient } from "@/lib/query/client";

function requestTime(): number {
  return Date.now();
}

export default async function InboxLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSection("inbox");
  const cookieStore = await cookies();
  const defaultLayout = parseInboxLayout(
    cookieStore.get(INBOX_LAYOUT_COOKIE)?.value,
  );
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(orpcServer.inbox.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-[calc(100svh-var(--header-height))] min-h-0 overflow-hidden md:h-[calc(100svh-var(--header-height)-1rem)]">
        {/* Before the inbox, so the conversation the page prefetched hydrates before the inbox asks for it. */}
        {children}
        <Inbox initialNow={requestTime()} defaultLayout={defaultLayout} />
      </div>
    </HydrationBoundary>
  );
}
