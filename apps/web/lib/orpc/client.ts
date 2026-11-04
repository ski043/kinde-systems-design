import type { Contract } from "@marshaldesk/shared";
import { createORPCClient, isDefinedError, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

export type AppClient = RouterContractClient<Contract>;

const link = new RPCLink({
  url: "/rpc",
  origin: () => {
    if (typeof window === "undefined") {
      throw new Error("Use the server client (lib/orpc/server) on the server.");
    }
    return window.location.origin;
  },
});

/**
 * The proxy refreshes the Kinde session on every RPC, so these mean the session
 * really ended or the member was removed. A full navigation lets the page gates
 * send them to sign-in, or wherever they belong now.
 */
const SESSION_ENDED_CODES = new Set(["UNAUTHORIZED", "WORKSPACE_REQUIRED"]);

export const client: AppClient = createORPCClient(link, {
  interceptors: [
    onError((error) => {
      if (isDefinedError(error) && SESSION_ENDED_CODES.has(error.code)) {
        window.location.reload();
      }
    }),
  ],
});

/** TanStack Query utilities for client components. */
export const orpc = createTanstackQueryUtils(client);
