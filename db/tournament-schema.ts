import {pgTable,serial,text,integer,timestamp,boolean,uniqueIndex,index} from 'drizzle-orm/pg-core';

export const ulTournaments=pgTable('ul_tournaments',{
 id:serial('id').primaryKey(),name:text('name').notNull(),format:text('format').notNull().default('swiss'),roundsPlanned:integer('rounds_planned').notNull(),
 status:text('status').notNull().default('draft'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[index('ul_tournaments_status_idx').on(t.status)]);
export const ulTournamentPlayers=pgTable('ul_tournament_players',{
 id:serial('id').primaryKey(),tournamentId:integer('tournament_id').notNull().references(()=>ulTournaments.id,{onDelete:'cascade'}),
 name:text('name').notNull(),normalizedName:text('normalized_name').notNull(),seedRating:integer('seed_rating').notNull().default(1200),
},t=>[uniqueIndex('ul_tournament_players_name_unq').on(t.tournamentId,t.normalizedName)]);
export const ulTournamentRounds=pgTable('ul_tournament_rounds',{
 id:serial('id').primaryKey(),tournamentId:integer('tournament_id').notNull().references(()=>ulTournaments.id,{onDelete:'cascade'}),
 number:integer('number').notNull(),status:text('status').notNull().default('active'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('ul_tournament_rounds_num_unq').on(t.tournamentId,t.number)]);
export const ulTournamentPairings=pgTable('ul_tournament_pairings',{
 id:serial('id').primaryKey(),roundId:integer('round_id').notNull().references(()=>ulTournamentRounds.id,{onDelete:'cascade'}),
 board:integer('board'),whitePlayerId:integer('white_player_id').notNull().references(()=>ulTournamentPlayers.id,{onDelete:'restrict'}),
 blackPlayerId:integer('black_player_id').references(()=>ulTournamentPlayers.id,{onDelete:'restrict'}),result:text('result'),
},t=>[index('ul_tournament_pairings_round_idx').on(t.roundId)]);
