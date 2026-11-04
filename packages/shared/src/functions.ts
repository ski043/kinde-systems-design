import * as z from "zod";

/**
 * Routes of the `jobs` Neon Function. The web app calls the first two with
 * `Authorization: Bearer ${FUNCTIONS_SECRET}`; Neon's triggers call the others.
 */
export const FUNCTION_ROUTES = {
  ingestText: "/ingest/text",
  suggestedQuestions: "/suggested-questions",
  sourceUploadedTrigger: "/triggers/source-uploaded",
  autoCloseTrigger: "/triggers/auto-close",
  reconcileUsageTrigger: "/triggers/reconcile-usage",
} as const;

export const textIngestRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  sourceId: z.string().uuid(),
});
export type TextIngestRequest = z.infer<typeof textIngestRequestSchema>;

export const suggestedQuestionsRequestSchema = z.object({
  workspaceId: z.string().uuid(),
});
export type SuggestedQuestionsRequest = z.infer<
  typeof suggestedQuestionsRequestSchema
>;

/** Neon's trigger envelope (version 1). */
export const triggerEnvelopeSchema = z.object({
  version: z.literal(1),
  invocation_id: z.string(),
  trigger: z.object({ type: z.string(), id: z.string(), name: z.string() }),
  data: z.record(z.string(), z.unknown()),
});
export type TriggerEnvelope = z.infer<typeof triggerEnvelopeSchema>;

export const storageObjectCreatedDataSchema = z.object({
  bucket_name: z.string(),
  object_key: z.string(),
});
