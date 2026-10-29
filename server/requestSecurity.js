const attempts = new Map();
export function loginRateLimit(req,res,next) {
  const key=`${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;
  const now=Date.now(); const old=attempts.get(key); const item=old && old.until>now ? old : {count:0,until:now+15*60*1000};
  if(++item.count>20) { res.setHeader('Retry-After',Math.ceil((item.until-now)/1000)); return res.status(429).json({error:'Too many sign-in attempts. Please wait a few minutes and try again.'}); }
  attempts.set(key,item);
  if(attempts.size>10000) for(const [id,value] of attempts) if(value.until<now) attempts.delete(id);
  next();
}
export function allowedOrigin(origin) {
  if(!origin) return true;
  try {
    const url=new URL(origin);
    if(['chrome-extension:','moz-extension:','safari-web-extension:'].includes(url.protocol)) return true;
    const configured=['https://plothour.com','https://www.plothour.com',process.env.APP_BASE_URL,...(process.env.ALLOWED_ORIGINS || '').split(',')].filter(Boolean).map(value=>new URL(value).origin);
    if(configured.includes(url.origin)) return true;
    return process.env.NODE_ENV!=='production' && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname);
  } catch {return false;}
}

export function requestOriginAllowed(req) {
  const origin=req.get('origin');
  if(allowedOrigin(origin))return true;
  try { const url=new URL(origin);return url.protocol==='https:' && url.host===req.get('host'); }catch{return false;}
}
