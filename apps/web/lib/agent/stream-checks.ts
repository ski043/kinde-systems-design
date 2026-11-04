import "server-only";
import type { FinishReason } from "ai";

/** Throws unless the model stopped for one of the `normal` reasons. */
export function assertNormalFinish(
  finishReason: FinishReason,
  normal: readonly FinishReason[],
): void {
  if (!normal.includes(finishReason)) {
    throw new Error(`The reply ended early (${finishReason})`);
  }
}

/** The trimmed reply, or a throw when the model returned only whitespace. */
export function nonEmptyReply(text: string): string {
  const body = text.trim();
  if (body === "") throw new Error("The model returned an empty reply");
  return body;
}
