import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cookies } from "next/headers";
import type { CSSProperties, ReactNode } from "react";
import { DashboardAccentProvider } from "@/components/dashboard/accent-provider";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { SiteHeader } from "@/components/dashboard/site-header";
import { Providers } from "@/components/providers";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireViewer } from "@/lib/auth/viewer";
import { orpcServer } from "@/lib/orpc/server";
import { getQueryClient } from "@/lib/query/client";

/** Must match `SIDEBAR_COOKIE_NAME` in `components/ui/sidebar.tsx`. */
const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { current } = await requireViewer(["ready"]);

  const queryClient = getQueryClient();
  queryClient.setQueryData(orpcServer.member.getCurrent.queryKey(), current);
  if (current.permissions.includes("conversations:read")) {
    // The tab badge counts unread conversations on every dashboard page.
    await queryClient.prefetchQuery(orpcServer.inbox.list.queryOptions());
  }

  const defaultOpen =
    (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  return (
    <Providers>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardAccentProvider initialColor={current.workspace.accentColor}>
          <DashboardRealtime>
            <TooltipProvider>
              <SidebarProvider
                defaultOpen={defaultOpen}
                style={
                  {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--sidebar-width-icon": "calc(var(--spacing) * 13)",
                    "--header-height": "calc(var(--spacing) * 12)",
                  } as CSSProperties
                }
              >
                <AppSidebar variant="inset" />
                <SidebarInset className="isolate">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 rounded-t-xl bg-linear-to-b from-brand/[0.07] to-transparent"
                  />
                  <SiteHeader />
                  {children}
                </SidebarInset>
              </SidebarProvider>
            </TooltipProvider>
          </DashboardRealtime>
        </DashboardAccentProvider>
      </HydrationBoundary>
    </Providers>
  );
}
