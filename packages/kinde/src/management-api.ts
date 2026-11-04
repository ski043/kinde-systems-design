import * as z from "zod";

const envSchema = z.object({
  KINDE_ISSUER_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  KINDE_M2M_CLIENT_ID: z.string().min(1),
  KINDE_M2M_CLIENT_SECRET: z.string().min(1),
});

type ManagementEnv = z.infer<typeof envSchema>;

let env: ManagementEnv | undefined;

function managementEnv(): ManagementEnv {
  env ??= envSchema.parse(process.env);
  return env;
}

export class KindeManagementError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
    readonly body: string,
  ) {
    super(`Kinde Management API ${operation} failed (${status}): ${body}`);
    this.name = "KindeManagementError";
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

// The Free plan allows 2,000 M2M tokens a month, so one token is reused until
// about 5 minutes before it expires, and concurrent callers share one fetch.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cachedToken: { value: string; refreshAt: number } | undefined;
let tokenRequest: Promise<string> | undefined;

async function fetchToken(): Promise<string> {
  const { KINDE_ISSUER_URL, KINDE_M2M_CLIENT_ID, KINDE_M2M_CLIENT_SECRET } =
    managementEnv();
  const response = await fetch(`${KINDE_ISSUER_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: KINDE_M2M_CLIENT_ID,
      client_secret: KINDE_M2M_CLIENT_SECRET,
      audience: `${KINDE_ISSUER_URL}/api`,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new KindeManagementError(
      response.status,
      "token",
      await response.text(),
    );
  }
  const token = tokenResponseSchema.parse(await response.json());
  cachedToken = {
    value: token.access_token,
    refreshAt: Date.now() + token.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS,
  };
  return token.access_token;
}

async function managementToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.refreshAt) {
    return cachedToken.value;
  }
  tokenRequest ??= fetchToken().finally(() => {
    tokenRequest = undefined;
  });
  return tokenRequest;
}

/** One Management API call with the shared M2M token. The response is parsed with `schema`. */
export async function managementRequest<T>(
  operation: string,
  path: string,
  schema: z.ZodType<T>,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${managementEnv().KINDE_ISSUER_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await managementToken()}`,
      Accept: "application/json",
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new KindeManagementError(response.status, operation, text);
  }
  return schema.parse(text ? JSON.parse(text) : undefined);
}
