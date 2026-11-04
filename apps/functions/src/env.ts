export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

const EXPECTED_ENV = [
  "DATABASE_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
  "NEON_AI_GATEWAY_BASE_URL",
  "NEON_AI_GATEWAY_TOKEN",
  "FUNCTIONS_SECRET",
  "REALTIME_URL",
  "REALTIME_PUBLISH_SECRET",
  "STORAGE_UPLOADS_BUCKET",
  "KINDE_ISSUER_URL",
  "KINDE_M2M_CLIENT_ID",
  "KINDE_M2M_CLIENT_SECRET",
] as const;

let checked = false;

/** Logs which expected variables are missing, once per instance. Never values. */
export function checkEnvOnce(): void {
  if (checked) return;
  checked = true;
  const missing = EXPECTED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      JSON.stringify({ event: "env.missing", missing: missing.join(",") }),
    );
  } else {
    console.log(JSON.stringify({ event: "env.ok" }));
  }
}

export function uploadsBucket(): string {
  return process.env["STORAGE_UPLOADS_BUCKET"] ?? "uploads";
}
