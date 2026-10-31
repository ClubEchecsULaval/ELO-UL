import type { Config, Context } from "@netlify/functions";
import { and, asc, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { events, games, news, players, registrations } from "../../db/schema.js";
import { ELO_RULES } from "../../lib/elo.js";
import { errorResponse, HttpError, publicJson, privateJson } from "../../lib/http.js";
import { verifyElo } from "../../lib/recompute.js";
import { currentSession } from "../../lib/auth.js";

/**
 * API publique en lecture seule. Ne renvoie jamais d'adresse courriel ni de donnée
 * privée : les inscriptions ne sont publiées que sous forme de nom, et seulement
 * si la personne y a consenti.
 */

const ACTIVE_DAYS = 90;
const DAY = 86_400_000;

const publicPlayer = {
  id: players.id,
  slug: players.slug,
  name: players.name,
  status: players.status,
  program: players.program,
  rating: players.rating,
  peakRating: players.peakRating,
  gamesCount: players.gamesCount,
  wins: players.wins,
  draws: players.draws,
  losses: players.losses,
  lastPlayedAt: players.lastPlayedAt,
  isDemo: players.isDemo,
};

const publicEvent = {
  id: events.id,
  slug: events.slug,
  title: events.title,
  type: events.type,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  location: events.location,
  summary: events.summary,
  timeControl: events.timeControl,
  rounds: events.rounds,
  capacity: events.capacity,
  fee: events.fee,
  registrationOpen: events.registrationOpen,
  registrationDeadline: events.registrationDeadline,
  rated: events.rated,
  cancelled: events.cancelled,
  isDemo: events.isDemo,
};

function isActive(lastPlayedAt: Date | null) {
  return !!lastPlayedAt && Date.now() - lastPlayedAt.getTime() <= ACTIVE_DAYS * DAY;
}

async function registrationCounts() {
  const rows = await db
    .select({ eventId: registrations.eventId, count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(or(eq(registrations.status, "confirmee"), eq(registrations.status, "en_attente")))
    .groupBy(registrations.eventId);
  return new Map(rows.map((r) => [r.eventId, r.count]));
}

/** Classement complet avec variation sur 30 jours, calculée depuis l'historique des parties. */
async function ranking() {
  const list = await db.select(publicPlayer).from(players).orderBy(desc(players.rating), asc(players.name));
  const since = new Date(Date.now() - 30 * DAY);
  const recent = await db
    .select({
      whiteId: games.whiteId,
      blackId: games.blackId,
      wb: games.whiteRatingBefore,
      bb: games.blackRatingBefore,
      playedAt: games.playedAt,
      id: games.id,
    })
    .from(games)
    .where(and(eq(games.rated, true), gte(games.playedAt, since)))
    .orderBy(asc(games.playedAt), asc(games.id));
  const ratingAtStart = new Map<number, number>();
  for (const g of recent) {
    if (g.wb != null && !ratingAtStart.has(g.whiteId)) ratingAtStart.set(g.whiteId, g.wb);
    if (g.bb != null && !ratingAtStart.has(g.blackId)) ratingAtStart.set(g.blackId, g.bb);
  }
  let rank = 0;
  return list.map((p) => ({
    ...p,
    rank: p.gamesCount > 0 ? ++rank : null,
    active: isActive(p.lastPlayedAt),
    provisional: p.gamesCount < ELO_RULES.provisionalGames,
    change30: ratingAtStart.has(p.id) ? p.rating - ratingAtStart.get(p.id)! : 0,
  }));
}

async function gamesWithNames(where?: ReturnType<typeof and>, limit?: number) {
  const q = db
    .select({
      id: games.id,
      playedAt: games.playedAt,
      result: games.result,
      round: games.round,
      rated: games.rated,
      timeControl: games.timeControl,
      eventId: games.eventId,
      whiteId: games.whiteId,
      blackId: games.blackId,
      whiteRatingBefore: games.whiteRatingBefore,
      whiteRatingAfter: games.whiteRatingAfter,
      blackRatingBefore: games.blackRatingBefore,
      blackRatingAfter: games.blackRatingAfter,
      whiteK: games.whiteK,
      blackK: games.blackK,
      expectedWhite: games.expectedWhite,
      isDemo: games.isDemo,
    })
    .from(games)
    .where(where)
    .orderBy(desc(games.playedAt), desc(games.id));
  const rows = limit ? await q.limit(limit) : await q;
  if (!rows.length) return [];
  const names = await db.select({ id: players.id, name: players.name, slug: players.slug }).from(players);
  const byId = new Map(names.map((p) => [p.id, p]));
  const evs = await db.select({ id: events.id, title: events.title, slug: events.slug }).from(events);
  const evById = new Map(evs.map((e) => [e.id, e]));
  return rows.map((g) => ({
    ...g,
    white: byId.get(g.whiteId) ?? null,
    black: byId.get(g.blackId) ?? null,
    event: g.eventId ? evById.get(g.eventId) ?? null : null,
  }));
}

function standingsFor(eventGames: Awaited<ReturnType<typeof gamesWithNames>>) {
  const table = new Map<number, { player: { id: number; name: string; slug: string }; points: number; played: number; opponents: number[] }>();
  const row = (p: { id: number; name: string; slug: string }) => {
    if (!table.has(p.id)) table.set(p.id, { player: p, points: 0, played: 0, opponents: [] });
    return table.get(p.id)!;
  };
  for (const g of eventGames) {
    if (!g.white || !g.black) continue;
    const w = row(g.white);
    const b = row(g.black);
    const sw = g.result === "1-0" ? 1 : g.result === "0-1" ? 0 : 0.5;
    w.points += sw;
    b.points += 1 - sw;
    w.played++;
    b.played++;
    w.opponents.push(b.player.id);
    b.opponents.push(w.player.id);
  }
  const rows = [...table.values()].map((r) => ({
    ...r,
    // Départage Buchholz : somme des points des adversaires rencontrés.
    buchholz: r.opponents.reduce((s, id) => s + (table.get(id)?.points ?? 0), 0),
  }));
  rows.sort((a, b) => b.points - a.points || b.buchholz - a.buchholz || a.player.name.localeCompare(b.player.name, "fr"));
  return rows.map(({ opponents, ...r }, i) => ({ ...r, rank: i + 1 }));
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

async function route(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "");
  const seg = path.split("/").slice(2); // après "/api"
  const [a, b] = seg;
  const now = new Date();

  if (a === "session") {
    return privateJson({ session: await currentSession() });
  }

  if (a === "accueil") {
    const [upcoming, latest, rank, stats] = await Promise.all([
      db
        .select(publicEvent)
        .from(events)
        .where(and(eq(events.published, true), eq(events.cancelled, false), gte(events.startsAt, new Date(now.getTime() - 3 * 3600_000))))
        .orderBy(asc(events.startsAt))
        .limit(4),
      db
        .select({ slug: news.slug, title: news.title, excerpt: news.excerpt, category: news.category, publishedAt: news.publishedAt, isDemo: news.isDemo })
        .from(news)
        .where(and(eq(news.published, true), lte(news.publishedAt, now)))
        .orderBy(desc(news.publishedAt))
        .limit(3),
      ranking(),
      db.select({ count: sql<number>`count(*)::int` }).from(games).where(eq(games.rated, true)),
    ]);
    const ranked = rank.filter((p) => p.rank !== null);
    return publicJson({
      nextEvent: upcoming[0] ?? null,
      upcoming: upcoming.slice(1),
      news: latest,
      top: ranked.slice(0, 5),
      stats: {
        players: ranked.length,
        activePlayers: ranked.filter((p) => p.active).length,
        games: stats[0]?.count ?? 0,
      },
      hasDemo: rank.some((p) => p.isDemo) || latest.some((n) => n.isDemo) || upcoming.some((e) => e.isDemo),
    });
  }

  if (a === "evenements" && !b) {
    const from = url.searchParams.get("de");
    const to = url.searchParams.get("a");
    const conds = [eq(events.published, true)];
    if (from) conds.push(gte(events.startsAt, new Date(from)));
    if (to) conds.push(lte(events.startsAt, new Date(to)));
    const type = url.searchParams.get("type");
    if (type) conds.push(eq(events.type, type));
    const [list, counts] = await Promise.all([
      db.select(publicEvent).from(events).where(and(...conds)).orderBy(asc(events.startsAt)),
      registrationCounts(),
    ]);
    return publicJson({ events: list.map((e) => ({ ...e, registered: counts.get(e.id) ?? 0 })) });
  }

  if (a === "evenements" && b) {
    const [event] = await db
      .select({ ...publicEvent, description: events.description, rules: events.rules })
      .from(events)
      .where(and(eq(events.slug, b), eq(events.published, true)));
    if (!event) throw new HttpError(404, "Événement introuvable.");
    const regs = await db
      .select({ name: registrations.name, status: registrations.status, showPublicly: registrations.showPublicly, playerId: registrations.playerId })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .orderBy(asc(registrations.createdAt));
    const active = regs.filter((r) => r.status === "confirmee" || r.status === "en_attente");
    const eventGames = await gamesWithNames(eq(games.eventId, event.id));
    return publicJson({
      event,
      participants: {
        confirmed: regs.filter((r) => r.status === "confirmee").length,
        pending: regs.filter((r) => r.status === "en_attente").length,
        total: active.length,
        // Seuls les noms des personnes ayant consenti à l'affichage sont publiés.
        names: regs.filter((r) => r.status === "confirmee" && r.showPublicly).map((r) => r.name),
      },
      games: eventGames,
      standings: standingsFor(eventGames),
    });
  }

  if (a === "nouvelles" && !b) {
    const cat = url.searchParams.get("categorie");
    const conds = [eq(news.published, true), lte(news.publishedAt, now)];
    if (cat) conds.push(eq(news.category, cat));
    const list = await db
      .select({ slug: news.slug, title: news.title, excerpt: news.excerpt, category: news.category, author: news.author, publishedAt: news.publishedAt, isDemo: news.isDemo })
      .from(news)
      .where(and(...conds))
      .orderBy(desc(news.publishedAt));
    return publicJson({ news: list });
  }

  if (a === "nouvelles" && b) {
    const [item] = await db
      .select()
      .from(news)
      .where(and(eq(news.slug, b), eq(news.published, true), lte(news.publishedAt, now)));
    if (!item) throw new HttpError(404, "Article introuvable.");
    return publicJson({ article: item });
  }

  if (a === "classement" || (a === "joueurs" && !b)) {
    return publicJson({ players: await ranking(), rules: ELO_RULES, activeDays: ACTIVE_DAYS });
  }

  if (a === "joueurs" && b) {
    const [player] = await db
      .select({ ...publicPlayer, bio: players.bio, fideId: players.fideId, cfcId: players.cfcId, createdAt: players.createdAt })
      .from(players)
      .where(eq(players.slug, b));
    if (!player) throw new HttpError(404, "Joueur introuvable.");
    const history = await gamesWithNames(or(eq(games.whiteId, player.id), eq(games.blackId, player.id)));
    const all = await ranking();
    const me = all.find((p) => p.id === player.id);
    return publicJson({
      player: { ...player, rank: me?.rank ?? null, active: me?.active ?? false, provisional: me?.provisional ?? true, change30: me?.change30 ?? 0 },
      games: history,
      rules: ELO_RULES,
    });
  }

  if (a === "parties") {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limite")) || 20));
    return publicJson({ games: await gamesWithNames(undefined, limit) });
  }

  if (a === "elo" && b === "verifier") {
    return privateJson(await verifyElo());
  }

  if (a === "calendrier.ics") {
    const list = await db
      .select(publicEvent)
      .from(events)
      .where(and(eq(events.published, true), gte(events.startsAt, new Date(now.getTime() - 60 * DAY))))
      .orderBy(asc(events.startsAt));
    const origin = url.origin;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Club d'echecs de l'Universite Laval//Calendrier//FR",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Club d'échecs ULaval",
      ...list.flatMap((e) => [
        "BEGIN:VEVENT",
        `UID:evenement-${e.id}@clubechecsulaval`,
        `DTSTAMP:${icsDate(now)}`,
        `DTSTART:${icsDate(e.startsAt)}`,
        `DTEND:${icsDate(e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600_000))}`,
        `SUMMARY:${icsEscape((e.cancelled ? "[ANNULÉ] " : "") + e.title)}`,
        e.location ? `LOCATION:${icsEscape(e.location)}` : "",
        e.summary ? `DESCRIPTION:${icsEscape(e.summary)}` : "",
        `URL:${origin}${e.type === "tournoi" ? `/tournois/${e.slug}` : `/calendrier/?evenement=${e.slug}`}`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].filter(Boolean);
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="club-echecs-ulaval.ics"',
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=600",
      },
    });
  }

  throw new HttpError(404, "Ressource introuvable.");
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return privateJson({ error: "Méthode non permise." }, 405);
  }
  try {
    return await route(req, new URL(req.url));
  } catch (err) {
    return errorResponse(err);
  }
};

export const config: Config = {
  path: "/api/*",
  excludedPath: ["/api/admin/*", "/api/inscriptions", "/api/contact"],
};
