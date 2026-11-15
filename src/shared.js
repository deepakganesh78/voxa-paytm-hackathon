// Demo data shared between server copies.
// On Vercel several copies of the server run at once; they share the data through Vercel's Runtime Cache.
// For local testing, VOXA_SHARED_DIR points at a folder that several local servers use the same way.
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.VOXA_SHARED_DIR || '';
export const enabled = !!(DIR || process.env.VERCEL);
const TTL_SECONDS = 60 * 60 * 24;

let functions = null;
const vercel = async () => (functions ||= await import('@vercel/functions'));

export async function get(key) {
  if (DIR) {
    try { return JSON.parse(fs.readFileSync(path.join(DIR, key + '.json'), 'utf8')); } catch { return null; }
  }
  return (await vercel()).getCache().get(key);
}

export async function set(key, value) {
  if (DIR) {
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, key + '.json');
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
    return;
  }
  await (await vercel()).getCache().set(key, value, { ttl: TTL_SECONDS });
}

// lets a publish started by a timer finish even after the response has been sent
export function keepAlive(promise) {
  if (!process.env.VERCEL) return;
  vercel().then((m) => m.waitUntil(promise)).catch(() => {});
}

// Copies the shared data into the live object, keeping the objects that are already there (matched by id).
// The engine's timers hold on to those objects, so they must stay the same objects.
export function mergeInto(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const byId = new Map(target.filter((x) => x && typeof x === 'object' && x.id !== undefined).map((x) => [x.id, x]));
    const next = source.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item) && item.id !== undefined && byId.has(item.id)) {
        mergeInto(byId.get(item.id), item);
        return byId.get(item.id);
      }
      return item;
    });
    target.splice(0, target.length, ...next);
    return target;
  }
  if (target && source && typeof target === 'object' && typeof source === 'object' && !Array.isArray(target) && !Array.isArray(source)) {
    for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
    for (const [key, value] of Object.entries(source)) {
      const current = target[key];
      const bothObjects = current && value && typeof current === 'object' && typeof value === 'object' && Array.isArray(current) === Array.isArray(value);
      if (bothObjects) mergeInto(current, value);
      else target[key] = value;
    }
    return target;
  }
  return source;
}
