#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import process from "node:process";

const REQUIRED_ENV_KEYS = [
  "KINDE_CLIENT_ID",
  "KINDE_CLIENT_SECRET",
  "KINDE_ISSUER_URL",
  "KINDE_SITE_URL",
  "KINDE_POST_LOGIN_REDIRECT_URL",
  "KINDE_POST_LOGOUT_REDIRECT_URL",
];

const CODE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".open-next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

function add(messages, level, code, message) {
  messages.push({ level, code, message });
}

function isDirectory(pathname) {
  try {
    return statSync(pathname).isDirectory();
  } catch {
    return false;
  }
}

function readText(pathname) {
  try {
    return readFileSync(pathname, "utf8");
  } catch {
    return null;
  }
}

function readJson(pathname) {
  const text = readText(pathname);
  if (text === null) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const trimmed = comparator.trim();
  if (!trimmed || trimmed === "*" || trimmed.toLowerCase() === "latest") {
    return true;
  }

  const operatorMatch = trimmed.match(/^(\^|~|>=|<=|>|<|=)?\s*v?(.+)$/);
  if (!operatorMatch) return null;

  const operator = operatorMatch[1] ?? "=";
  const base = parseVersion(operatorMatch[2]);
  if (!base) return null;

  const comparison = compareVersions(version, base);
  if (operator === ">=") return comparison >= 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === ">") return comparison > 0;
  if (operator === "<") return comparison < 0;
  if (operator === "=") return comparison === 0;

  if (operator === "~") {
    return (
      version[0] === base[0] &&
      version[1] === base[1] &&
      comparison >= 0
    );
  }

  if (operator === "^") {
    if (base[0] > 0) {
      return version[0] === base[0] && comparison >= 0;
    }
    if (base[1] > 0) {
      return (
        version[0] === 0 &&
        version[1] === base[1] &&
        comparison >= 0
      );
    }
    return (
      version[0] === 0 &&
      version[1] === 0 &&
      version[2] === base[2]
    );
  }

  return null;
}

function satisfiesRange(versionString, range) {
  const version = parseVersion(versionString);
  if (!version || typeof range !== "string") return null;

  let unknown = false;
  for (const branch of range.split("||")) {
    const comparators = branch.trim().split(/\s+/).filter(Boolean);
    let branchMatches = true;

    for (const comparator of comparators) {
      const result = satisfiesComparator(version, comparator);
      if (result === null) {
        unknown = true;
        branchMatches = false;
        break;
      }
      if (!result) {
        branchMatches = false;
        break;
      }
    }

    if (branchMatches) return true;
  }

  return unknown ? null : false;
}

function packageMetadata(root, packageName, packageJson) {
  const packagePath = join(root, "node_modules", ...packageName.split("/"), "package.json");
  const installed = readJson(packagePath);
  if (installed?.version) {
    return {
      installed: true,
      version: installed.version,
      metadata: installed,
    };
  }

  const declared =
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    packageJson.optionalDependencies?.[packageName] ??
    null;

  return {
    installed: false,
    version: declared,
    metadata: null,
  };
}

function detectPackageManager(root, packageJson, messages) {
  const lockfiles = [
    ["npm", "package-lock.json"],
    ["pnpm", "pnpm-lock.yaml"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lock"],
    ["bun", "bun.lockb"],
  ].filter(([, filename]) => existsSync(join(root, filename)));

  const declared =
    typeof packageJson.packageManager === "string"
      ? packageJson.packageManager.split("@")[0]
      : null;
  const detected = declared ?? lockfiles[0]?.[0] ?? null;

  if (!detected) {
    add(
      messages,
      "WARN",
      "package-manager",
      "No packageManager field or recognized lockfile was found.",
    );
    return null;
  }

  const conflictingLocks = lockfiles.filter(([name]) => name !== detected);
  if (conflictingLocks.length > 0) {
    add(
      messages,
      "WARN",
      "package-manager",
      "Multiple package-manager signals disagree; resolve them before installing.",
    );
  } else {
    add(messages, "PASS", "package-manager", `Detected ${detected}.`);
  }

  return detected;
}

function parseEnvFile(pathname) {
  const text = readText(pathname);
  const entries = new Map();
  if (text === null) return entries;

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/,
    );
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    entries.set(match[1], value);
  }

  return entries;
}

