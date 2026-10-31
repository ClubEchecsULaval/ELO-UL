-- New independent tables; does not modify the existing Elo UL tables.
CREATE TABLE ul_tournaments (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'swiss', rounds_planned INTEGER NOT NULL CHECK(rounds_planned BETWEEN 1 AND 15),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','finished')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ul_tournaments_status_idx ON ul_tournaments(status);
CREATE TABLE ul_tournament_players (
 id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES ul_tournaments(id) ON DELETE CASCADE,
 name TEXT NOT NULL, normalized_name TEXT NOT NULL, seed_rating INTEGER NOT NULL DEFAULT 1200 CHECK(seed_rating BETWEEN 0 AND 3500),
 CONSTRAINT ul_tournament_players_name_unq UNIQUE(tournament_id,normalized_name)
);
CREATE TABLE ul_tournament_rounds (
 id SERIAL PRIMARY KEY, tournament_id INTEGER NOT NULL REFERENCES ul_tournaments(id) ON DELETE CASCADE,
 number INTEGER NOT NULL CHECK(number >= 1),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finished')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT ul_tournament_rounds_num_unq UNIQUE(tournament_id,number)
);
CREATE TABLE ul_tournament_pairings (
 id SERIAL PRIMARY KEY,round_id INTEGER NOT NULL REFERENCES ul_tournament_rounds(id) ON DELETE CASCADE,
 board INTEGER,white_player_id INTEGER NOT NULL REFERENCES ul_tournament_players(id) ON DELETE RESTRICT,
 black_player_id INTEGER REFERENCES ul_tournament_players(id) ON DELETE RESTRICT,
 result TEXT CHECK(result IS NULL OR result IN ('1-0','0-1','1/2-1/2','BYE')),
 CHECK(black_player_id IS NULL OR white_player_id <> black_player_id)
);
CREATE INDEX ul_tournament_pairings_round_idx ON ul_tournament_pairings(round_id);
