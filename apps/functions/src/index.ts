import { createHash, timingSafeEqual } from "node:crypto";
import { getSource, getSourceIngestState } from "@marshaldesk/db";
import { reconcileReplySuggestionUsage } from "@marshaldesk/kinde";
import {
  FUNCTION_ROUTES,
  parseSourceStorageKey,
  storageObjectCreatedDataSchema,
  suggestedQuestionsRequestSchema,
  textIngestRequestSchema,
  triggerEnvelopeSchema,
} from "@marshaldesk/shared";
import { waitUntil } from "@neon/functions";
import { closeIdleConversations } from "./auto-close";
import { checkEnvOnce, uploadsBucket } from "./env";
import { ingestSource } from "./ingest";
import { logError, logInfo } from "./log";
import { failStaleSources, regenerateAfterSweep } from "./stale-sources";
import { deleteUpload, headUpload } from "./storage";
import { regenerateSuggestedQuestions } from "./suggested-questions";

// Neon strips client-sent X-Neon-* headers at the edge, so this proves a trigger call.
const TRIGGER_HEADER = "X-Neon-Trigger-Invocation-Id";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function hasSecret(request: Request): boolean {
  const secret = process.env["FUNCTIONS_SECRET"];
  const header = request.headers.get("Authorization");
  if (!secret || !header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

function isTrigger(request: Request): boolean {
  return Boolean(request.headers.get(TRIGGER_HEADER)) || hasSecret(request);
}

function status(code: number, body: Record<string, unknown> = {}): Response {
  return Response.json(body, { status: code });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Runs past the response, logging instead of throwing. */
function inBackground(
  route: string,
  fields: Record<string, string>,
  work: () => Promise<unknown>,
): void {
  waitUntil(work().catch((error: unknown) => logError(route, fields, error)));
}

async function handleSourceUploaded(request: Request): Promise<Response> {
  const envelope = triggerEnvelopeSchema.safeParse(await readJson(request));
  if (!envelope.success) return status(400, { error: "invalid_body" });
  const data = storageObjectCreatedDataSchema.safeParse(envelope.data.data);
  if (!data.success) return status(400, { error: "invalid_body" });
  const { bucket_name: bucket, object_key: key } = data.data;
  const invocationId = envelope.data.invocation_id;

  const parsed = parseSourceStorageKey(key);
  if (bucket !== uploadsBucket() || !parsed) {
    logInfo("source_uploaded.ignored", {
      invocationId,
      reason: "not_a_source",
    });
    return status(202, { ignored: true });
  }
  const { workspaceId, sourceId } = parsed;

  const source = await getSource(workspaceId, sourceId);
  if (!source || source.kind !== "file" || source.storageKey !== key) {
    // The row is always created before the presign, so this object belongs to
    // a deleted source: an upload that landed after the delete.
    await deleteUpload(key);
    logInfo("source_uploaded.orphan_deleted", {
      invocationId,
      workspaceId,
      sourceId,
    });
    return status(202, { ignored: true });
  }

  inBackground(
    "source_uploaded",
    { invocationId, workspaceId, sourceId },
    async () => {
      const [head, state] = await Promise.all([
        headUpload(key),
        getSourceIngestState(workspaceId, sourceId),
      ]);
      if (!head || !state) {
        logInfo("source_uploaded.ignored", {
          invocationId,
          workspaceId,
          sourceId,
          reason: head ? "source_gone" : "object_missing",
        });
        return;
      }
      if (
        state.status === "ready" &&
        state.error === null &&
        head.etag &&
        state.ingestedEtag === head.etag
      ) {
        logInfo("source_uploaded.duplicate", {
          invocationId,
          workspaceId,
          sourceId,
        });
        return;
      }
      await ingestSource(workspaceId, sourceId);
    },
  );
  return status(202, { accepted: true });
}

async function handleIngestText(request: Request): Promise<Response> {
  const body = textIngestRequestSchema.safeParse(await readJson(request));
  if (!body.success) return status(400, { error: "invalid_body" });
  const { workspaceId, sourceId } = body.data;
  const source = await getSource(workspaceId, sourceId);
  if (!source || source.kind !== "text") {
    return status(404, { error: "source_not_found" });
  }
  inBackground("ingest_text", { workspaceId, sourceId }, () =>
    ingestSource(workspaceId, sourceId),
  );
  return status(202, { accepted: true });
}

async function handleSuggestedQuestions(request: Request): Promise<Response> {
  const body = suggestedQuestionsRequestSchema.safeParse(
    await readJson(request),
  );
  if (!body.success) return status(400, { error: "invalid_body" });
  const { workspaceId } = body.data;
  inBackground("suggested_questions", { workspaceId }, () =>
    regenerateSuggestedQuestions(workspaceId),
  );
  return status(202, { accepted: true });
}

async function handleSchedule(): Promise<Response> {
  const closed = await closeIdleConversations();
  logInfo("auto_close.done", { closed });
  const { failed, workspaceIds } = await failStaleSources();
  logInfo("stale_sources.done", { failed });
  if (workspaceIds.length > 0) {
    inBackground("stale_sources", {}, () => regenerateAfterSweep(workspaceIds));
  }
  return status(200, { closed, staleSources: failed });
}

async function handleReconcileUsage(): Promise<Response> {
  const results = await reconcileReplySuggestionUsage();
  const outcomes: Record<string, number> = {};
  for (const { outcome } of results) {
    outcomes[outcome.kind] = (outcomes[outcome.kind] ?? 0) + 1;
  }
  logInfo("reconcile_usage.done", { workspaces: results.length, ...outcomes });
  return status(200, { results });
}

type Route = (typeof FUNCTION_ROUTES)[keyof typeof FUNCTION_ROUTES];

function isRoute(pathname: string): pathname is Route {
  return (Object.values(FUNCTION_ROUTES) as string[]).includes(pathname);
}

async function route(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!isRoute(pathname)) return status(404, { error: "not_found" });
  if (request.method !== "POST")
    return status(405, { error: "method_not_allowed" });

  switch (pathname) {
    case FUNCTION_ROUTES.ingestText:
      if (!hasSecret(request)) return status(401, { error: "unauthorized" });
      return handleIngestText(request);
    case FUNCTION_ROUTES.suggestedQuestions:
      if (!hasSecret(request)) return status(401, { error: "unauthorized" });
      return handleSuggestedQuestions(request);
    case FUNCTION_ROUTES.sourceUploadedTrigger:
      if (!isTrigger(request)) return status(401, { error: "unauthorized" });
      return handleSourceUploaded(request);
    case FUNCTION_ROUTES.autoCloseTrigger:
      if (!isTrigger(request)) return status(401, { error: "unauthorized" });
      return handleSchedule();
    case FUNCTION_ROUTES.reconcileUsageTrigger:
      if (!isTrigger(request)) return status(401, { error: "unauthorized" });
      return handleReconcileUsage();
    default: {
      const unreachable: never = pathname;
      return status(404, { error: "not_found", path: String(unreachable) });
    }
  }
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    checkEnvOnce();
    try {
      return await route(request);
    } catch (error) {
      logError(new URL(request.url).pathname, {}, error);
      return status(500, { error: "internal_error" });
    }
  },
};

export default handler;
