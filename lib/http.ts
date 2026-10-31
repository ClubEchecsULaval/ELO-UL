import { purgeCache } from "@netlify/functions";

export const PUBLIC_CACHE_TAG = "club-public-data";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Réponse JSON publique, mise en cache au CDN et purgée à chaque modification par l'administration. */
export function publicJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=600, stale-while-revalidate=120",
      "Netlify-Cache-Tag": PUBLIC_CACHE_TAG,
    },
  });
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return privateJson({ error: err.message, details: err.details }, err.status);
  }
  console.error(err);
  return privateJson({ error: "Erreur interne du serveur." }, 500);
}

export async function purgePublicCache() {
  try {
    await purgeCache({ tags: [PUBLIC_CACHE_TAG] });
  } catch (err) {
    // Hors de l'environnement Netlify (tests locaux), la purge n'est pas disponible.
    console.warn("Purge du cache impossible :", (err as Error).message);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Corps de requête JSON invalide.");
  }
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
