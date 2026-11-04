import "server-only";
import { managementRequest as request } from "@marshaldesk/kinde";
import * as z from "zod";

export { KindeManagementError } from "@marshaldesk/kinde";

const organizationSchema = z.object({
  code: z.string(),
  name: z.string(),
  is_default: z.boolean(),
  external_id: z.string().nullish(),
  billing: z.object({ billing_customer_id: z.string().nullish() }).nullish(),
});

export type KindeOrganization = {
  code: string;
  name: string;
  isDefault: boolean;
  externalId: string | null;
  billingCustomerId: string | null;
};

export async function getOrganization(
  orgCode: string,
): Promise<KindeOrganization> {
  const organization = await request(
    "getOrganization",
    `/api/v1/organization?${new URLSearchParams({ code: orgCode, expand: "billing" })}`,
    organizationSchema,
  );
  return {
    code: organization.code,
    name: organization.name,
    isDefault: organization.is_default,
    externalId: organization.external_id ?? null,
    billingCustomerId: organization.billing?.billing_customer_id ?? null,
  };
}

const createOrganizationSchema = z.object({
  organization: z.object({
    code: z.string(),
    billing_customer_id: z.string(),
  }),
});

export type CreatedOrganization = { code: string; billingCustomerId: string };

/**
 * Creates an organization that is also a billing customer on the default
 * organization plan. `externalId` links it back to the workspace row. Kinde
 * refuses to delete an organization once it has a billing agreement, so a
 * caller must never create one it might throw away.
 */
export async function createBilledOrganization(input: {
  name: string;
  externalId: string;
  billingEmail: string;
}): Promise<CreatedOrganization> {
  const created = await request(
    "createOrganization",
    "/api/v1/organization",
    createOrganizationSchema,
    {
      method: "POST",
      body: {
        name: input.name,
        external_id: input.externalId,
        is_create_billing_customer: true,
        billing_email: input.billingEmail,
      },
    },
  );
  return {
    code: created.organization.code,
    billingCustomerId: created.organization.billing_customer_id,
  };
}

const addOrganizationUsersSchema = z.object({
  users_added: z.array(z.string()).optional(),
});

/** Adds an existing Kinde user to an organization with one role, by role key. */
export async function addOrganizationUser(
  orgCode: string,
  userId: string,
  roleKey: string,
): Promise<void> {
  await request(
    "addOrganizationUser",
    `/api/v1/organizations/${encodeURIComponent(orgCode)}/users`,
    addOrganizationUsersSchema,
    { method: "POST", body: { users: [{ id: userId, roles: [roleKey] }] } },
  );
}

const userOrganizationsSchema = z.object({
  organizations: z.array(z.string()).nullish(),
});

/** The codes of every organization the user belongs to, the default organization included. */
export async function getUserOrganizationCodes(
  userId: string,
): Promise<string[]> {
  const user = await request(
    "getUser",
    `/api/v1/user?${new URLSearchParams({ id: userId, expand: "organizations" })}`,
    userOrganizationsSchema,
  );
  return user.organizations ?? [];
}

const organizationUserPermissionsSchema = z.object({
  permissions: z.array(z.object({ key: z.string() })).nullish(),
});

/** The user's current permission keys in the organization, live rather than from a token. */
export async function getOrganizationUserPermissions(
  orgCode: string,
  userId: string,
): Promise<string[]> {
  const result = await request(
    "getOrganizationUserPermissions",
    `/api/v1/organizations/${encodeURIComponent(orgCode)}/users/${encodeURIComponent(userId)}/permissions`,
    organizationUserPermissionsSchema,
  );
  return (result.permissions ?? []).map((permission) => permission.key);
}

const rolesSchema = z.object({
  roles: z.array(z.object({ id: z.string(), key: z.string() })).nullish(),
});

export type KindeRole = { id: string; key: string };

/** Every role defined for the business. The Free plan allows two, so one page covers them. */
export async function getRoles(): Promise<KindeRole[]> {
  const result = await request(
    "getRoles",
    `/api/v1/roles?${new URLSearchParams({ page_size: "100" })}`,
    rolesSchema,
  );
  return result.roles ?? [];
}

/** The user's roles in one organization. */
export async function getOrganizationUserRoles(
  orgCode: string,
  userId: string,
): Promise<KindeRole[]> {
  const result = await request(
    "getOrganizationUserRoles",
    `/api/v1/organizations/${encodeURIComponent(orgCode)}/users/${encodeURIComponent(userId)}/roles`,
    rolesSchema,
  );
  return result.roles ?? [];
}

export async function addOrganizationUserRole(
  orgCode: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await request(
    "addOrganizationUserRole",
    `/api/v1/organizations/${encodeURIComponent(orgCode)}/users/${encodeURIComponent(userId)}/roles`,
    z.unknown(),
    { method: "POST", body: { role_id: roleId } },
  );
}

export async function removeOrganizationUserRole(
  orgCode: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await request(
    "removeOrganizationUserRole",
    `/api/v1/organizations/${encodeURIComponent(orgCode)}/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    z.unknown(),
    { method: "DELETE" },
  );
}

/** Removes the user from the organization. They stay a Kinde user. Already-issued tokens aren't rewritten. */
export async function removeOrganizationUser(
  orgCode: string,
  userId: string,
): Promise<void> {
  await request(
    "removeOrganizationUser",
    `/api/v1/organizations/${encodeURIComponent(orgCode)}/users/${encodeURIComponent(userId)}`,
    z.unknown(),
    { method: "DELETE" },
  );
}
