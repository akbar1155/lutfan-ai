# Database Restore - Yo'riqnoma (O'zbek)

## Tezkor restore (serverda)

Agar serverda restore qilmoqchi bo'lsangiz:

### 1-usul: Docker containerda

```bash
# 1. Encrypted faylni serverga yuklab qo'ying
# Masalan: scp lutfan_database_2026-09-16_21-00-09.dump.enc server:/tmp/

# 2. Serverga kiring
ssh your_server

# 3. Faylni backend container ichiga ko'chiring
docker cp /tmp/lutfan_database_2026-09-16_21-00-09.dump.enc lutfan_ai-backend-1:/tmp/backup.dump.enc

# 4. Container ichida restore qiling
docker compose -f docker-compose.prod.yml exec backend python scripts/restore_backup.py /tmp/backup.dump.enc

# Yoki clean mode bilan (mavjud database ni tozalaydi):
docker compose -f docker-compose.prod.yml exec backend python scripts/restore_backup.py /tmp/backup.dump.enc --clean
```

### 2-usul: To'g'ridan-to'g'ri server CLI orqali

```bash
# 1. Environment o'zgaruvchilarni o'rnating
export BACKUP_ENCRYPTION_KEY="your_64_char_hex_key"
export DATABASE_URL="postgresql://user:password@localhost:5432/lutfan_db"

# 2. Restore qiling
cd /path/to/lutfan_ai
python3 scripts/restore_backup.py /tmp/lutfan_database_2026-09-16_21-00-09.dump.enc

# Clean mode (mavjud tabllarni o'chiradi):
python3 scripts/restore_backup.py /tmp/lutfan_database_2026-09-16_21-00-09.dump.enc --clean
```

## Local restore (development)

Local development muhitida test qilish uchun:

```bash
# 1. .env faylni o'qish
cd /Users/rosh/Desktop/lutfan_ai
source .env  # yoki .env.local

# 2. Cryptography kutubxonasini o'rnating (agar yo'q bo'lsa)
pip install cryptography

# 3. Restore qiling
python3 scripts/restore_backup.py ~/Downloads/lutfan_database_2026-09-16_21-00-09.dump.enc
```

## MUHIM eslatmalar

### ⚠️ Restore oldidan:

1. **Backup oling!** - Hozirgi database dan backup oling (agar kerak ma'lumot bo'lsa)
   ```bash
   docker compose -f docker-compose.prod.yml exec backup python manage.py run_db_backup
   ```

2. **Test database yarating** - Production database ni to'g'ridan-to'g'ri restore qilmang!
   ```bash
   # Yangi test database yarating
   docker compose -f docker-compose.prod.yml exec db createdb -U postgres lutfan_test

   # Test database ga restore qiling
   export DATABASE_URL="postgresql://postgres:password@localhost:5432/lutfan_test"
   python3 scripts/restore_backup.py backup.dump.enc
   ```

3. **Application to'xtatilsin** - Restore vaqtida ilova ishlayotgan bo'lmasin:
   ```bash
   docker compose -f docker-compose.prod.yml stop backend celery
   ```

### --clean flag haqida

- `--clean` ishlatmasangiz: Restore faqat yangi ma'lumotlarni qo'shadi, mavjudlarini o'zgartirmaydi
- `--clean` ishlatsangiz: Avval barcha tablelar, index va constraint larni o'chiradi, keyin restore qiladi
- **PRODUCTION uchun ehtiyot bo'ling!** - `--clean` bilan faqat bo'sh yoki test database ga restore qiling

### Environment o'zgaruvchilari

Script 2 ta environment variable talab qiladi:

```bash
# 1. Encryption kaliti (64 char hex yoki 32 byte base64)
export BACKUP_ENCRYPTION_KEY="abc123def456..."

# 2. Database connection URL
export DATABASE_URL="postgresql://user:password@host:port/dbname"
```

Bu qiymatlarni `.env.production` yoki `.env.local` fayldan olishingiz mumkin.

## Xatoliklarni tuzatish

### "BACKUP_ENCRYPTION_KEY is not set"

```bash
# .env.production fayldan kalit oling
cat .env.production | grep BACKUP_ENCRYPTION_KEY

# Export qiling
export BACKUP_ENCRYPTION_KEY="<key_from_file>"
```

### "pg_restore is not installed"

```bash
# Docker container ichida:
apt-get update && apt-get install -y postgresql-client

# MacOS:
brew install postgresql

# Ubuntu/Debian:
sudo apt install postgresql-client
```

### "Invalid encrypted backup header"

Fayl buzilgan yoki noto'g'ri kalit ishlatilgan. Telegram'dan qayta yuklab oling.

### "permission denied" errors during restore

Bu normal, chunki production user ba'zi permission larga ega emas. Agar asosiy ma'lumotlar restore bo'lsa, xatoliklarni ignore qilishingiz mumkin.

## Restore jarayonini tekshirish

Restore muvaffaqiyatli bo'lganini tekshirish uchun:

```bash
# Database ga ulanish
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d lutfan_db

# Table larni ko'rish
\dt

# User larni sanash
SELECT COUNT(*) FROM users_user;

# Invitation larni sanash
SELECT COUNT(*) FROM invitations_invitation;

# Chiqish
\q
```

## To'liq jarayon namunasi

```bash
# 1. Hozirgi holatni saqlang
docker compose -f docker-compose.prod.yml exec backup python manage.py run_db_backup

# 2. Application to'xtatish
docker compose -f docker-compose.prod.yml stop backend celery

# 3. Backup faylni serverga yuklash
scp lutfan_database_2026-09-16_21-00-09.dump.enc server:/tmp/

# 4. Serverda restore qilish
ssh server
cd /path/to/lutfan_ai

# Environment o'zgaruvchilar
export BACKUP_ENCRYPTION_KEY=$(grep BACKUP_ENCRYPTION_KEY .env.production | cut -d= -f2)
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2)

# Restore
python3 scripts/restore_backup.py /tmp/lutfan_database_2026-09-16_21-00-09.dump.enc --clean

# 5. Application qayta ishga tushirish
docker compose -f docker-compose.prod.yml up -d

# 6. Tekshirish
docker compose -f docker-compose.prod.yml logs -f backend
```

## Yordam

Agar muammo bo'lsa:

1. Script xabarlrni diqqat bilan o'qing
2. Log larni tekshiring: `docker compose logs backend`
3. Database ulanishini tekshiring
4. Encryption kalitni tekshiring

---

📝 **Eslatma**: Har doim restore qilishdan oldin hozirgi database dan backup oling!
