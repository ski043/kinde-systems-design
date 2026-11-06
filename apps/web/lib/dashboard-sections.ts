import type { Permission } from "@marshaldesk/shared";
import { type AppRoute, routes } from "@/lib/routes";

export type DashboardSectionKey =
  "home" | "knowledge" | "inbox" | "billing" | "team";

export type DashboardSection = {
  key: DashboardSectionKey;
  title: string;
  href: AppRoute;
  /** Every one is needed to open it. Hiding is a convenience: each procedure checks again (PRD T-4, T-5). */
  permissions: readonly Permission[];
  matches: (pathname: string) => boolean;
};

/** In nav order, which is also the order a member lands in: the first one they may open. */
export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  {
    key: "home",
    title: "Home",
    href: routes.dashboard,
    // The widget page also previews the suggested questions from the knowledge base.
    permissions: ["widget:manage", "knowledge:manage"],
    matches: (pathname) => pathname === routes.dashboard,
  },
  {
    key: "knowledge",
    title: "Knowledge base",
    href: routes.knowledge,
    permissions: ["knowledge:manage"],
    matches: (pathname) => pathname === routes.knowledge,
  },
  {
    key: "inbox",
    title: "Inbox",
    href: routes.inbox,
    permissions: ["conversations:read"],
    matches: (pathname) =>
      pathname === routes.inbox || pathname.startsWith(`${routes.inbox}/`),
  },
  {
    key: "billing",
    title: "Billing",
    href: routes.billing,
    permissions: ["billing:manage"],
    matches: (pathname) => pathname === routes.billing,
  },
  {
    key: "team",
    title: "Team",
    href: routes.team,
    // Every member sees the team; changing it needs `members:manage` (PRD T-1).
    permissions: [],
    matches: (pathname) => pathname === routes.team,
  },
];

export function canOpenSection(
  section: DashboardSection,
  permissions: readonly Permission[],
): boolean {
  return section.permissions.every((permission) =>
    permissions.includes(permission),
  );
}

export function allowedSections(
  permissions: readonly Permission[],
): DashboardSection[] {
  return DASHBOARD_SECTIONS.filter((section) =>
    canOpenSection(section, permissions),
  );
}

export function sectionFor(pathname: string): DashboardSection | undefined {
  return DASHBOARD_SECTIONS.find((section) => section.matches(pathname));
}
