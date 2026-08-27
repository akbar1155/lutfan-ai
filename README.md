# Lutfan AI

Премиум цифровые пригласительные (MVP по `tz_lutfan_ai.docx`).

**Стек:** React (Vite + TypeScript) + Django REST + Celery + PostgreSQL/SQLite + Redis + MinIO/S3  
**ADR:** [`docs/ADR-001-stack.md`](docs/ADR-001-stack.md)

## Быстрый старт (без Docker)

Локально уже настроен SQLite + eager Celery (задачи синхронно, Redis не обязателен):

```bash
cp .env.example .env   # при необходимости
source .venv/bin/activate
cd backend
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:8000/api/v1/health  
- Swagger: http://localhost:8000/api/docs/  
- Django admin: http://localhost:8000/admin/

В DEBUG режиме кнопка **Кириш** вызывает `POST /api/v1/auth/dev-login` (Telegram widget key bo‘lmasa ham oqimni sinash uchun).

## С Docker (Postgres + Redis + MinIO)

```bash
docker compose up -d --build
# backend-init автоматически сделает migrate + seed_data
# worker запустит Celery async задачи
```

## Что реализовано по ТЗ

- Модели и миграции (users, sessions, events, templates, invitations, AI logs, analytics…)
- Auth: Telegram Login + JWT (+ dev-login в DEBUG)
- Content API: events, text-templates, templates, mood-tags, ai-presets
- Invitations flow: create → patch → generate → status/SSE → download/share
- AI worker (Celery): Gemini Nano Banana, иначе Pillow placeholder
- Rate limit генераций, seed 6 мероприятий
- Frontend: landing, gallery/faq/how, wizard шаги, account, admin dashboard shell
- Django Admin CRUD для контента

## CI/CD

Push to `main` runs GitHub Actions: frontend lint/build, Django tests, then deploy to the production VPS.

Production: https://lutfan.israilov.uz

## Что ещё доработать до prod-приёмки

- Реальный Telegram Login Widget на фронте (bot domain)
- Полный React `/admin` CRUD (сейчас dashboard + Django admin)
- Cron удаления expired файлов / daily_metrics
- Sentry, production CDN signed URLs
- E2E Playwright, покрытие тестами
