#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production on the server" >&2
  exit 1
fi

# Keep generation limits usable (legacy TZ demo used 3/hour and blocked testers).
python3 - <<'PY'
from pathlib import Path

path = Path(".env.production")
text = path.read_text(encoding="utf-8")
updates = {
    "RATE_LIMIT_GENERATIONS_PER_HOUR": "20",
    "RATE_LIMIT_GENERATIONS_PER_DAY": "50",
    # Never re-seed on every deploy — seed_data used to wipe admin JPG uploads.
    "RUN_SEED": "0",
    # Browser-facing MinIO public prefix (frontend nginx location /s3/).
    "CDN_BASE_URL": "https://lutfanai.uz/s3",
}
lines = text.splitlines()
seen = set()
out = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key, _, _ = line.partition("=")
    key = key.strip()
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Ensured production generation rate limits: 20/hour, 50/day")
PY

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps

# Re-attach admin JPG uploads whose files survived in MinIO/media after DB wipe.
docker compose -f docker-compose.prod.yml exec -T backend \
  python manage.py recover_orphan_templates || true

# Mirror MinIO public templates into MEDIA_ROOT so /media/ and /s3/ both work.
docker compose -f docker-compose.prod.yml exec -T backend \
  python manage.py sync_template_media || true

docker image prune -f >/dev/null
