import { getWidgetAllowedDomains } from "@marshaldesk/db";
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { DEVELOPMENT_HOSTS } from "@/lib/visitor/development-hosts";

const WIDGET_PATH = /^\/widget\/([^/]+)/;

function frameAncestors(allowedDomains: readonly string[] | null): string {
  const hosts = allowedDomains
    ? [...new Set([...allowedDomains, ...DEVELOPMENT_HOSTS])]
    : [];
  if (hosts.length === 0) {
    return "frame-ancestors 'none'";
  }
  const sources = hosts.flatMap((domain) => [
    `http://${domain}`,
    `https://${domain}`,
    `http://${domain}:*`,
    `https://${domain}:*`,
  ]);
  return `frame-ancestors ${sources.join(" ")}`;
}

// The widget iframe is public: no auth, only a per-workspace frame-ancestors
// policy so it renders only inside the workspace's allowed domains.
async function widgetProxy(workspaceId: string): Promise<NextResponse> {
  const allowedDomains = await getWidgetAllowedDomains(workspaceId);
  const response = NextResponse.next();
  response.headers.set(
    "Content-Security-Policy",
    frameAncestors(allowedDomains),
  );
  return response;
}

const RPC_PATH = "/rpc";

// Set by the Kinde SDK at sign-in. Widget visitors never have one.
const KINDE_REFRESH_COOKIE = "refresh_token";

// Kinde sends signed-out requests to its hosted login and refreshes
// near-expiry tokens. Workspace and permission gates live in the layouts and
// the oRPC procedures. The matcher lists only protected pages, the widget, and
// the RPC endpoint.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const widget = pathname.match(WIDGET_PATH);
  if (widget?.[1]) {
    return widgetProxy(widget[1]);
  }
  if (pathname === RPC_PATH || pathname.startsWith(`${RPC_PATH}/`)) {
    // A dashboard tab calls RPCs for hours without navigating, so the access
    // token is refreshed here too. As a public path, a missing or unrefreshable
    // session passes through and the procedures answer with a typed UNAUTHORIZED.
    if (!request.cookies.has(KINDE_REFRESH_COOKIE)) {
      return NextResponse.next();
    }
    return withAuth(request, { publicPaths: [RPC_PATH] });
  }
  return withAuth(request, { isReturnToCurrentPage: true });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/welcome",
    "/widget/:path*",
    "/rpc/:path*",
  ],
};
