# Domen: lutfanai.uz

Production server IP: `34.173.220.247`

## 1) DNS (registrar panel)

Domen sotib olingandan keyin **A record** qo‘ying:

| Type | Name / Host | Value              | TTL  |
|------|-------------|--------------------|------|
| A    | `@`         | `34.173.220.247`   | 300  |
| A    | `www`       | `34.173.220.247`   | 300  |

Agar registrar nameserver so‘rasa, odatda default DNS panelidan A yozuvlarni qo‘shish yetadi.

Tekshirish (5–30 daqiqa keyin):

```bash
dig @8.8.8.8 lutfanai.uz A +short
# kutilgan: 34.173.220.247
```

## 2) Server (allaqachon qilingan)

- Nginx site: `/etc/nginx/sites-available/lutfanai.uz` → proxy `127.0.0.1:8080`
- `.env.production` da `lutfanai.uz` qo‘shilgan (`ALLOWED_HOSTS`, CORS/CSRF, `APP_BASE_URL`)

## 3) SSL (DNS tayyor bo‘lgach)

```bash
ssh avlo-gcp
sudo certbot --nginx -d lutfanai.uz -d www.lutfanai.uz --redirect
cd ~/lutfan_ai && docker compose -f docker-compose.prod.yml up -d --force-recreate backend worker
```

## 4) Telegram Login Widget

BotFather / Telegram Login Widget sozlamalariga domen qo‘shing:

- `lutfanai.uz`
- `www.lutfanai.uz` (agar ishlatilsa)

## 5) Tekshiruv

- https://lutfanai.uz/admin/ — React admin
- https://lutfanai.uz/django-admin/ — Django admin
- https://lutfanai.uz/api/v1/health

Eski domen `lutfan.israilov.uz` vaqtincha ishlashda qoladi.
