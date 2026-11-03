-- Calendrier des activités, indépendant des résultats Elo et des tournois.
-- Heures en heure locale de Québec; la date est conservée sans conversion UTC.
CREATE TABLE IF NOT EXISTS ul_calendar_activities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL CHECK (event_date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time TEXT NOT NULL CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('jeu_libre','atelier','tournoi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ul_calendar_date_idx ON ul_calendar_activities (event_date);
