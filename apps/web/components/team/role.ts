import type { AssignableRole, MemberRole } from "@marshaldesk/shared";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  support: "Support",
  "billing-admin": "Billing admin",
};

export const ASSIGNABLE_ROLE_ITEMS: { value: AssignableRole; label: string }[] =
  [
    { value: "support", label: ROLE_LABELS.support },
    { value: "billing-admin", label: ROLE_LABELS["billing-admin"] },
  ];

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  support: "Reads and replies to conversations, and uses reply suggestions.",
  "billing-admin": "Manages the plan and payment details, and nothing else.",
};
