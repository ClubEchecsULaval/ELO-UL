import type { Config } from "@netlify/functions";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { events, messages, registrations } from "../../db/schema.js";
import { EMAIL_RE, errorResponse, HttpError, privateJson, purgePublicCache, readJson } from "../../lib/http.js";

const AFFILIATIONS = ["etudiant", "employe", "diplome", "externe"];

function text(body: Record<string, unknown>, key: string, { required = false, max = 500 } = {}) {
  const raw = body[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (required && !value) throw new HttpError(422, "Champ obligatoire manquant.", { field: key });
  if (value.length > max) throw new HttpError(422, "Texte trop long.", { field: key });
  return value || null;
}

async function inscription(body: Record<string, unknown>) {
  const name = text(body, "name", { required: true, max: 120 })!;
  const email = text(body, "email", { required: true, max: 200 })!.toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(422, "Adresse courriel invalide.", { field: "email" });
  const affiliation = text(body, "affiliation", { max: 20 }) ?? "etudiant";
  if (!AFFILIATIONS.includes(affiliation)) throw new HttpError(422, "Affiliation invalide.", { field: "affiliation" });
  const ratingRaw = body.ratingEstimate;
  const ratingEstimate = ratingRaw === "" || ratingRaw == null ? null : Number(ratingRaw);
  if (ratingEstimate !== null && (!Number.isInteger(ratingEstimate) || ratingEstimate < 100 || ratingEstimate > 3000)) {
    throw new HttpError(422, "Cote estimée invalide (100 à 3000).", { field: "ratingEstimate" });
  }
  const message = text(body, "message", { max: 1000 });
  const showPublicly = body.showPublicly === true || body.showPublicly === "on";
  const slug = text(body, "event", { required: true, max: 120 })!;

  const [event] = await db.select().from(events).where(and(eq(events.slug, slug), eq(events.published, true)));
  if (!event) throw new HttpError(404, "Événement introuvable.");
  if (!event.registrationOpen || event.cancelled) throw new HttpError(409, "Les inscriptions sont fermées pour cet événement.");
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new HttpError(409, "La date limite d'inscription est passée.");
  }
  if (event.startsAt < new Date()) throw new HttpError(409, "Cet événement a déjà commencé.");

  const [dup] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.eventId, event.id), sql`lower(${registrations.email}) = ${email}`));
  if (dup) throw new HttpError(409, "Cette adresse courriel est déjà inscrite à cet événement.");

  let status = "en_attente";
  if (event.capacity) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrations)
      .where(and(eq(registrations.eventId, event.id), or(eq(registrations.status, "confirmee"), eq(registrations.status, "en_attente"))));
    if (count >= event.capacity) status = "liste_attente";
  }

  await db.insert(registrations).values({
    eventId: event.id,
    name,
    email,
    affiliation,
    ratingEstimate,
    message,
    showPublicly,
    status,
  });
  await purgePublicCache();
  return privateJson(
    {
      ok: true,
      status,
      message:
        status === "liste_attente"
          ? "L'événement est complet : vous êtes inscrit·e sur la liste d'attente. Le comité vous contactera si une place se libère."
          : "Inscription reçue. Le comité la confirmera par courriel.",
    },
    201,
  );
}

async function contact(body: Record<string, unknown>) {
  const name = text(body, "name", { required: true, max: 120 })!;
  const email = text(body, "email", { required: true, max: 200 })!;
  if (!EMAIL_RE.test(email)) throw new HttpError(422, "Adresse courriel invalide.", { field: "email" });
  const subject = text(body, "subject", { max: 200 });
  const content = text(body, "body", { required: true, max: 4000 })!;
  await db.insert(messages).values({ name, email, subject, body: content });
  return privateJson({ ok: true, message: "Merci ! Votre message a été transmis au comité." }, 201);
}

export default async (req: Request) => {
  if (req.method !== "POST") return privateJson({ error: "Méthode non permise." }, 405);
  try {
    const body = await readJson(req);
    // Champ piège invisible pour les robots : une valeur signifie un envoi automatisé.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return privateJson({ ok: true, message: "Merci !" }, 201);
    }
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    if (path === "/api/inscriptions") return await inscription(body);
    if (path === "/api/contact") return await contact(body);
    throw new HttpError(404, "Ressource introuvable.");
  } catch (err) {
    return errorResponse(err);
  }
};

export const config: Config = {
  path: ["/api/inscriptions", "/api/contact"],
  method: "POST",
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
