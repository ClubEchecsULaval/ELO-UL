-- Modification additive : conserve les anciens tournois, joueurs et appariements.
-- Les participants déjà enregistrés restent actifs par défaut.
ALTER TABLE ul_tournament_players
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
