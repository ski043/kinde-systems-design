import "server-only";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

/** The signed-in person, from the verified Kinde access and ID tokens. */
export type KindeSession = {
  kindeUserId: string;
  email: string;
  /** From the ID token. Only a verified email can accept an invitation. */
  emailVerified: boolean;
  name: string;
  picture: string | null;
  /** The token's organization. Null when the person signed in without one. */
  orgCode: string | null;
  /** The token's `permissions` claim: a snapshot from when it was issued. */
  permissions: readonly string[];
  tokenIssuedAt: Date;
};

/** Reads the session from the request cookies. The SDK verifies both tokens' signatures and issuer. */
export async function getKindeSession(): Promise<KindeSession | null> {
  const { getAccessToken, getIdToken, getUser } = getKindeServerSession();
  const [token, idToken, user] = await Promise.all([
    getAccessToken(),
    getIdToken(),
    getUser(),
  ]);
  if (!token || !user?.email || token.sub !== user.id) return null;

  const name = [user.given_name, user.family_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
  return {
    kindeUserId: user.id,
    email: user.email,
    emailVerified:
      idToken?.sub === user.id &&
      idToken.email === user.email &&
      idToken.email_verified === true,
    name: name || user.email,
    picture: user.picture || null,
    orgCode: token.org_code || null,
    permissions: token.permissions ?? [],
    tokenIssuedAt: new Date(token.iat * 1000),
  };
}
