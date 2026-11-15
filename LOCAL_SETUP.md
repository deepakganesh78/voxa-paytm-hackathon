# Local setup record

Last updated: 2026-11-15

## What was set up

- Installed Node.js LTS **24.20.0** for the current Windows user using `winget`.
- Installed the dependencies from `package-lock.json` with `npm ci` (77 packages added; 0 vulnerabilities reported).
- Started the app in its default offline mode. No `.env` file or API keys are required for the demo.
- Verified that `http://localhost:3000/` returns HTTP 200 and `http://localhost:3000/api/state` responds.

No application source files or dependency manifests were changed as part of this setup. `node_modules/` and `.env` are ignored by Git.

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

## Optional AI configuration

The app runs without credentials using built-in rules. To enable optional AI services, copy `.env.example` to `.env`, add the keys you want to use, and restart the server. Keep `.env` private; it is Git-ignored.
