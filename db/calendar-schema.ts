import {pgTable, serial, text, timestamp, index} from 'drizzle-orm/pg-core';

/** Activités publiques du calendrier, heures locales de Québec (America/Toronto). */
export const ulCalendarActivities = pgTable('ul_calendar_activities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  eventDate: text('event_date').notNull(), // YYYY-MM-DD (évite les décalages UTC)
  startTime: text('start_time').notNull(), // HH:MM, heure locale
  location: text('location').notNull(),
  category: text('category').notNull(), // jeu_libre | atelier | tournoi
  createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow(),
}, t => [index('ul_calendar_date_idx').on(t.eventDate)]);
