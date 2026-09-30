# ReachInbox Email Scheduler

A full-stack email scheduling dashboard built with Next.js, Express, BullMQ, Redis, and PostgreSQL. Users can compose emails, schedule them for a future time, and track delivery status across Scheduled and Sent views.

## Tech Stack

**Backend** — Node.js, Express, TypeScript, BullMQ, Prisma, PostgreSQL, Redis, Nodemailer, Elasticsearch, Passport (Google OAuth)

**Frontend** — Next.js 14, TypeScript, Tailwind CSS, shadcn/ui

## How it works

Email jobs are queued as BullMQ **delayed jobs** using `delay = scheduledAt - now`. There are no cron jobs. When the delay expires, a worker picks up the job, sends the email via SMTP, and updates the database status to `SENT`.

On server restart, `recoverPendingJobs()` scans the database for any `SCHEDULED` or `QUEUED` rows that have no active BullMQ job and re-queues them — so no emails are lost if Redis is flushed or the server crashes.

Rate limiting is enforced using Redis Lua scripts that atomically check and increment hourly counters per sender and globally. If a sender hits the hourly cap, the job is moved to the next hour rather than dropped, and a Slack DM is sent as a notification.

## Architecture

```
flowchart LR
  Frontend → Express API → PostgreSQL
  Express API → BullMQ → Redis
  BullMQ Worker → SMTP (Nodemailer)
  BullMQ Worker → Elasticsearch
  BullMQ Worker → Slack API
```

## Rate Limits

| Setting | Env var | Default |
|---|---|---|
| Worker concurrency | `WORKER_CONCURRENCY` | `5` |
| Min delay between sends | `MIN_DELAY_BETWEEN_SENDS_MS` | `2000` |
| Max emails per hour (global) | `MAX_EMAILS_PER_HOUR` | `200` |
| Max emails per hour (per sender) | `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` |

## Local Setup

**Requirements:** Node.js 20+, Docker

```bash
# Start Postgres, Redis, and Elasticsearch
docker compose up -d

# Backend
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:4000
- Bull Board: http://localhost:4000/admin/queues

## Environment Variables

### Backend (`backend/.env`)

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create an OAuth 2.0 Web Client.
2. Add `http://localhost:4000/api/auth/google/callback` as an authorized redirect URI.
3. Copy the Client ID and Secret into `backend/.env`.

## Slack Setup (optional)

Slack notifications are sent as DMs when a sender hits the hourly rate limit.

1. Create a Slack app at [api.slack.com](https://api.slack.com).
2. Under OAuth & Permissions, add redirect URL: `http://localhost:4000/api/slack/callback`
3. Add bot scopes: `chat:write`, `im:write`, `users:read`
4. Add the Client ID and Secret to `backend/.env`.
5. In the dashboard header, click **Connect Slack** to authorize.

## API Endpoints

All endpoints except auth require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/google` | Start Google OAuth flow |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/emails` | Schedule a new email |
| GET | `/api/emails?status=scheduled` | List pending emails |
| GET | `/api/emails?status=sent` | List sent emails |
| GET | `/api/search?q=` | Search emails via Elasticsearch |
| GET | `/api/slack/connect` | Get Slack OAuth URL |
| GET | `/api/me/limits` | Get current rate limit config |

## Project Structure

```
reachinbox-email-scheduler/
├── backend/
│   ├── prisma/          # Database schema and migrations
│   ├── src/
│   │   ├── routes/      # Express route handlers
│   │   ├── worker.ts    # BullMQ job processor
│   │   ├── queue.ts     # Queue setup and job scheduling
│   │   ├── mail.ts      # Nodemailer send logic
│   │   ├── redis.ts     # Redis/ioredis connection
│   │   └── index.ts     # Server entry point
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js app router pages
│   │   ├── components/  # Dashboard, compose modal, email list
│   │   ├── context/     # Auth context
│   │   └── lib/         # API client
│   └── .env.example
└── docker-compose.yml
```

## Notes

- Elasticsearch is optional. If `ELASTICSEARCH_URL` is not set or unreachable, the server starts normally and the search bar is disabled.
- Ethereal SMTP is used for email delivery in development. One account is created per `(user, fromEmail)` pair and reused on subsequent sends.
- Hourly rate limit windows are keyed by UTC hour.
