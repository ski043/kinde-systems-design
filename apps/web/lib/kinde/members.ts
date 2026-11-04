import "server-only";
import type { AssignableRole } from "@marshaldesk/shared";
import {
  addOrganizationUser,
  addOrganizationUserRole,
  getOrganizationUserRoles,
  getRoles,
  getUserOrganizationCodes,
  KindeManagementError,
  removeOrganizationUser,
  removeOrganizationUserRole,
} from "./management";
import { forgetLivePermissions } from "./permissions";

/** The role key isn't defined in Kinde, like `billing-admin` before the Pro upgrade. */
export class RoleNotInKindeError extends Error {
  constructor(readonly role: AssignableRole) {
    super(`Kinde has no role with the key "${role}"`);
    this.name = "RoleNotInKindeError";
  }
}

async function roleIdFor(role: AssignableRole): Promise<string> {
  const match = (await getRoles()).find((candidate) => candidate.key === role);
  if (!match) throw new RoleNotInKindeError(role);
  return match.id;
}

/** Throws `RoleNotInKindeError` unless the role can be assigned. */
export async function assertRoleExists(role: AssignableRole): Promise<void> {
  await roleIdFor(role);
}

async function isOrganizationMember(
  orgCode: string,
  kindeUserId: string,
): Promise<boolean> {
  return (await getUserOrganizationCodes(kindeUserId)).includes(orgCode);
}

/**
 * Leaves the user with exactly `role` in the organization. Old roles go first,
 * so a failure halfway leaves fewer permissions, not more. Safe to retry.
 */
export async function setOrganizationRole(
  orgCode: string,
  kindeUserId: string,
  role: AssignableRole,
): Promise<void> {
  const roleId = await roleIdFor(role);
  const current = await getOrganizationUserRoles(orgCode, kindeUserId);
  for (const assigned of current) {
    if (assigned.id !== roleId) {
      await removeOrganizationUserRole(orgCode, kindeUserId, assigned.id);
    }
  }
  if (!current.some((assigned) => assigned.id === roleId)) {
    await addOrganizationUserRole(orgCode, kindeUserId, roleId);
  }
  forgetLivePermissions(orgCode, kindeUserId);
}

/**
 * Adds the user to the organization with exactly `role`. Safe to retry: an
 * existing membership is kept, and roles left from an earlier one are replaced.
 */
export async function joinOrganization(
  orgCode: string,
  kindeUserId: string,
  role: AssignableRole,
): Promise<void> {
  await assertRoleExists(role);
  try {
    await addOrganizationUser(orgCode, kindeUserId, role);
  } catch (error) {
    const alreadyMember =
      error instanceof KindeManagementError &&
      (await isOrganizationMember(orgCode, kindeUserId));
    if (!alreadyMember) throw error;
  }
  await setOrganizationRole(orgCode, kindeUserId, role);
}

/** Removes the user from the organization. Safe to retry once they're gone. */
export async function leaveOrganization(
  orgCode: string,
  kindeUserId: string,
): Promise<void> {
  try {
    await removeOrganizationUser(orgCode, kindeUserId);
  } catch (error) {
    const alreadyGone =
      error instanceof KindeManagementError &&
      !(await isOrganizationMember(orgCode, kindeUserId));
    if (!alreadyGone) throw error;
  }
  forgetLivePermissions(orgCode, kindeUserId);
}
