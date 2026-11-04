import { error } from "@orpc/contract";
import * as z from "zod";
import { assignableRoleSchema, permissionSchema } from "./permissions";
import { conversationStateSchema } from "./schemas/conversation";

export const UnauthorizedError = error("UNAUTHORIZED", {
  message: "Sign in to continue.",
});
export const WorkspaceRequiredError = error("WORKSPACE_REQUIRED", {
  message: "Name your business to continue.",
});
export const PermissionDeniedError = error("PERMISSION_DENIED", {
  message: "You don't have permission to do that.",
  data: z.object({ permission: permissionSchema }),
});
export const AvatarRejectedError = error("AVATAR_REJECTED", {
  message: "That image couldn't be used.",
});
export const VisitorUnauthorizedError = error("VISITOR_UNAUTHORIZED", {
  message: "Your chat session has expired.",
});
export const DomainNotAllowedError = error("DOMAIN_NOT_ALLOWED", {
  message: "The widget isn't allowed on this website.",
});
export const ConversationNotFoundError = error("NOT_FOUND", {
  message: "This conversation doesn't exist.",
});
export const ConversationConflictError = error("CONFLICT", {
  message: "This conversation changed. Refresh to see its current state.",
  data: z.object({ state: conversationStateSchema }),
});
export const SourceNotFoundError = error("NOT_FOUND", {
  message: "This source doesn't exist.",
});
export const WidgetNotFoundError = error("NOT_FOUND", {
  message: "This widget doesn't exist.",
});
export const NoConversationError = error("NOT_FOUND", {
  message: "There's no conversation to follow yet.",
});

export const MemberNotFoundError = error("NOT_FOUND", {
  message: "This person isn't a member of your workspace anymore.",
});
export const InvitationNotFoundError = error("NOT_FOUND", {
  message: "This invitation doesn't exist anymore.",
});
export const NoInvitationError = error("NOT_FOUND", {
  message: "There's no pending invitation for your email address.",
});
export const OwnerProtectedError = error("OWNER_PROTECTED", {
  message:
    "The workspace owner can't be removed, and their role can't be changed.",
});
export const AlreadyInWorkspaceError = error("ALREADY_IN_WORKSPACE", {
  message:
    "This person already belongs to a workspace. A person can only be in one.",
});
export const AlreadyInvitedError = error("ALREADY_INVITED", {
  message:
    "This email already has a pending invitation with another role. Revoke it first.",
  data: z.object({ role: assignableRoleSchema }),
});
export const RoleUnavailableError = error("ROLE_UNAVAILABLE", {
  message:
    "This role isn't set up in Kinde yet. Add it there (billing admin needs a paid Kinde plan), then try again.",
  data: z.object({ role: assignableRoleSchema }),
});

export const PlanRequiredError = error("PLAN_REQUIRED", {
  message: "Reply suggestions aren't part of your workspace's plan.",
});
export const SuggestionInProgressError = error("SUGGESTION_IN_PROGRESS", {
  message: "This reply suggestion is still being written.",
});

export const authenticatedErrors = {
  [UnauthorizedError.code]: UnauthorizedError,
};

export const memberErrors = {
  ...authenticatedErrors,
  [WorkspaceRequiredError.code]: WorkspaceRequiredError,
};

/** For procedures that `requirePermission`. */
export const permissionErrors = {
  ...memberErrors,
  [PermissionDeniedError.code]: PermissionDeniedError,
};

export const avatarErrors = {
  ...permissionErrors,
  [AvatarRejectedError.code]: AvatarRejectedError,
};

/** For procedures that `requireEntitlement`, after `requirePermission`. */
export const entitlementErrors = {
  ...permissionErrors,
  [PlanRequiredError.code]: PlanRequiredError,
};

export const suggestReplyErrors = {
  ...entitlementErrors,
  [ConversationNotFoundError.code]: ConversationNotFoundError,
  [ConversationConflictError.code]: ConversationConflictError,
  [SuggestionInProgressError.code]: SuggestionInProgressError,
};

export const visitorErrors = {
  [VisitorUnauthorizedError.code]: VisitorUnauthorizedError,
  [DomainNotAllowedError.code]: DomainNotAllowedError,
};

export const conversationErrors = {
  ...permissionErrors,
  [ConversationNotFoundError.code]: ConversationNotFoundError,
  [ConversationConflictError.code]: ConversationConflictError,
};

export const sourceErrors = {
  ...permissionErrors,
  [SourceNotFoundError.code]: SourceNotFoundError,
};

export const acceptInvitationErrors = {
  ...authenticatedErrors,
  [NoInvitationError.code]: NoInvitationError,
  [RoleUnavailableError.code]: RoleUnavailableError,
};

export const inviteErrors = {
  ...permissionErrors,
  [AlreadyInWorkspaceError.code]: AlreadyInWorkspaceError,
  [AlreadyInvitedError.code]: AlreadyInvitedError,
  [RoleUnavailableError.code]: RoleUnavailableError,
};

export const invitationErrors = {
  ...permissionErrors,
  [InvitationNotFoundError.code]: InvitationNotFoundError,
};

export const memberChangeErrors = {
  ...permissionErrors,
  [MemberNotFoundError.code]: MemberNotFoundError,
  [OwnerProtectedError.code]: OwnerProtectedError,
};

export const roleChangeErrors = {
  ...memberChangeErrors,
  [RoleUnavailableError.code]: RoleUnavailableError,
};