function envFilesAtRoot(root) {
  try {
    return readdirSync(root)
      .filter((name) => /^\.env(?:\.|$)/.test(name))
      .sort((left, right) => {
        const priority = [
          ".env.local",
          ".env.development.local",
          ".env.development",
          ".env",
          ".env.example",
        ];
        const leftIndex = priority.indexOf(left);
        const rightIndex = priority.indexOf(right);
        return (
          (leftIndex === -1 ? priority.length : leftIndex) -
            (rightIndex === -1 ? priority.length : rightIndex) ||
          left.localeCompare(right)
        );
      });
  } catch {
    return [];
  }
}

function collectEnv(root) {
  const files = envFilesAtRoot(root);
  const byKey = new Map();

  for (const filename of files) {
    const entries = parseEnvFile(join(root, filename));
    for (const [key, value] of entries) {
      const existing = byKey.get(key) ?? [];
      existing.push({ filename, value });
      byKey.set(key, existing);
    }
  }

  return { files, byKey };
}

function looksLikePlaceholder(value) {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return (
    normalized.includes("<") ||
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("placeholder") ||
    normalized.includes("replace") ||
    normalized.includes("example")
  );
}

function envFileIsIgnored(filename, gitignore) {
  if (!gitignore) return false;
  const lines = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  let ignored = false;
  for (const line of lines) {
    const negated = line.startsWith("!");
    const pattern = negated ? line.slice(1) : line;
    const normalized = pattern.startsWith("/") ? pattern.slice(1) : pattern;

    const matches =
      normalized === filename ||
      (normalized === ".env*" && filename.startsWith(".env")) ||
      (normalized === "*.local" && filename.endsWith(".local"));

    if (matches) ignored = !negated;
  }
  return ignored;
}

function gitIgnoreStatus(root, filename) {
  const result = spawnSync(
    "git",
    ["-C", root, "check-ignore", "--quiet", "--", filename],
    { stdio: "ignore" },
  );
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return null;
}

function normalizeApiPath(value) {
  const candidate = value?.trim() || "/api/auth";
  if (
    !candidate.startsWith("/") ||
    candidate.includes("..") ||
    candidate.includes("?") ||
    candidate.includes("#")
  ) {
    return null;
  }

  const normalized = candidate.replace(/\/+$/, "") || "/";
  if (!/^\/[A-Za-z0-9_/-]*$/.test(normalized)) return null;
  return normalized;
}

function routeCandidates(appRoot, apiPath, dynamicSegment) {
  const pathSegments = apiPath.split("/").filter(Boolean);
  const base = join(appRoot, ...pathSegments, dynamicSegment);
  return ["route.ts", "route.js", "route.mjs"].map((filename) =>
    join(base, filename),
  );
}

function firstExisting(paths) {
  return paths.find((pathname) => existsSync(pathname)) ?? null;
}

function discoverBoundaryFiles(root) {
  const names = [
    ["proxy", "proxy.ts"],
    ["proxy", "proxy.js"],
    ["proxy", "proxy.mjs"],
    ["middleware", "middleware.ts"],
    ["middleware", "middleware.js"],
    ["middleware", "middleware.mjs"],
  ];
  const roots = [
    ["root", root],
    ["src", join(root, "src")],
  ];
  const results = [];

  for (const [location, directory] of roots) {
    for (const [kind, filename] of names) {
      const pathname = join(directory, filename);
      if (existsSync(pathname)) {
        results.push({ kind, location, pathname });
      }
    }
  }

  return results;
}

function extensionOf(pathname) {
  const filename = basename(pathname);
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot);
}

function walkCodeFiles(root) {
  const files = [];

  function walk(directory) {
    if (files.length >= 5000) return;

    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= 5000) return;
      const pathname = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) walk(pathname);
        continue;
      }

      if (entry.isFile() && CODE_EXTENSIONS.has(extensionOf(pathname))) {
        files.push(pathname);
      }
    }
  }

  walk(root);
  return files;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function safeRelative(root, pathname) {
  return relative(root, pathname).split(sep).join("/");
}

