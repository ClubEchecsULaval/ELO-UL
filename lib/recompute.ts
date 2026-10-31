import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { games, players } from "../db/schema.js";
import { computeRatings } from "./elo.js";

/**
 * Rejoue tout l'historique des parties et met à jour les valeurs calculées
 * (cotes avant/après, facteurs K, statistiques des joueurs). Seules les lignes
 * modifiées sont écrites.
 */
export async function recomputeElo() {
  const allGames = await db.select().from(games);
  const allPlayers = await db.select().from(players);
  const computed = computeRatings(allGames, allPlayers.map((p) => p.id));
  const byId = new Map(allGames.map((g) => [g.id, g]));

  let gamesUpdated = 0;
  let playersUpdated = 0;

  await db.transaction(async (tx) => {
    for (const out of computed.games) {
      const g = byId.get(out.id)!;
      const changed =
        g.whiteRatingBefore !== out.whiteRatingBefore ||
        g.whiteRatingAfter !== out.whiteRatingAfter ||
        g.blackRatingBefore !== out.blackRatingBefore ||
        g.blackRatingAfter !== out.blackRatingAfter ||
        g.whiteK !== out.whiteK ||
        g.blackK !== out.blackK ||
        g.expectedWhite !== out.expectedWhite;
      if (!changed) continue;
      const { id, ...values } = out;
      await tx.update(games).set(values).where(eq(games.id, id));
      gamesUpdated++;
    }
    for (const p of allPlayers) {
      const s = computed.players.get(p.id)!;
      const changed =
        p.rating !== s.rating ||
        p.peakRating !== s.peakRating ||
        p.gamesCount !== s.gamesCount ||
        p.wins !== s.wins ||
        p.draws !== s.draws ||
        p.losses !== s.losses ||
        (p.lastPlayedAt?.getTime() ?? null) !== (s.lastPlayedAt?.getTime() ?? null);
      if (!changed) continue;
      await tx.update(players).set(s).where(eq(players.id, p.id));
      playersUpdated++;
    }
  });

  return { games: allGames.length, players: allPlayers.length, gamesUpdated, playersUpdated };
}

/** Recalcule en mémoire et compare aux valeurs enregistrées (vérification publique). */
export async function verifyElo() {
  const allGames = await db.select().from(games);
  const allPlayers = await db.select().from(players);
  const computed = computeRatings(allGames, allPlayers.map((p) => p.id));
  const byId = new Map(allGames.map((g) => [g.id, g]));
  const mismatches: number[] = [];
  for (const out of computed.games) {
    const g = byId.get(out.id)!;
    if (g.whiteRatingAfter !== out.whiteRatingAfter || g.blackRatingAfter !== out.blackRatingAfter) {
      mismatches.push(out.id);
    }
  }
  const playerMismatches = allPlayers.filter((p) => computed.players.get(p.id)!.rating !== p.rating).map((p) => p.id);
  return {
    ok: mismatches.length === 0 && playerMismatches.length === 0,
    gamesChecked: allGames.length,
    playersChecked: allPlayers.length,
    gameMismatches: mismatches,
    playerMismatches,
    checkedAt: new Date().toISOString(),
  };
}
