import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  real,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Toutes les tables de contenu ont une colonne `is_demo` : les données fictives
 * livrées avec la première version sont ainsi signalées sur le site public et
 * peuvent être supprimées d'un seul clic depuis l'administration.
 */

export const players = pgTable(
  "players",
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    // membre | invite | ancien
    status: text().notNull().default("membre"),
    program: text(),
    bio: text(),
    fideId: text("fide_id"),
    cfcId: text("cfc_id"),
    // Valeurs mises en cache par le recalcul Elo (source de vérité : la table games).
    rating: integer().notNull().default(1200),
    peakRating: integer("peak_rating").notNull().default(1200),
    gamesCount: integer("games_count").notNull().default(0),
    wins: integer().notNull().default(0),
    draws: integer().notNull().default(0),
    losses: integer().notNull().default(0),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("players_rating_idx").on(t.rating)],
);

export const events = pgTable(
  "events",
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    // soiree | tournoi | atelier | special
    type: text().notNull().default("soiree"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text(),
    summary: text(),
    description: text(),
    rules: text(),
    timeControl: text("time_control"),
    rounds: integer(),
    capacity: integer(),
    fee: text(),
    registrationOpen: boolean("registration_open").notNull().default(false),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    // Les parties d'un tournoi comptent pour le classement Elo UL si vrai.
    rated: boolean().notNull().default(true),
    cancelled: boolean().notNull().default(false),
    published: boolean().notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_starts_at_idx").on(t.startsAt)],
);

export const games = pgTable(
  "games",
  {
    id: serial().primaryKey(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    whiteId: integer("white_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    blackId: integer("black_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    // "1-0" | "0-1" | "1/2-1/2"
    result: text().notNull(),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    round: integer(),
    rated: boolean().notNull().default(true),
    timeControl: text("time_control"),
    notes: text(),
    pgn: text(),
    // Valeurs calculées par le moteur Elo, conservées pour rendre chaque variation vérifiable.
    whiteRatingBefore: integer("white_rating_before"),
    whiteRatingAfter: integer("white_rating_after"),
    blackRatingBefore: integer("black_rating_before"),
    blackRatingAfter: integer("black_rating_after"),
    whiteK: integer("white_k"),
    blackK: integer("black_k"),
    expectedWhite: real("expected_white"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("games_played_at_idx").on(t.playedAt),
    index("games_white_idx").on(t.whiteId),
    index("games_black_idx").on(t.blackId),
    index("games_event_idx").on(t.eventId),
  ],
);

export const registrations = pgTable(
  "registrations",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    playerId: integer("player_id").references(() => players.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text().notNull(),
    // etudiant | employe | diplome | externe
    affiliation: text().notNull().default("etudiant"),
    ratingEstimate: integer("rating_estimate"),
    message: text(),
    // en_attente | confirmee | refusee | annulee
    status: text().notNull().default("en_attente"),
    showPublicly: boolean("show_publicly").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("registrations_event_idx").on(t.eventId)],
);

export const news = pgTable(
  "news",
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    // annonce | article | resultats | vie-du-club
    category: text().notNull().default("annonce"),
    excerpt: text(),
    body: text().notNull().default(""),
    author: text(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("news_published_at_idx").on(t.publishedAt)],
);

export const messages = pgTable("messages", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  subject: text(),
  body: text().notNull(),
  handled: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial().primaryKey(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  actor: text().notNull(),
  action: text().notNull(),
  entity: text().notNull(),
  entityId: integer("entity_id"),
  details: jsonb(),
});
