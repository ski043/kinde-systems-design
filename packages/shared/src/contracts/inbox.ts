import { eventIterator, oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import * as z from "zod";
import {
  conversationErrors,
  permissionErrors,
  suggestReplyErrors,
} from "../errors";
import {
  conversationDetailSchema,
  conversationSummarySchema,
  messageBodySchema,
} from "../schemas/conversation";
import {
  replySuggestionEventSchema,
  suggestReplyInputSchema,
} from "../schemas/reply-suggestion";

export {
  conversationDetailSchema,
  conversationSummarySchema,
  type ConversationDetail,
  type ConversationSummary,
} from "../schemas/conversation";

const conversationIdInput = z.object({ id: z.string().uuid() });

function conversationAction(path: string, summary: string) {
  return oc
    .meta(
      openapi({
        method: "POST",
        path: `/conversations/{id}/${path}`,
        summary,
        tags: ["Inbox"],
      }),
    )
    .input(conversationIdInput)
    .output(conversationDetailSchema);
}

export const inboxContract = {
  list: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/conversations",
        summary: "List the workspace's conversations",
        tags: ["Inbox"],
      }),
    )
    .output(z.object({ conversations: z.array(conversationSummarySchema) })),
  get: oc
    .errors(conversationErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/conversations/{id}",
        summary: "Get a conversation with its messages and visitor details",
        tags: ["Inbox"],
      }),
    )
    .input(conversationIdInput)
    .output(conversationDetailSchema),
  reply: oc
    .errors(conversationErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/conversations/{id}/messages",
        summary: "Reply as the owner",
        description:
          "Replying takes over: an ai or waiting conversation becomes human.",
        tags: ["Inbox"],
      }),
    )
    .input(conversationIdInput.extend({ body: messageBodySchema }))
    .output(conversationDetailSchema),
  takeOver: conversationAction("take-over", "Take over from the agent").errors(
    conversationErrors,
  ),
  handBack: conversationAction(
    "hand-back",
    "Hand a human conversation back to the agent",
  ).errors(conversationErrors),
  close: conversationAction("close", "Close a conversation").errors(
    conversationErrors,
  ),
  markRead: conversationAction("read", "Mark a conversation as read").errors(
    conversationErrors,
  ),
  suggestReply: oc
    .errors(suggestReplyErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/conversations/{conversationId}/reply-suggestions",
        summary: "Stream a reply suggestion for an open conversation",
        description:
          "Streams the draft to the calling member only, as server-sent events. Needs `suggestions:create` and a plan that includes reply suggestions.",
        tags: ["Inbox"],
      }),
    )
    .input(suggestReplyInputSchema)
    .output(eventIterator(replySuggestionEventSchema)),
};
