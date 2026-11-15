// WhatsApp as a linked device (like WhatsApp Web), using the open-source Baileys library.
// The shop's WhatsApp scans a QR once (WhatsApp → Linked devices); then Voxa sends and receives from that number.
// Free, but NOT an official WhatsApp API: use a spare or demo number, not someone's main one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.data', 'wa-auth');
let B = null, sock = null, starting = false, onMsg = null, onState = null;
export const link = { status: 'off', qr: null, me: null, error: null };
const setLink = (patch) => {
  const before = link.status;
  Object.assign(link, patch);
  if (patch.status && patch.status !== before) console.log(`[whatsapp link] ${patch.status}${link.me ? ' as ' + link.me : ''}${link.error ? ' (' + link.error + ')' : ''}`);
  onState && onState(link);
};

const textOf = (m) => {
  const x = m.message || {};
  const inner = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x;
  return inner.conversation || inner.extendedTextMessage?.text || inner.imageMessage?.caption
    || inner.buttonsResponseMessage?.selectedDisplayText || inner.listResponseMessage?.title || '';
};

export async function start({ onMessage, onStatus }) {
  onMsg = onMessage; onState = onStatus;
  if (starting || sock) return;
  starting = true;
  try {
    B = B || (await import('@whiskeysockets/baileys'));
    const makeWASocket = B.default || B.makeWASocket;
    const pino = (await import('pino')).default;
    fs.mkdirSync(DIR, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(DIR);
    setLink({ status: 'connecting', error: null });
    // use the WhatsApp Web version WhatsApp currently expects; an old one can make the phone refuse to link
    let version;
    try { const v = await (B.fetchLatestWaWebVersion || B.fetchLatestBaileysVersion)(); version = v.version; console.log('[whatsapp link] using WhatsApp Web version', version.join('.')); } catch { /* fall back to the built-in one */ }
    sock = makeWASocket({ ...(version ? { version } : {}), auth: state, logger: pino({ level: 'silent' }), browser: B.Browsers.windows ? B.Browsers.windows('Chrome') : B.Browsers.appropriate('Chrome'), markOnlineOnConnect: false, syncFullHistory: false });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
      if (u.qr) setLink({ status: 'scan', qr: u.qr });
      if (u.connection === 'open') {
        const num = String(sock.user?.id || '').split(':')[0].split('@')[0];
        setLink({ status: 'connected', qr: null, me: num ? '+' + num : null, error: null });
      }
      if (u.connection === 'close') {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        console.log('[whatsapp link] closed, code', code, u.lastDisconnect?.error?.message || '');
        sock = null;
        if (code === B.DisconnectReason.loggedOut) {
          // unlinked from the phone: forget the session and show a fresh QR
          try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {}
          setLink({ status: 'logged_out', me: null, qr: null });
        } else {
          setLink({ status: 'reconnecting', error: u.lastDisconnect?.error?.message || null });
        }
        setTimeout(() => start({ onMessage: onMsg, onStatus: onState }).catch(() => {}), 2500);
      }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        const jid = m.key.remoteJid || '';
        if (m.key.fromMe || !jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
        const text = textOf(m).trim();
        if (!text) continue;
        // v7 may hide the phone behind a private id (@lid); the real number is then in remoteJidAlt
        const pn = jid.endsWith('@s.whatsapp.net') ? jid : (m.key.remoteJidAlt || '').endsWith('@s.whatsapp.net') ? m.key.remoteJidAlt : null;
        const phone = pn ? '+' + pn.split('@')[0] : 'lid:' + jid.split('@')[0];
        try { await onMsg && onMsg({ phone, jid, name: m.pushName || '', text, id: m.key.id }); } catch (e) { console.error('whatsapp in', e.message); }
      }
    });
  } catch (e) {
    sock = null;
    setLink({ status: 'error', error: e.message });
  } finally {
    starting = false;
  }
}

export async function send(jid, text) {
  if (!sock || link.status !== 'connected') throw new Error('WhatsApp is not linked yet (scan the QR on the Customers page)');
  const r = await sock.sendMessage(jid, { text: String(text) });
  return r?.key?.id || null;
}

export async function logout() {
  try { if (sock) await sock.logout(); } catch {}
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {}
  sock = null;
  setLink({ status: 'logged_out', me: null, qr: null });
  setTimeout(() => start({ onMessage: onMsg, onStatus: onState }).catch(() => {}), 1000);
}
