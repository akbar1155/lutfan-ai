#!/bin/sh
set -eu

echo "[backup] waiting for postgres…"
python - <<'PY'
import os, time, sys
import psycopg

url = os.environ.get("DATABASE_URL", "")
if not url.startswith("postgres"):
    print("[backup] DATABASE_URL is not postgres; scheduler will still start", flush=True)
    sys.exit(0)
for i in range(60):
    try:
        with psycopg.connect(url, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        print("[backup] postgres is ready", flush=True)
        sys.exit(0)
    except Exception as exc:
        print(f"[backup] postgres not ready ({i+1}/60)", flush=True)
        time.sleep(2)
print("[backup] postgres wait timed out", flush=True)
sys.exit(1)
PY

exec "$@"
