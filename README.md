# opencompy

An open-source version of Compy, a friendly, fun AI companion designed to bring a little more joy to seniors' everyday lives. I thought it would be fun to share what I built and let others experiment with it, improve it, or try it out with their grandparents :)

Compy talks out loud in European Portuguese: you tap it, you speak, it answers. It remembers what you tell it between conversations and can suggest a memory game along the way.

There is **no login**. The first time you open the app, Compy asks a few questions (what to call you, who you live with, what you like, anything it should know). After that, the app opens straight into the conversation. Everything is stored for one local user, in a database on your own machine.

## What you need

- **Node.js 20 or newer**
- **pnpm 10** — it ships with Node, you just switch it on with `corepack enable`
- **Docker** — only used to run the PostgreSQL database
- **API keys** (you bring your own, and you pay for your own usage):
  - [Anthropic](https://console.anthropic.com) — the brain. Required.
  - [ElevenLabs](https://elevenlabs.io) — the ears and the voice. Required.
  - [OpenAI](https://platform.openai.com) — long-term memory between conversations. Optional; Compy still talks without it.

## Install and run

**1. Get the code**

```bash
git clone https://github.com/humbertobastos7/opencompy.git
cd opencompy
```

**2. Install dependencies**

```bash
corepack enable
pnpm install
```

**3. Add your keys**

```bash
cp .env.example .env
```

Open `.env` and paste your keys where it says `<paste-your-...>`. The rest of the file already works for a local setup. `.env` is git-ignored, so your keys stay on your machine.

**4. Start the database**

Make sure Docker is running, then:

```bash
docker compose up -d db
pnpm run db:migrate
```

The first command starts PostgreSQL (with the `pgvector` extension), the second one creates the tables.

**5. Start Compy**

```bash
pnpm run dev
```

This starts three things at once: the web app (port `5173`), the backend (`3000`) and the AI service (`3001`).

**6. Say hi**

Open <http://localhost:5173> in Chrome. The first time you'll go through the short onboarding; then tap Compy, allow microphone access, and start talking.

## Good to know

- **Changed your `.env`?** Stop the app (`Ctrl+C`) and run `pnpm run dev` again. Keys are only read at startup.
- **The voice.** `ELEVENLABS_VOICE_ID_DEFAULT` in `.env` decides how Compy sounds. The default is a placeholder, so pick a voice from your ElevenLabs account that speaks European Portuguese.
- **Start over from scratch.** `pnpm run db:reset` wipes the database (profile, onboarding, conversations) and recreates it.
- **Each time you open the app, a new conversation starts.** Older ones are kept and feed Compy's memory.

## If something goes wrong

- **`docker compose up -d db` fails because port 5432 is taken** — you already have a PostgreSQL running. Stop it, or change the port mapping in `docker-compose.yaml` and the port in `DATABASE_URL`.
- **Compy doesn't answer or there's no sound** — almost always a missing or wrong key. Check the terminal where `pnpm run dev` is running; the error names the key that's missing.
- **The backend keeps restarting by itself** (you'll see `Restarting 'src/backend/main.ts'` over and over, and conversations get cut off) — this happens when the project sits in a folder synced by iCloud, Dropbox or similar, because the sync keeps touching files. Move the project somewhere else, or run `pnpm run dev:nowatch` instead of `pnpm run dev`.
- **"Could not transcribe audio"** now and then — Compy heard silence or something too short. Just speak again.

## A word on privacy

No login means no protection: anyone who can reach the server can see the local user's conversations. That's fine on your own computer. If you ever put it on the internet, put your own access control in front of it (a VPN, or authentication on a reverse proxy).

Your conversations are sent to Anthropic, ElevenLabs and (if you set the key) OpenAI to generate the replies, the voice and the memory.

## How it's built

```text
src/
  frontend/   React app (Vite, TanStack Router)
  backend/    Main API (NestJS + Fastify, PostgreSQL via Drizzle)
  ai/         Voice pipeline: speech-to-text, Claude, text-to-speech
  shared/     Types and validation shared by all three
```

The caregiver and admin areas from the hosted version of Compy are still in the code, but they are switched off in this version.

## Handy commands

```bash
pnpm run test      # run the tests
pnpm run tscheck   # type-check everything
pnpm run build     # production build
```
