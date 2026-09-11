# Database Backup System (Lutfan AI)

Har kuni **21:00 Asia/Tashkent** da PostgreSQL dump olinadi, AES-256-GCM bilan shifrlandi va **faqat sizning Telegram shaxsiy chattingizga** (`@lutfan_ai_bot` DM) yuboriladi. Channel ishlatilmaydi.

## Architecture

```
backup Docker service
  → cron (BACKUP_SCHEDULE + BACKUP_TIMEZONE)
  → flock lock (parallel run yo‘q)
  → pg_dump -Fc
  → validate (PGDMP + pg_restore -l)
  → AES-256-GCM encrypt  →  *.dump.enc
  → SHA-256
  → Telegram Bot API sendDocument (personal chat_id)
  → temp files cleanup
```

`pg_dump -Fc` allaqachon compress qiladi — qo‘shimcha gzip yo‘q.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_ENABLED` | `false` (local) / `true` (prod example) | Scheduler backup ishlatilsinmi |
| `BACKUP_SCHEDULE` | `0 21 * * *` | Cron ifoda |
| `BACKUP_TIMEZONE` | `Asia/Tashkent` | Timezone |
| `TELEGRAM_BOT_TOKEN` | — | `@lutfan_ai_bot` token |
| `TELEGRAM_BACKUP_CHAT_ID` | — | **Sizning** personal chat id |
| `BACKUP_ENCRYPTION_KEY` | — | Maxfiy kalit (gitga tushmasin) |
| `BACKUP_KEEP_LOCAL` | `false` | Encrypted nusxani serverda saqlash |
| `BACKUP_LOCAL_RETENTION_DAYS` | `2` | Local retention |
| `BACKUP_PROJECT_NAME` | `Lutfan AI` | Telegram caption |

## Telegram: faqat sizga DM

1. BotFather’dan bot token oling (yoki mavjud `TELEGRAM_BOT_TOKEN`).
2. Telegram’da `@lutfan_ai_bot` ni oching va **/start** bosing (bir marta yozish shart).
3. O‘z `chat_id` ingizni oling, masalan:
   - Brauzer: `https://api.telegram.org/bot<TOKEN>/getUpdates` — `message.chat.id`
   - yoki `@userinfobot` / `@getidsbot`
4. `.env.production` ga qo‘ying:

```bash
TELEGRAM_BOT_TOKEN=123456:AA...
TELEGRAM_BACKUP_CHAT_ID=123456789   # personal numeric id
```

Channel id (`-100…`) **ishlatilmaydi**.

## Encryption key yaratish

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

`.env.production`:

```bash
BACKUP_ENCRYPTION_KEY=<64-char-hex>
```

## Manual backup

```bash
# Prod
docker compose -f docker-compose.prod.yml exec backup \
  python manage.py run_db_backup

# Local (postgresql-client kerak yoki backup service)
docker compose exec backup python manage.py run_db_backup
```

Manual run `BACKUP_ENABLED=false` bo‘lsa ham ishlaydi.

## Restore (manual only)

**Hech qachon avtomatik restore qilinmaydi.**

```bash
# 1) Encrypted faylni Telegram’dan yuklab oling
# 2) Decrypt
python3 - <<'PY'
from pathlib import Path
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
# yoki to‘g‘ridan-to‘g‘ri crypto helper:
from apps.backup.crypto import decrypt_file
from apps.backup.config import derive_encryption_key
key = derive_encryption_key(os.environ["BACKUP_ENCRYPTION_KEY"])
decrypt_file(Path("lutfan_database_....dump.enc"), Path("restore.dump"), key)
PY

# 3) Restore into a NEW database (never blindly overwrite prod)
pg_restore --clean --if-exists -h HOST -U USER -d TARGET_DB restore.dump
```

Oddiy CLI helper:

```bash
docker compose -f docker-compose.prod.yml exec backup python - <<'PY'
from pathlib import Path
from apps.backup.config import derive_encryption_key
from apps.backup.crypto import decrypt_file
import os
key = derive_encryption_key(os.environ["BACKUP_ENCRYPTION_KEY"])
decrypt_file(Path("/tmp/in.dump.enc"), Path("/tmp/out.dump"), key)
print("decrypted -> /tmp/out.dump")
PY
```

## Troubleshooting

| Muammo | Yechim |
|--------|--------|
| Bot yozmaydi | Botga `/start` yuborganmisiz? `TELEGRAM_BACKUP_CHAT_ID` to‘g‘rimi? |
| `file too large` | Dump ~50MB dan katta — Telegram Bot API limiti; local keep yoki boshqa delivery kerak |
| `Another backup process` | Oldingi run hali ketmoqda; lock ishlayapti |
| `pg_dump is not installed` | `backup` service/image ishlating (`Dockerfile.backup`) |
| FAILED DM keldi | Stage nomiga qarang; secretlar xabarda chiqmasligi kerak |

## Production checklist

- [ ] `@lutfan_ai_bot` ga `/start` yuborilgan
- [ ] `TELEGRAM_BOT_TOKEN` sozlangan
- [ ] `TELEGRAM_BACKUP_CHAT_ID` = personal chat id
- [ ] `BACKUP_ENCRYPTION_KEY` sozlangan (kuchli, unique)
- [ ] `BACKUP_ENABLED=true`
- [ ] `BACKUP_SCHEDULE=0 21 * * *`
- [ ] `BACKUP_TIMEZONE=Asia/Tashkent`
- [ ] `backup` container ishlayapti (`docker compose ps`)
- [ ] Manual `run_db_backup` muvaffaqiyatli
- [ ] Decrypt + `pg_restore -l` sinovdan o‘tgan
- [ ] Secrets gitda yo‘q
- [ ] Parallel run lock tekshirilgan
