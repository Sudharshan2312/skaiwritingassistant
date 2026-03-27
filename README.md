# SK-WRITLY UI Website

A modern AI writing assistant website made for UI/UX coursework, now with a working backend API.

## Multi-Page Module Architecture

To keep complex flows clean, the UI is split into focused pages:

- `index.html` - Home and module navigation
- `generate.html` - AI generation workspace
- `account.html` - Register/login/verify/reset flows
- `history.html` - Saved prompt/output history
- `shared.js` - Shared token and health utilities
- `generate.js` - Generation module logic
- `account.js` - Account module logic
- `history.js` - History module logic

## Project Structure

- `index.html` - Main webpage structure
- `styles.css` - Visual design, layout, animation, responsive behavior
- `script.js` - Frontend interactions and backend API calls
- `server.js` - Express backend (health, generation, auth, history)
- `.env.example` - Environment variable template
- `data/store.json` - Local JSON database for users and prompt history

## Run Locally (Frontend + Backend)

1. Open this folder in VS Code terminal.
2. Install dependencies:

```bash
npm install
```

3. (Optional) Add environment config:

```bash
copy .env.example .env
```

Set these values in `.env`:

- `OPENAI_API_KEY` for real AI output
- `JWT_SECRET` for secure auth token signing

4. Start the server:

```bash
npm start
```

5. Open `http://localhost:3000`.

If no API key is configured, the app still works using the local fallback response mode.

## Connectivity Check

- Health endpoint: `GET http://localhost:3000/api/health`
- Generate endpoint: `POST http://localhost:3000/api/generate` with JSON body:

```json
{
	"prompt": "Write launch copy for my AI writing assistant"
}
```

## Authentication + History API

- `POST /api/auth/register` body: `{ "name", "email", "password" }`
- `POST /api/auth/login` body: `{ "email", "password" }`
- `POST /api/auth/request-verification` body: `{ "email" }`
- `POST /api/auth/verify-email` body: `{ "email", "code" }`
- `POST /api/auth/forgot-password` body: `{ "email" }`
- `POST /api/auth/reset-password` body: `{ "email", "code", "newPassword" }`
- `GET /api/auth/me` with header: `Authorization: Bearer <token>`
- `GET /api/history` with Bearer token
- `POST /api/history` body: `{ "prompt", "output" }` with Bearer token
- `DELETE /api/history/:id` with Bearer token

Note: This coursework build returns demo verification/reset codes directly in API responses so you can test the complete UX without integrating an SMTP provider.

## Public Deployment (Backend Included)

Use services that support Node backend.

## Fastest: Render Blueprint Deploy

This repo now includes `render.yaml`, so Render can auto-configure your service.

1. Push this project to GitHub.
2. Open [https://dashboard.render.com/new](https://dashboard.render.com/new).
3. Choose `Blueprint` and select your repository.
4. Render will read `render.yaml` automatically.
5. Add `OPENAI_API_KEY` in Render environment variables (optional for real AI output).
6. Deploy and open your public URL.

## Option 1: Render

1. Push this project to GitHub.
2. Go to [https://render.com](https://render.com) and create a new `Web Service`.
3. Connect repository and set:
	- Build Command: `npm install`
	- Start Command: `npm start`
	- Health Check Path: `/api/health`
4. Add environment variables (if using OpenAI):
	- `OPENAI_API_KEY`
	- `OPENAI_MODEL` (optional)
	- `JWT_SECRET`
5. Deploy and get your public URL.

## Option 2: Railway

1. Push this project to GitHub.
2. Go to [https://railway.app/new](https://railway.app/new).
3. Deploy from GitHub repo.
4. Add `OPENAI_API_KEY` in Variables (optional).
	Add `JWT_SECRET`.
5. Railway will provide a public domain.

## Deployment Files Added

- `render.yaml` - Auto-deploy blueprint for Render
- `Procfile` - Process start declaration (`web: npm start`)
- `.nvmrc` - Pins Node version (`20`)

## GitHub Actions CI + Auto Deploy

This repo now includes `.github/workflows/ci-deploy.yml`.

What it does:

- On push/PR to `main`: installs dependencies, starts server, checks `/api/health`
- On push to `main`: triggers Render deploy hook (if configured)

Setup required in GitHub:

1. Go to repository `Settings` -> `Secrets and variables` -> `Actions`.
2. Add a new repository secret:
	- Name: `RENDER_DEPLOY_HOOK_URL`
	- Value: your Render deploy hook URL
3. Push to `main` to run CI and deploy automatically.

## Option 3: Vercel (Node project)

1. Push to GitHub.
2. Import repo in [https://vercel.com/new](https://vercel.com/new).
3. Add environment variables in Vercel Project Settings.
	Include `JWT_SECRET`.
4. Deploy.

## UI Notes for Presentation

- Futuristic AI-tool inspired visual language
- Custom typography using `Manrope` + `Space Grotesk`
- Layered gradient background with ambient glow shapes
- Real frontend-backend connectivity with status indicator
- AI generation API with OpenAI mode and local fallback mode
- Fully responsive layout for desktop and mobile
