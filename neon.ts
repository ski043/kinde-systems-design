import { defineConfig } from "@neon/config/v1";

// Function env is baked in at deploy time; load it with
// `neon deploy --env apps/web/.env.local`.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Deploy with --env apps/web/.env.local.`,
    );
  }
  return value;
}

const uploadsBucket = process.env["STORAGE_UPLOADS_BUCKET"] ?? "uploads";
const profileImagesBucket =
  process.env["STORAGE_PROFILE_IMAGES_BUCKET"] ?? "profile-images";

export default defineConfig({
  aiGateway: true,
  functions: {
    jobs: {
      name: "MarshalDesk jobs",
      source: "./apps/functions/src/index.ts",
      env: {
        FUNCTIONS_SECRET: requireEnv("FUNCTIONS_SECRET"),
        REALTIME_URL: requireEnv("REALTIME_URL"),
        REALTIME_PUBLISH_SECRET: requireEnv("REALTIME_PUBLISH_SECRET"),
        STORAGE_UPLOADS_BUCKET: uploadsBucket,
        // Usage reconciliation reads and reports metered usage in Kinde Billing.
        KINDE_ISSUER_URL: requireEnv("KINDE_ISSUER_URL"),
        KINDE_M2M_CLIENT_ID: requireEnv("KINDE_M2M_CLIENT_ID"),
        KINDE_M2M_CLIENT_SECRET: requireEnv("KINDE_M2M_CLIENT_SECRET"),
      },
      dev: { port: 8788 },
    },
  },
  buckets: {
    [uploadsBucket]: {},
    [profileImagesBucket]: { access: "public_read" },
  },
  triggers: {
    "source-uploaded": {
      type: "storage_object_created",
      function: "jobs",
      bucket: uploadsBucket,
      prefix: "workspaces/",
      functionPath: "/triggers/source-uploaded",
    },
    "auto-close": {
      type: "schedule",
      function: "jobs",
      cron: "*/15 * * * *",
      functionPath: "/triggers/auto-close",
    },
    // Hourly, not every 15 minutes: a cold instance fetches a new Kinde M2M
    // token, and the Kinde Free plan allows 2,000 a month.
    "reconcile-usage": {
      type: "schedule",
      function: "jobs",
      cron: "41 * * * *",
      functionPath: "/triggers/reconcile-usage",
    },
  },
});
