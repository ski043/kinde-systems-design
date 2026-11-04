import "server-only";
import { findMembershipByKindeUserId } from "@marshaldesk/db";
import type { CurrentMembership } from "@marshaldesk/shared";
import { isDefinedError, safe } from "@orpc/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getKindeSession } from "@/lib/kinde/session";
import { kindeRoutes, signInToOrganizationUrl } from "@/lib/kinde/urls";
import { serverClient } from "@/lib/orpc/server";
import { routes } from "@/lib/routes";

export type Viewer =
  | { status: "signed-out" }
  /**
   * Has a workspace, but the session's organization is another one (such as
   * Kinde's default organization), or they just joined through an invitation.
   */
  | { status: "wrong-workspace"; signInUrl: string }
  | { status: "needs-workspace" }
  | { status: "ready"; current: CurrentMembership };

export type ViewerStatus = Viewer["status"];

async function viewerWithoutWorkspace(): Promise<Viewer> {
  const session = await getKindeSession();
  if (!session) return { status: "signed-out" };
  const membership = await findMembershipByKindeUserId(session.kindeUserId);
  if (membership) {
    return {
      status: "wrong-workspace",
      signInUrl: signInToOrganizationUrl(membership.workspace.kindeOrgCode),
    };
  }

  const [error, joined] = await safe(serverClient.workspace.acceptInvitation());
  if (!error) {
    return { status: "wrong-workspace", signInUrl: joined.continueUrl };
  }
  if (isDefinedError(error) && error.code === "NOT_FOUND") {
    return { status: "needs-workspace" };
  }
  throw error;
}

/**
 * Resolves who is looking at the page, once per request, through
 * `member.getCurrent`. A person without a workspace whose verified email has a
 * pending invitation joins that workspace here.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const [error, current] = await safe(serverClient.member.getCurrent());
  if (!error) {
    return { status: "ready", current };
  }
  if (!isDefinedError(error)) {
    throw error;
  }

  switch (error.code) {
    case "UNAUTHORIZED":
      return { status: "signed-out" };
    case "WORKSPACE_REQUIRED":
      return viewerWithoutWorkspace();
    default: {
      const unhandled: never = error;
      throw new Error(`Unhandled viewer error: ${JSON.stringify(unhandled)}`);
    }
  }
});

function destinationFor(viewer: Viewer): string {
  switch (viewer.status) {
    case "signed-out":
      return kindeRoutes.login;
    case "wrong-workspace":
      return viewer.signInUrl;
    case "needs-workspace":
      return routes.welcome;
    case "ready":
      return routes.dashboard;
    default: {
      const unhandled: never = viewer;
      throw new Error(`Unhandled viewer: ${JSON.stringify(unhandled)}`);
    }
  }
}

/** Redirects to the right place unless the viewer is in one of the allowed states. */
export async function requireViewer<const S extends ViewerStatus>(
  allowed: readonly S[],
): Promise<Extract<Viewer, { status: S }>> {
  const viewer = await getViewer();
  if (!isAllowed(viewer, allowed)) {
    redirect(destinationFor(viewer));
  }
  return viewer;
}

function isAllowed<S extends ViewerStatus>(
  viewer: Viewer,
  allowed: readonly S[],
): viewer is Extract<Viewer, { status: S }> {
  return (allowed as readonly ViewerStatus[]).includes(viewer.status);
}
