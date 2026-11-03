import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
const COOKIE = 'ul_club_tournament_session';
const TTL = 8*3600;
const digest = text => createHash('sha256').update(text).digest();
function safeCompare(a,b){return timingSafeEqual(digest(String(a)),digest(String(b)));}
function configured() {return Boolean(process.env.TOURNAMENT_ADMIN_CODE && process.env.TOURNAMENT_SESSION_SECRET && process.env.TOURNAMENT_SESSION_SECRET.length>=32);}
export function checkCode(input){return configured() && typeof input==='string' && safeCompare(input,process.env.TOURNAMENT_ADMIN_CODE);}
function sign(v){return createHmac('sha256',process.env.TOURNAMENT_SESSION_SECRET).update(v).digest('base64url');}
function cookieValue(req){const c=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));return c?.slice(COOKIE.length+1)||'';}
export function isAdmin(req){
  if(!configured())return false;
  const parts=cookieValue(req).split('.'); if(parts.length!==3 || parts[0]!=='v1')return false;
  const exp=Number(parts[1]); if(!Number.isSafeInteger(exp)||exp<=Date.now()/1000)return false;
  return safeCompare(parts[2], sign(parts[0]+'.'+parts[1]));
}
export function sessionCookie(req){const exp=Math.floor(Date.now()/1000)+TTL;const payload='v1.'+exp;
  const secure=new URL(req.url).protocol==='https:'?'; Secure':'';
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/club-api/tournois; HttpOnly; SameSite=Strict; Max-Age=${TTL}${secure}`;
}
export function clearCookie(req){const secure=new URL(req.url).protocol==='https:'?'; Secure':'';return `${COOKIE}=; Path=/club-api/tournois; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;}
export function sameOrigin(req){ const origin=req.headers.get('origin');const url=new URL(req.url);return !origin || origin===url.origin; }
export function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});}
