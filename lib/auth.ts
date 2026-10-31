import { getUser, type User } from "@netlify/identity";
import { HttpError } from "./http.js";

export const ADMIN_ROLE = "admin";

function rolesOf(user: User): string[] {
  const roles = new Set<string>(user.roles ?? []);
  const meta = user.appMetadata as { roles?: unknown; authorization?: { roles?: unknown } } | undefined;
  for (const source of [meta?.roles, meta?.authorization?.roles]) {
    if (Array.isArray(source)) source.forEach((r) => typeof r === "string" && roles.add(r));
  }
  return [...roles];
}

/**
 * Vérifie côté serveur que la requête provient d'un compte Netlify Identity
 * portant le rôle « admin ». Le jeton (cookie nf_jwt) est validé par la plateforme ;
 * aucun secret n'est exposé au navigateur.
 */
export async function requireAdmin(): Promise<{ email: string; roles: string[] }> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Connexion requise.");
  const roles = rolesOf(user);
  if (!roles.includes(ADMIN_ROLE)) {
    throw new HttpError(403, "Ce compte n'a pas le rôle « admin ».");
  }
  return { email: user.email ?? user.id, roles };
}

export async function currentSession() {
  const user = await getUser();
  if (!user) return null;
  const roles = rolesOf(user);
  return { email: user.email ?? null, name: user.name ?? null, roles, isAdmin: roles.includes(ADMIN_ROLE) };
}
