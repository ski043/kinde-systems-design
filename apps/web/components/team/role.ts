import { MEMBER_ROLES, type MemberRole } from "@marshaldesk/shared";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  support: "Support",
};

export const ROLE_ITEMS: { value: MemberRole; label: string }[] =
  MEMBER_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
