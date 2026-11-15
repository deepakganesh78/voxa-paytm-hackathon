# Local setup record

Last updated: 2026-11-15

## What was set up

- Installed Node.js LTS **24.20.0** for the current Windows user using `winget`.
- Installed the dependencies from `package-lock.json` with `npm ci` (77 packages added; 0 vulnerabilities reported).
- Configured the ignored local `.env` with Cartesia English TTS (Skylar), Tamil TTS (Janani), Hindi TTS (Siya), and the Gemini `gemini-3.6-flash` brain.
- Verified that `http://localhost:3000/` returns HTTP 200 and `http://localhost:3000/api/state` responds.

`node_modules/` and `.env` are ignored by Git. The app still supports offline rules and browser speech when API keys are not configured.

## Start the app

Open a terminal in the project folder and run:

```powershell
npm start
```

Then open <http://localhost:3000/>. The project requires Node.js 20 or newer. If `node` is not recognized immediately after installation, restart the terminal so it picks up the updated user `PATH`.

For development with automatic restarts, run:

```powershell
npm run dev
```

## Optional AI and voice configuration

The app runs without credentials using built-in rules and browser speech. To enable Gemini, Sarvam, Claude, or Cartesia, copy `.env.example` to `.env`, add the keys you want to use, and restart the server. `VOXA_BRAIN=gemini` selects Gemini; Cartesia Skylar speaks English, Janani speaks Tamil and Siya speaks Hindi when the Cartesia key is set. The merchant language selector includes English, Tamil, and Hindi, and the selection is saved. The merchant chat also switches the whole app (screen text and voice) automatically to the language you type or speak in: Tamil or Devanagari script, the language Sarvam hears, or Tanglish/Hinglish typed in English letters. Keep `.env` private; it is Git-ignored.

In merchant chat, the microphone shows waves and a "Recording" label in the text box while recording. Tap it again to stop; it then shows "Transcribing". Speech is turned into text by Sarvam when `SARVAM_API_KEY` is set, otherwise by Groq (`whisper-large-v3` with `GROQ_API_KEY`; it detects whether you spoke English, Tamil or Hindi, whatever language is selected on screen, and `GROQ_STT_MODEL` can change the model), then by Cartesia (`ink-whisper`, which has to be told the language, so it uses the one selected on screen) if Groq is missing or down. Gemini is used only as the chat brain. If no speech service is configured, the browser's own speech recognition is used, which needs Chrome and internet access. If the microphone is blocked for the page, the mic says so and stops instead of waiting.

## Phone web app and Vercel

The screens are responsive and installable on a phone (Add to Home Screen). The app is deployed on Vercel at <https://voxa-pay.vercel.app> (project `voxa-pay`). To publish a new version run `npm run deploy` (needs `npx vercel login` once); it also copies the keys from `.env` to the project. On Vercel the demo data lives in the shared Runtime Cache, so every server copy sees the same payments, and screens poll for updates. See the "Or put it on Vercel" section of `README.md`.

## Telegram (Murugan and customers)

The bot is **@murugan_stored_voxa_bot** (`TELEGRAM_BOT_TOKEN` and `WA_PROVIDER=telegram` in `.env` and on Vercel; Murugan's number is `VOXA_MERCHANT_PHONE`).

- **Murugan:** Customers & Udhaar → For Murugan → scan the owner QR and tap Start, or tap "Share my phone number" in the bot (it matches +919566012922). Then he can ask Voxa anything from Telegram and gets his updates there.
- **Customers:** scan the Smart QR poster on the Customers tab, tap Start, and they join the rewards card and Udhaar.
- Telegram delivers messages to the Vercel deployment through a webhook (`/api/telegram/webhook`, protected by a secret derived from the token). After changing the token or the public address, run `npm run deploy` and then `npm run telegram`.
- To use the bot with a local `npm start` instead, run `npm run telegram -- --local` (removes the webhook; the local server then polls). Run `npm run telegram` again to give it back to Vercel.
