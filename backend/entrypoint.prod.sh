#!/bin/sh
set -e

echo "Waiting for database..."
python - <<'PY'
import os, time
import psycopg

url = os.environ.get("DATABASE_URL", "")
# psycopg wants postgresql:// not postgres://
url = url.replace("postgres://", "postgresql://", 1)
for i in range(60):
    try:
        with psycopg.connect(url, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        print("Database ready")
        break
    except Exception as exc:
        print(f"DB not ready ({i+1}/60): {exc}")
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready")
PY

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
fi

if [ "${RUN_SEED:-0}" = "1" ]; then
  python manage.py seed_data || true
fi

# Password login for /admin (username/password from env, defaults in settings)
python manage.py ensure_admin_login || true

exec "$@"