function scanCode(root, messages) {
  const files = walkCodeFiles(root);
  let providerSeen = false;

  for (const pathname of files) {
    const text = readText(pathname);
    if (text === null) continue;
    const displayPath = safeRelative(root, pathname);

    if (text.includes("KindeProvider")) providerSeen = true;

    const publicSecret = text.indexOf("NEXT_PUBLIC_KINDE_CLIENT_SECRET");
    if (publicSecret !== -1) {
      add(
        messages,
        "ERROR",
        "secret-exposure",
        `${displayPath}:${lineNumberAt(text, publicSecret)} references a public Kinde client secret key.`,
      );
    }

    const unsafePermissionPattern = /\b(?:token|result)\.permissions\.includes\s*\(/g;
    let permissionMatch;
    while ((permissionMatch = unsafePermissionPattern.exec(text)) !== null) {
      add(
        messages,
        "WARN",
        "permissions-nullability",
        `${displayPath}:${lineNumberAt(text, permissionMatch.index)} calls permissions.includes without an obvious fallback.`,
      );
    }

    const unawaitedAuthPattern =
      /if\s*\(\s*!?\s*isAuthenticated\s*\(\s*\)\s*\)/g;
    let authMatch;
    while ((authMatch = unawaitedAuthPattern.exec(text)) !== null) {
      add(
        messages,
        "ERROR",
        "async-session",
        `${displayPath}:${lineNumberAt(text, authMatch.index)} tests isAuthenticated() without await.`,
      );
    }
  }

  const packageJson = readJson(join(root, "package.json")) ?? {};
  const cloudflare =
    existsSync(join(root, "wrangler.toml")) ||
    existsSync(join(root, "wrangler.json")) ||
    existsSync(join(root, "wrangler.jsonc")) ||
    Boolean(
      packageJson.dependencies?.["@opennextjs/cloudflare"] ??
        packageJson.devDependencies?.["@opennextjs/cloudflare"],
    );

  if (cloudflare && providerSeen) {
    add(
      messages,
      "WARN",
      "cloudflare-provider",
      "Cloudflare/OpenNext configuration and KindeProvider were both found; verify SSR against current Kinde guidance.",
    );
  }
}

function validateProject(inputRoot) {
  const root = resolve(inputRoot);
  const messages = [];
  const packagePath = join(root, "package.json");
  const packageJson = readJson(packagePath);

  if (!isDirectory(root)) {
    add(messages, "ERROR", "project-root", "The supplied project root is not a directory.");
    return { root, messages };
  }

  if (!packageJson) {
    add(messages, "ERROR", "package-json", "A readable package.json was not found.");
    return { root, messages };
  }
  add(messages, "PASS", "package-json", "Found a readable package.json.");

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) {
    add(
      messages,
      "ERROR",
      "node-version",
      `Validator is running on Node ${process.versions.node}; this skill requires Node 20+.`,
    );
  } else {
    add(
      messages,
      "PASS",
      "node-version",
      `Validator is running on Node ${process.versions.node}.`,
    );
  }

  detectPackageManager(root, packageJson, messages);

  const next = packageMetadata(root, "next", packageJson);
  const nextVersion = next.version;
  const nextParsed = parseVersion(nextVersion);
  const nextMajor = nextParsed?.[0] ?? null;
  if (!nextVersion) {
    add(messages, "ERROR", "next-version", "Next.js is not declared or installed.");
  } else if (!nextParsed) {
    add(
      messages,
      "WARN",
      "next-version",
      "Next.js was found, but its concrete version could not be determined.",
    );
  } else if (nextMajor < 13) {
    add(
      messages,
      "ERROR",
      "next-version",
      `Next.js ${nextVersion} is outside this App Router skill's Next 13+ scope.`,
    );
  } else {
    add(
      messages,
      "PASS",
      "next-version",
      `Detected Next.js ${nextVersion}${next.installed ? "" : " (declared)"}.`,
    );
  }

  const kinde = packageMetadata(
    root,
    "@kinde-oss/kinde-auth-nextjs",
    packageJson,
  );
  const kindeInDependencies = Boolean(
    packageJson.dependencies?.["@kinde-oss/kinde-auth-nextjs"],
  );
  const kindeInDevDependencies = Boolean(
    packageJson.devDependencies?.["@kinde-oss/kinde-auth-nextjs"],
  );

  if (!kinde.version) {
    add(messages, "ERROR", "kinde-sdk", "The Kinde Next.js SDK is not installed or declared.");
  } else if (!kindeInDependencies && kindeInDevDependencies) {
    add(
      messages,
      "ERROR",
      "kinde-sdk",
      "The Kinde Next.js SDK is a devDependency; move it to production dependencies.",
    );
  } else {
    add(
      messages,
      "PASS",
      "kinde-sdk",
      `Detected Kinde Next.js SDK ${kinde.version}${kinde.installed ? "" : " (declared)"}.`,
    );
  }

  const nextPeer = kinde.metadata?.peerDependencies?.next;
  if (next.installed && nextPeer) {
    const compatible = satisfiesRange(next.version, nextPeer);
    if (compatible === true) {
      add(
        messages,
        "PASS",
        "sdk-peer-range",
        "Installed Next.js satisfies the installed Kinde SDK peer range.",
      );
    } else if (compatible === false) {
      add(
        messages,
        "ERROR",
        "sdk-peer-range",
        "Installed Next.js does not satisfy the installed Kinde SDK peer range.",
      );
    } else {
      add(
        messages,
        "WARN",
        "sdk-peer-range",
        "The installed Kinde SDK peer range could not be evaluated; verify it with npm metadata.",
      );
    }
  } else {
    add(
      messages,
      "WARN",
      "sdk-peer-range",
      "Installed package metadata was unavailable; verify the candidate SDK peer range before installation.",
    );
  }

  for (const [peerName, label] of [
    ["react", "React"],
    ["react-dom", "React DOM"],
  ]) {
    const peerRange = kinde.metadata?.peerDependencies?.[peerName];
    if (!peerRange) continue;

    const peerPackage = packageMetadata(root, peerName, packageJson);
    if (!peerPackage.installed) {
      add(
        messages,
        "WARN",
        "sdk-peer-range",
        `${label} installed metadata was unavailable; verify it against the installed Kinde SDK peer range.`,
      );
      continue;
    }

    const compatible = satisfiesRange(peerPackage.version, peerRange);
    if (compatible === true) {
      add(
        messages,
        "PASS",
        "sdk-peer-range",
        `Installed ${label} satisfies the installed Kinde SDK peer range.`,
      );
    } else if (compatible === false) {
      add(
        messages,
        "ERROR",
        "sdk-peer-range",
        `Installed ${label} does not satisfy the installed Kinde SDK peer range.`,
      );
    } else {
      add(
        messages,
        "WARN",
        "sdk-peer-range",
        `The installed Kinde SDK ${label} peer range could not be evaluated.`,
      );
    }
  }

  const rootApp = join(root, "app");
  const srcApp = join(root, "src", "app");
  const hasRootApp = isDirectory(rootApp);
  const hasSrcApp = isDirectory(srcApp);
  let appRoot = null;

  if (hasRootApp && hasSrcApp) {
    add(
      messages,
      "ERROR",
      "app-root",
      "Both app/ and src/app/ exist; resolve the active App Router root.",
    );
  } else if (hasSrcApp) {
    appRoot = srcApp;
    add(messages, "PASS", "app-root", "Detected src/app App Router root.");
  } else if (hasRootApp) {
    appRoot = rootApp;
    add(messages, "PASS", "app-root", "Detected app App Router root.");
  } else {
    const pagesOnly =
      isDirectory(join(root, "pages")) || isDirectory(join(root, "src", "pages"));
    add(
      messages,
      "ERROR",
      "app-root",
      pagesOnly
        ? "Only a Pages Router tree was found; this skill does not apply."
        : "No app/ or src/app/ App Router tree was found.",
    );
  }

  if (appRoot) {
    const rootLayout = firstExisting(
      ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"].map((filename) =>
        join(appRoot, filename),
      ),
    );
    if (!rootLayout) {
      add(
        messages,
        "ERROR",
        "app-root",
        "The detected App Router directory has no root layout file.",
      );
    } else {
      const rootLayoutText = readText(rootLayout);
      if (
        rootLayoutText !== null &&
        /\bgetKindeServerSession\s*\(/.test(rootLayoutText)
      ) {
        add(
          messages,
          "WARN",
          "root-layout-session",
          `${safeRelative(root, rootLayout)} calls getKindeServerSession(). For shared navbar presentation, prefer a small client component with useKindeBrowserClient so child routes keep their intended rendering strategy. Keep this only when the full subtree is deliberately request-time.`,
        );
      }
    }
  }

  const env = collectEnv(root);
  if (env.files.length === 0) {
    add(
      messages,
      "WARN",
      "environment",
      "No local/example environment file was found; deployment-only values cannot be verified.",
    );
  } else {
    add(
      messages,
      "PASS",
      "environment",
      `Found ${env.files.length} environment file${env.files.length === 1 ? "" : "s"}; values were not printed.`,
    );
  }

  for (const key of REQUIRED_ENV_KEYS) {
    const entries = env.byKey.get(key) ?? [];
    const runtimeEntries = entries.filter(
      ({ filename }) => !/example|sample|template/i.test(filename),
    );
    if (runtimeEntries.length > 0) {
      add(messages, "PASS", "environment-key", `${key} is present.`);
    } else if (entries.length > 0) {
      add(
        messages,
        "WARN",
        "environment-key",
        `${key} is documented but no local runtime value was found.`,
      );
    } else {
      add(
        messages,
        "WARN",
        "environment-key",
        `${key} was not found; it may exist only in the deployment secret store.`,
      );
    }
  }

  if (env.byKey.has("NEXT_PUBLIC_KINDE_CLIENT_SECRET")) {
    add(
      messages,
      "ERROR",
      "secret-exposure",
      "NEXT_PUBLIC_KINDE_CLIENT_SECRET is present; client secrets must remain server-only.",
    );
  }

  const gitignore = readText(join(root, ".gitignore")) ?? "";
  for (const { filename, value } of env.byKey.get("KINDE_CLIENT_SECRET") ?? []) {
    const isExample = /example|sample|template/i.test(filename);
    if (isExample) {
      if (!looksLikePlaceholder(value)) {
        add(
          messages,
          "ERROR",
          "secret-exposure",
          "A KINDE_CLIENT_SECRET entry in an example/template file does not look like a placeholder.",
        );
      }
      continue;
    }

    const gitIgnored = gitIgnoreStatus(root, filename);
    const ignored =
      gitIgnored === null
        ? envFileIsIgnored(filename, gitignore)
        : gitIgnored;
    if (!ignored) {
      add(
        messages,
        "ERROR",
        "secret-exposure",
        `The environment file containing KINDE_CLIENT_SECRET is not covered by a recognized .gitignore rule (${filename}).`,
      );
    }
  }

  const apiPathEntries = env.byKey.get("KINDE_AUTH_API_PATH") ?? [];
  const distinctApiPaths = new Set(apiPathEntries.map(({ value }) => value));
  if (distinctApiPaths.size > 1) {
    add(
      messages,
      "WARN",
      "auth-api-path",
      "KINDE_AUTH_API_PATH differs across environment files; the local-precedence value is used for route validation.",
    );
  }
  const apiPath = normalizeApiPath(apiPathEntries[0]?.value);
  if (!apiPath) {
    add(
      messages,
      "ERROR",
      "auth-api-path",
      "KINDE_AUTH_API_PATH is invalid; use a leading-slash path without traversal, query, or fragment syntax.",
    );
  } else if (apiPathEntries.length > 0) {
    add(
      messages,
      "PASS",
      "auth-api-path",
      "A custom auth API path was detected and normalized without printing its value.",
    );
  } else {
    add(messages, "PASS", "auth-api-path", "Using the default /api/auth base path.");
  }

  if (appRoot && apiPath) {
    const route = firstExisting(
      routeCandidates(appRoot, apiPath, "[kindeAuth]"),
    );
    const catchAllRoute = firstExisting(
      routeCandidates(appRoot, apiPath, "[...kindeAuth]"),
    );

    if (!route) {
      add(
        messages,
        "ERROR",
        "auth-route",
        "The required [kindeAuth]/route file was not found under the configured auth API path.",
      );
      if (catchAllRoute) {
        add(
          messages,
          "WARN",
          "auth-route",
          "A catch-all [...kindeAuth] route exists; reconcile it with the current single-segment route contract.",
        );
      }
    } else {
      const routeText = readText(route) ?? "";
      if (
        !routeText.includes("@kinde-oss/kinde-auth-nextjs/server") ||
        !/\bhandleAuth\b/.test(routeText) ||
        !/export\s+const\s+GET\s*=\s*handleAuth\s*\(/.test(routeText)
      ) {
        add(
          messages,
          "ERROR",
          "auth-route",
          `${safeRelative(root, route)} does not contain the expected handleAuth GET export.`,
        );
      } else {
        add(
          messages,
          "PASS",
          "auth-route",
          `Validated ${safeRelative(root, route)}.`,
        );
      }
    }
  }

  const boundaryFiles = discoverBoundaryFiles(root);
  if (boundaryFiles.length > 1) {
    add(
      messages,
      "ERROR",
      "network-boundary",
      "Multiple proxy/middleware files were found; Next.js must have one deliberate network boundary.",
    );
  } else if (boundaryFiles.length === 0) {
    add(
      messages,
      "ERROR",
      "network-boundary",
      "No proxy.ts or middleware.ts network boundary was found.",
    );
  } else {
    const boundary = boundaryFiles[0];
    const expectedKind =
      nextMajor === null ? null : nextMajor >= 16 ? "proxy" : "middleware";
    const expectedLocation = appRoot === srcApp ? "src" : "root";

    if (expectedKind && boundary.kind !== expectedKind) {
      add(
        messages,
        "ERROR",
        "network-boundary",
        `Next.js ${nextMajor} requires ${expectedKind}.ts for this skill, but ${boundary.kind}.ts was found.`,
      );
    } else {
      add(
        messages,
        "PASS",
        "network-boundary",
        `Found ${safeRelative(root, boundary.pathname)}.`,
      );
    }

    if (appRoot && boundary.location !== expectedLocation) {
      add(
        messages,
        "ERROR",
        "network-boundary",
        "The network-boundary file is not beside the active app directory.",
      );
    }

    const boundaryText = readText(boundary.pathname) ?? "";
    if (
      !boundaryText.includes("@kinde-oss/kinde-auth-nextjs/middleware") ||
      !/\bwithAuth\b/.test(boundaryText)
    ) {
      add(
        messages,
        "ERROR",
        "network-boundary",
        "The network-boundary file does not use Kinde withAuth from the middleware export.",
      );
    }
    if (!/\bmatcher\s*:/.test(boundaryText)) {
      add(
        messages,
        "WARN",
        "network-boundary",
        "No matcher was found; verify static assets and framework internals are excluded.",
      );
    }
    if (
      nextMajor !== null &&
      nextMajor >= 16 &&
      /\bruntime\s*=\s*["']edge["']/.test(boundaryText)
    ) {
      add(
        messages,
        "ERROR",
        "network-boundary",
        "Next.js 16 proxy.ts cannot export the Edge runtime.",
      );
    }
  }

  scanCode(root, messages);

  return { root, messages };
}

function formatResult(result) {
  const labels = {
    PASS: "PASS",
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
  };
  const lines = [`Kinde Next.js validation: ${result.root}`];

  for (const message of result.messages) {
    lines.push(`[${labels[message.level]}] ${message.code}: ${message.message}`);
  }

  const errors = result.messages.filter(
    ({ level }) => level === "ERROR",
  ).length;
  const warnings = result.messages.filter(
    ({ level }) => level === "WARN",
  ).length;
  lines.push(`Summary: ${errors} error(s), ${warnings} warning(s).`);
  return lines.join("\n");
}

function writeFixtureFile(root, relativePath, content) {
  const pathname = join(root, relativePath);
  mkdirSync(dirname(pathname), { recursive: true });
  writeFileSync(pathname, content, "utf8");
}

function runSelfTest() {
  const root = mkdtempSync(join(tmpdir(), "kinde-nextjs-validator-"));
  const secretCanary = "validator-secret-canary-do-not-print";

  try {
    writeFixtureFile(
      root,
      "package.json",
      JSON.stringify(
        {
          packageManager: "npm@11.0.0",
          dependencies: {
            "@kinde-oss/kinde-auth-nextjs": "2.13.1",
            next: "16.3.0",
            react: "19.2.1",
            "react-dom": "19.2.1",
          },
        },
        null,
        2,
      ),
    );
    writeFixtureFile(root, "package-lock.json", "{}\n");
    writeFixtureFile(root, ".gitignore", ".env*\n!.env.example\n");
    writeFixtureFile(
      root,
      ".env.local",
      [
        "KINDE_CLIENT_ID=test-client",
        `KINDE_CLIENT_SECRET=${secretCanary}`,
        "KINDE_ISSUER_URL=https://example.kinde.com",
        "KINDE_SITE_URL=http://localhost:3000",
        "KINDE_POST_LOGIN_REDIRECT_URL=http://localhost:3000/dashboard",
        "KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3000",
        "",
      ].join("\n"),
    );
    writeFixtureFile(
      root,
      "node_modules/next/package.json",
      JSON.stringify({ version: "16.3.0" }),
    );
    writeFixtureFile(
      root,
      "node_modules/@kinde-oss/kinde-auth-nextjs/package.json",
      JSON.stringify({
        version: "2.13.1",
        peerDependencies: {
          next: ">=16.0.10",
          react: ">=19.2.1",
          "react-dom": ">=19.2.1",
        },
      }),
    );
    writeFixtureFile(
      root,
      "node_modules/react/package.json",
      JSON.stringify({ version: "19.2.1" }),
    );
    writeFixtureFile(
      root,
      "node_modules/react-dom/package.json",
      JSON.stringify({ version: "19.2.1" }),
    );
    writeFixtureFile(
      root,
      "src/app/layout.tsx",
      "export default function Layout({ children }) { return children; }\n",
    );
    writeFixtureFile(
      root,
      "src/app/api/auth/[kindeAuth]/route.ts",
      [
        'import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";',
        "",
        "export const GET = handleAuth();",
        "",
      ].join("\n"),
    );
    writeFixtureFile(
      root,
      "src/proxy.ts",
      [
        'import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";',
        "",
        "export default withAuth(async function proxy() {}, { publicPaths: [\"/\"] });",
        "export const config = { matcher: [\"/:path*\"] };",
        "",
      ].join("\n"),
    );

    const passingResult = validateProject(root);
    const passingOutput = formatResult(passingResult);
    const passingErrors = passingResult.messages.filter(
      ({ level }) => level === "ERROR",
    );

    if (passingOutput.includes(secretCanary)) {
      throw new Error("Self-test failed: validator output revealed a secret value.");
    }
    if (passingErrors.length > 0) {
      throw new Error(
        `Self-test failed: valid fixture produced ${passingErrors.length} error(s).`,
      );
    }

    writeFixtureFile(
      root,
      "src/app/layout.tsx",
      [
        'import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";',
        "",
        "export default async function Layout({ children }) {",
        "  const { getUser } = getKindeServerSession();",
        "  await getUser();",
        "  return children;",
        "}",
        "",
      ].join("\n"),
    );
    const rootLayoutResult = validateProject(root);
    const rootLayoutWarning = rootLayoutResult.messages.some(
      ({ code, level }) =>
        code === "root-layout-session" && level === "WARN",
    );
    if (!rootLayoutWarning) {
      throw new Error(
        "Self-test failed: root-layout server session read was not warned.",
      );
    }

    writeFixtureFile(
      root,
      "src/proxy.ts",
      [
        'import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";',
        "",
        'export const runtime = "edge";',
        "export default withAuth(async function proxy() {});",
        "",
      ].join("\n"),
    );
    const failingResult = validateProject(root);
    const edgeError = failingResult.messages.some(
      ({ level, message }) =>
        level === "ERROR" && message.includes("cannot export the Edge runtime"),
    );
    if (!edgeError) {
      throw new Error("Self-test failed: invalid Edge proxy was not rejected.");
    }

    console.log(
      "Self-test passed: valid setup accepted, root-layout session read warned, invalid Edge proxy rejected, and secret values were not emitted.",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    runSelfTest();
    return;
  }

  if (args.length > 1 || args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: node validate-kinde-nextjs.mjs [project-root]\n       node validate-kinde-nextjs.mjs --self-test",
    );
    process.exitCode = args.includes("--help") || args.includes("-h") ? 0 : 2;
    return;
  }

  const result = validateProject(args[0] ?? process.cwd());
  console.log(formatResult(result));
  const hasErrors = result.messages.some(({ level }) => level === "ERROR");
  process.exitCode = hasErrors ? 1 : 0;
}

main();
