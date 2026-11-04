import "server-only";
import {
  createWorkspaceWithOwner,
  findMembershipByKindeUserId,
  getWorkspace,
  withAdvisoryLock,
  type Membership,
} from "@marshaldesk/db";
import * as z from "zod";
import {
  addOrganizationUser,
  createBilledOrganization,
  getOrganization,
  getUserOrganizationCodes,
} from "./management";
import type { KindeSession } from "./session";

const OWNER_ROLE_KEY = "owner";

type Organization = {
  orgCode: string;
  workspaceId: string;
  billingCustomerId: string | null;
};

/**
 * An organization a previous attempt created and joined before it could write
 * the rows: the person is in it, it isn't the default organization, and its
 * external id names a workspace that doesn't exist yet.
 */
async function findUnfinishedOrganization(
  kindeUserId: string,
): Promise<Organization | null> {
  for (const orgCode of await getUserOrganizationCodes(kindeUserId)) {
    const organization = await getOrganization(orgCode);
    const workspaceId = z.uuid().safeParse(organization.externalId);
    if (organization.isDefault || !workspaceId.success) continue;
    if (await getWorkspace(workspaceId.data)) continue;
    return {
      orgCode,
      workspaceId: workspaceId.data,
      billingCustomerId: organization.billingCustomerId,
    };
  }
  return null;
}

async function createOwnedOrganization(
  session: KindeSession,
  name: string,
): Promise<Organization> {
  const workspaceId = crypto.randomUUID();
  const organization = await createBilledOrganization({
    name,
    externalId: workspaceId,
    billingEmail: session.email,
  });
  await addOrganizationUser(
    organization.code,
    session.kindeUserId,
    OWNER_ROLE_KEY,
  );
  return {
    orgCode: organization.code,
    workspaceId,
    billingCustomerId: organization.billingCustomerId,
  };
}

/**
 * First run: links a new Kinde organization, which is also a billing customer
 * on the default plan, to a new workspace with the person as owner. Safe to
 * retry. Attempts for one person run one at a time under a database lock, so
 * a concurrent attempt never creates a second organization: Kinde can't
 * delete one once it has a billing agreement. An existing membership is
 * returned as is, and an organization left behind by an interrupted attempt
 * is picked up again.
 */
export async function provisionWorkspace(
  session: KindeSession,
  name: string,
): Promise<Membership> {
  const existing = await findMembershipByKindeUserId(session.kindeUserId);
  if (existing) return existing;

  return withAdvisoryLock("provisioning", session.kindeUserId, async () => {
    const winner = await findMembershipByKindeUserId(session.kindeUserId);
    if (winner) return winner;

    const organization =
      (await findUnfinishedOrganization(session.kindeUserId)) ??
      (await createOwnedOrganization(session, name));

    return createWorkspaceWithOwner({
      workspaceId: organization.workspaceId,
      kindeOrgCode: organization.orgCode,
      kindeBillingCustomerId: organization.billingCustomerId,
      workspaceName: name,
      kindeUserId: session.kindeUserId,
      email: session.email,
      ownerName: session.name,
      avatarUrl: session.picture,
    });
  });
}
