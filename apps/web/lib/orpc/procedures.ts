import "server-only";
import { findMembership, getWidgetAllowedDomains } from "@marshaldesk/db";
import {
  contract,
  DomainNotAllowedError,
  type Permission,
  PermissionDeniedError,
  PlanRequiredError,
  UnauthorizedError,
  VisitorUnauthorizedError,
  WorkspaceRequiredError,
} from "@marshaldesk/shared";
import { implement } from "@orpc/server";
import {
  checkEntitlement,
  type EntitledFeature,
} from "@/lib/billing/entitlements";
import { effectivePermissions } from "@/lib/kinde/permissions";
import { getKindeSession } from "@/lib/kinde/session";
import {
  bearerToken,
  isHostAllowed,
  resolveVisitorToken,
} from "@/lib/visitor/session";

export type BaseContext = { headers: Headers };

export const base = implement(contract).$context<BaseContext>();

/** 1. Authentication: a verified Kinde session. The person may not have a workspace yet. */
export const authenticatedProcedure = base.use(async ({ next }) => {
  const session = await getKindeSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return next({ context: { session } });
});

/**
 * 2. Membership: the session's organization is a workspace and the person is
 * its member. `workspaceId` only ever comes from here. `permissions` are the
 * effective ones, refreshed from Kinde when the token predates a role change.
 */
export const memberProcedure = authenticatedProcedure.use(
  async ({ context, next }) => {
    const { orgCode, kindeUserId } = context.session;
    const membership = orgCode
      ? await findMembership(orgCode, kindeUserId)
      : null;
    if (!orgCode || !membership) {
      throw new WorkspaceRequiredError();
    }
    const permissions = await effectivePermissions({
      orgCode,
      kindeUserId,
      tokenPermissions: context.session.permissions,
      tokenIssuedAt: context.session.tokenIssuedAt,
      accessChangedAt: membership.member.accessChangedAt,
    });
    return next({
      context: {
        member: membership.member,
        workspaceId: membership.workspace.id,
        kindeOrgCode: membership.workspace.kindeOrgCode,
        permissions,
      },
    });
  },
);

/** 3. Authorization: the member holds `permission`. Use after `memberProcedure`. */
export function requirePermission(permission: Permission) {
  return base
    .$context<BaseContext & { permissions: readonly Permission[] }>()
    .middleware(async ({ context, next }) => {
      if (!context.permissions.includes(permission)) {
        throw new PermissionDeniedError({ data: { permission } });
      }
      return next();
    });
}

/**
 * 4. Entitlement: the workspace's plan in Kinde Billing includes `feature`.
 * Use after `requirePermission`.
 */
export function requireEntitlement(feature: EntitledFeature) {
  return base
    .$context<BaseContext & { workspaceId: string }>()
    .middleware(async ({ context, next }) => {
      const entitlement = await checkEntitlement(context.workspaceId, feature);
      switch (entitlement.kind) {
        case "not_included":
          throw new PlanRequiredError();
        case "included":
          return next();
        default: {
          const unhandled: never = entitlement;
          throw new Error(`Unhandled entitlement: ${String(unhandled)}`);
        }
      }
    });
}

/**
 * A widget visitor, from the `Authorization: Bearer` visitor token. `workspaceId`
 * only ever comes from the token, and removing the token's host from the
 * allowed domains cuts it off.
 */
export const visitorProcedure = base.use(async ({ context, next }) => {
  const token = bearerToken(context.headers);
  const session = token ? await resolveVisitorToken(token) : null;
  if (!session) {
    throw new VisitorUnauthorizedError();
  }
  const { workspaceId, host } = session.claims;
  const allowedDomains = await getWidgetAllowedDomains(workspaceId);
  if (!allowedDomains) {
    throw new VisitorUnauthorizedError();
  }
  if (!isHostAllowed(host, allowedDomains)) {
    throw new DomainNotAllowedError();
  }
  return next({
    context: { workspaceId, host, visitor: { id: session.visitor.id } },
  });
});
