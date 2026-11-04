import "server-only";
import type { CurrentMembership } from "@marshaldesk/shared";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import {
  allowedSections,
  canOpenSection,
  DASHBOARD_SECTIONS,
  type DashboardSectionKey,
} from "@/lib/dashboard-sections";

/**
 * Opens a dashboard section only for members with its permissions, and sends
 * everyone else to the first section they can use. Team needs none, so there
 * always is one.
 */
export async function requireSection(
  key: DashboardSectionKey,
): Promise<CurrentMembership> {
  const { current } = await requireViewer(["ready"]);
  const section = DASHBOARD_SECTIONS.find((candidate) => candidate.key === key);
  if (!section) throw new Error(`Unknown dashboard section: ${key}`);
  if (!canOpenSection(section, current.permissions)) {
    const [landing] = allowedSections(current.permissions);
    if (!landing) throw new Error("A member can always open the team page");
    redirect(landing.href);
  }
  return current;
}
