import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import * as z from "zod";
import { permissionErrors, sourceErrors } from "../errors";
import {
  chunkPreviewSchema,
  createSourceUploadSchema,
  knowledgeBaseSchema,
  sourceDetailSchema,
  sourceSchema,
  sourceUploadSchema,
  textSourceSchema,
} from "../schemas/source";

const sourceIdInput = z.object({ id: z.string().uuid() });

export const knowledgeContract = {
  get: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/knowledge-base",
        summary:
          "List the knowledge base's sources and current suggested questions",
        tags: ["Knowledge base"],
      }),
    )
    .output(knowledgeBaseSchema),
  getSource: oc
    .errors(sourceErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/knowledge-base/sources/{id}",
        summary: "Get a source, including the text of a text source",
        tags: ["Knowledge base"],
      }),
    )
    .input(sourceIdInput)
    .output(sourceDetailSchema),
  createUpload: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/knowledge-base/uploads",
        summary: "Get a presigned URL for uploading a source file",
        description:
          "Checks the file's type and size first. A file with the same name as an existing one replaces it: same source, new content.",
        tags: ["Knowledge base"],
      }),
    )
    .input(createSourceUploadSchema)
    .output(sourceUploadSchema),
  createText: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/knowledge-base/sources",
        summary: "Add a text source",
        tags: ["Knowledge base"],
      }),
    )
    .input(textSourceSchema)
    .output(sourceSchema),
  updateText: oc
    .errors(sourceErrors)
    .meta(
      openapi({
        method: "PUT",
        path: "/knowledge-base/sources/{id}",
        summary: "Edit a text source",
        description:
          "Saving re-processes it. The previous version keeps answering until the new one is ready.",
        tags: ["Knowledge base"],
      }),
    )
    .input(sourceIdInput.extend(textSourceSchema.shape))
    .output(sourceSchema),
  deleteSource: oc
    .errors(sourceErrors)
    .meta(
      openapi({
        method: "DELETE",
        path: "/knowledge-base/sources/{id}",
        summary: "Delete a source with its chunks and stored file",
        tags: ["Knowledge base"],
      }),
    )
    .input(sourceIdInput)
    .output(z.object({ id: z.string() })),
  abandonUpload: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/knowledge-base/uploads/{id}/abandon",
        summary: "Remove a file source whose upload failed",
        description:
          "Only deletes the source while it's exactly as that upload left it, so a same-name upload that reused it keeps it.",
        tags: ["Knowledge base"],
      }),
    )
    .input(sourceIdInput.extend({ updatedAt: z.string() }))
    .output(z.object({ deleted: z.boolean() })),
  listChunks: oc
    .errors(sourceErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/knowledge-base/sources/{id}/chunks",
        summary: "Preview the chunks extracted from a source",
        tags: ["Knowledge base"],
      }),
    )
    .input(sourceIdInput)
    .output(z.object({ chunks: z.array(chunkPreviewSchema) })),
};
