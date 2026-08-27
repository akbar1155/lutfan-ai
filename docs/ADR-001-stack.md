# ADR-001: Technology Stack

**Status:** Accepted  
**Date:** 2026-07-15  
**Context:** Lutfan AI MVP (TZ v1.0), ~4 week delivery

## Decision

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + Vite + TypeScript |
| Routing / i18n | React Router + i18next |
| Backend | Django 5 + Django REST Framework |
| Auth | Telegram Login Widget + JWT (SimpleJWT) |
| Queue / cache | Celery + Redis 7 |
| Database | PostgreSQL 15 + Django ORM |
| Object storage | MinIO (local), S3-compatible (prod) + CDN |
| AI | Google Gemini 2.5 Flash Image via `google-genai` |
| Live updates | SSE (primary) + status polling fallback |
| Local infra | Docker Compose (Postgres, Redis, MinIO) |
| Logs / errors | `structlog` / JSON logs + Sentry |

## Why React + Django

- Clear separation: SPA for product UX, Django for domain, admin content CRUD, Celery for 5–40s AI jobs.
- Django Admin / DRF accelerate TZ admin CRUD (events, text templates, JPG templates, mood tags, AI presets).
- Celery is a proven fit for Nano Banana generation, retries, and rate-limited concurrency.
- React + Vite keeps the client mobile-first and flexible for custom branded UI (not tied to a full-stack meta-framework).
- Stack still matches TZ constraints: TypeScript frontend, REST `/api/v1`, PostgreSQL, Redis queue, S3, Telegram auth, async generation.

## Alternatives considered

| Option | Why not (for this team decision) |
|--------|----------------------------------|
| Next.js monolith + BullMQ | Faster single-language MVP, but team preference is React SPA + Django. |
| FastAPI + React | Lighter API, weaker built-in admin; more custom CRUD UI work. |
| NestJS + React | Strong TypeScript end-to-end; rejected in favor of Django admin/Celery strengths. |

## Consequences

- Two deployables (frontend static/CDN + Django API + Celery worker).
- CORS, cookie/JWT boundaries, and API typing contracts must be maintained explicitly.
- Landing SEO may need prerender/SSR later; MVP can ship SPA + meta tags, iterate if needed.
- OpenAPI (drf-spectacular) will be the contract between frontend and backend.

## Follow-ups

- Sprint 1: auth module, base models/migrations, health endpoint.
- Document API in `docs/API.md` / OpenAPI once endpoints land.
