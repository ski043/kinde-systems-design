import * as z from "zod";

/** One event of a streamed reply suggestion. `delta` carries new text; `done` the finished draft. */
export const replySuggestionEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("done"), body: z.string() }),
]);

export type ReplySuggestionEvent = z.infer<typeof replySuggestionEventSchema>;

export const suggestReplyInputSchema = z.object({
  conversationId: z.string().uuid(),
});
