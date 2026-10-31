/**
 * Moteur Elo UL — fonctions pures, sans dépendance.
 *
 * Règles (documentées publiquement sur la page « Elo UL ») :
 *  - Cote initiale : 1200.
 *  - Score attendu : E = 1 / (1 + 10^((Rb - Ra) / 400)).
 *  - Nouvelle cote : R' = R + round(K × (S − E)), S = 1, ½ ou 0.
 *  - Facteur K : 40 pendant les 20 premières parties (cote provisoire),
 *    10 dès qu'un joueur a déjà atteint 2400, sinon 20.
 *  - Plancher : 100.
 *  - Les parties sont traitées dans l'ordre chronologique (date, puis numéro de partie).
 *    Les parties non cotées (rated = false) sont ignorées.
 */

export const ELO_RULES = {
  initialRating: 1200,
  provisionalGames: 20,
  kProvisional: 40,
  kStandard: 20,
  kElite: 10,
  eliteThreshold: 2400,
  floor: 100,
} as const;

export type Result = "1-0" | "0-1" | "1/2-1/2";
export const RESULTS: Result[] = ["1-0", "0-1", "1/2-1/2"];

export interface EloGameInput {
  id: number;
  playedAt: Date | string;
  whiteId: number;
  blackId: number;
  result: string;
  rated: boolean;
}

export interface EloGameOutput {
  id: number;
  whiteRatingBefore: number | null;
  whiteRatingAfter: number | null;
  blackRatingBefore: number | null;
  blackRatingAfter: number | null;
  whiteK: number | null;
  blackK: number | null;
  expectedWhite: number | null;
}

export interface EloPlayerState {
  rating: number;
  peakRating: number;
  gamesCount: number;
  wins: number;
  draws: number;
  losses: number;
  lastPlayedAt: Date | null;
}

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export function kFactor(state: Pick<EloPlayerState, "gamesCount" | "peakRating">): number {
  if (state.gamesCount < ELO_RULES.provisionalGames) return ELO_RULES.kProvisional;
  if (state.peakRating >= ELO_RULES.eliteThreshold) return ELO_RULES.kElite;
  return ELO_RULES.kStandard;
}

export function scoreFor(result: string, color: "white" | "black"): number {
  const white = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
  return color === "white" ? white : 1 - white;
}

function newState(): EloPlayerState {
  return {
    rating: ELO_RULES.initialRating,
    peakRating: ELO_RULES.initialRating,
    gamesCount: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    lastPlayedAt: null,
  };
}

export function sortGames<T extends EloGameInput>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const d = new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime();
    return d !== 0 ? d : a.id - b.id;
  });
}

/**
 * Rejoue l'intégralité des parties et retourne, pour chaque partie, les cotes avant/après,
 * ainsi que l'état final de chaque joueur. Déterministe : mêmes entrées ⇒ mêmes sorties.
 */
export function computeRatings(games: EloGameInput[], playerIds: number[] = []) {
  const states = new Map<number, EloPlayerState>();
  for (const id of playerIds) states.set(id, newState());
  const get = (id: number) => {
    let s = states.get(id);
    if (!s) {
      s = newState();
      states.set(id, s);
    }
    return s;
  };

  const results: EloGameOutput[] = [];
  for (const g of sortGames(games)) {
    if (!g.rated || g.whiteId === g.blackId || !RESULTS.includes(g.result as Result)) {
      results.push({
        id: g.id,
        whiteRatingBefore: null,
        whiteRatingAfter: null,
        blackRatingBefore: null,
        blackRatingAfter: null,
        whiteK: null,
        blackK: null,
        expectedWhite: null,
      });
      continue;
    }
    const w = get(g.whiteId);
    const b = get(g.blackId);
    const ew = expectedScore(w.rating, b.rating);
    const kw = kFactor(w);
    const kb = kFactor(b);
    const sw = scoreFor(g.result, "white");
    const sb = 1 - sw;
    const wAfter = Math.max(ELO_RULES.floor, w.rating + Math.round(kw * (sw - ew)));
    const bAfter = Math.max(ELO_RULES.floor, b.rating + Math.round(kb * (sb - (1 - ew))));

    results.push({
      id: g.id,
      whiteRatingBefore: w.rating,
      whiteRatingAfter: wAfter,
      blackRatingBefore: b.rating,
      blackRatingAfter: bAfter,
      whiteK: kw,
      blackK: kb,
      expectedWhite: Math.round(ew * 10000) / 10000,
    });

    const at = new Date(g.playedAt);
    for (const [s, after, score] of [
      [w, wAfter, sw],
      [b, bAfter, sb],
    ] as const) {
      s.rating = after;
      s.peakRating = Math.max(s.peakRating, after);
      s.gamesCount += 1;
      if (score === 1) s.wins += 1;
      else if (score === 0) s.losses += 1;
      else s.draws += 1;
      if (!s.lastPlayedAt || at > s.lastPlayedAt) s.lastPlayedAt = at;
    }
  }
  return { games: results, players: states };
}
