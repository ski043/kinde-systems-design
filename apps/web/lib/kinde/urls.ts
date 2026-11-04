import { routes } from "@/lib/routes";

const AUTH_API_PATH = "/api/auth";

export const kindeRoutes = {
  login: `${AUTH_API_PATH}/login`,
  register: `${AUTH_API_PATH}/register`,
  logout: `${AUTH_API_PATH}/logout`,
} as const;

/** Signs in again, into the given organization, then opens the dashboard. */
export function signInToOrganizationUrl(orgCode: string): string {
  const params = new URLSearchParams({
    org_code: orgCode,
    post_login_redirect_url: routes.dashboard,
  });
  return `${kindeRoutes.login}?${params}`;
}
