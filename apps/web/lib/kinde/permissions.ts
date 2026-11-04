import "server-only";
import { type Permission, permissionSchema } from "@marshaldesk/shared";
import { getOrganizationUserPermissions } from "./management";

/*
 * Permission freshness (PRD T-7: role changes apply within one minute).
 *
 * The access token's `permissions` claim is a snapshot from when Kinde issued
 * it. Every role change bumps `members.access_changed_at`. If that is newer
 * than the token, the token is stale, so we ask the Management API for the
 * member's live permissions and remember the answer for 30 seconds.
 * Removing a member deletes the row, so removal needs no freshness check.
 */

const LIVE_PERMISSIONS_TTL_MS = 30 * 1000;

const livePermissions = new Map<
  string,
  { permissions: Permission[]; expiresAt: number }
>();

function knownPermissions(keys: readonly string[]): Permission[] {
  return keys.flatMap((key) => {
    const parsed = permissionSchema.safeParse(key);
    return parsed.success ? [parsed.data] : [];
  });
}

function cacheKey(orgCode: string, kindeUserId: string): string {
  return `${orgCode}:${kindeUserId}`;
}

/** Drops this server's cached answer after a change it made itself. Other instances expire within 30 seconds. */
export function forgetLivePermissions(
  orgCode: string,
  kindeUserId: string,
): void {
  livePermissions.delete(cacheKey(orgCode, kindeUserId));
}

/** The member's permissions straight from Kinde, cached for 30 seconds. */
export async function fetchLivePermissions(
  orgCode: string,
  kindeUserId: string,
): Promise<Permission[]> {
  const key = cacheKey(orgCode, kindeUserId);
  const cached = livePermissions.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.permissions;

  const permissions = knownPermissions(
    await getOrganizationUserPermissions(orgCode, kindeUserId),
  );
  livePermissions.set(key, {
    permissions,
    expiresAt: Date.now() + LIVE_PERMISSIONS_TTL_MS,
  });
  return permissions;
}

export async function effectivePermissions(input: {
  orgCode: string;
  kindeUserId: string;
  tokenPermissions: readonly string[];
  tokenIssuedAt: Date;
  accessChangedAt: { epochMilliseconds: number };
}): Promise<Permission[]> {
  const tokenIsStale =
    input.accessChangedAt.epochMilliseconds > input.tokenIssuedAt.getTime();
  return tokenIsStale
    ? fetchLivePermissions(input.orgCode, input.kindeUserId)
    : knownPermissions(input.tokenPermissions);
}
