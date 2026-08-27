# Google Compute Engine ga deploy (Lutfan AI)

## 1) Serverga ulang

```bash
ssh USER@YOUR_SERVER_IP
```

## 2) Docker o‘rnating (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# chiqib qayta kiring, keyin:
docker --version
docker compose version
```

## 3) Firewall (GCP)

Google Cloud Console → VPC network → Firewall:

- `tcp:22` (SSH)
- `tcp:80` (HTTP)
- `tcp:443` (HTTPS, keyinroq)

## 4) Loyihani yuklang

```bash
cd ~
git clone YOUR_REPO_URL lutfan_ai
# yoki scp/rsync bilan lokal mashinadan:
# rsync -avz --exclude node_modules --exclude .venv --exclude backend/.venv \
#   ./lutfan_ai/ USER@IP:~/lutfan_ai/
cd ~/lutfan_ai
cp .env.production.example .env.production
nano .env.production   # IP va secretlarni to‘ldiring
```

## 5) Ishga tushirish

```bash
cd ~/lutfan_ai
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

## 6) Tekshiruv

- Sayt: `http://YOUR_SERVER_IP`
- API health: `http://YOUR_SERVER_IP/api/v1/health`
- Admin: `http://YOUR_SERVER_IP/admin/`

## 7) Telegram

BotFather / Telegram Login Widget domainiga `YOUR_SERVER_IP` yoki domen qo‘shing.

## Foydali buyruqlar

```bash
# loglar
docker compose -f docker-compose.prod.yml logs -f worker

# qayta build
docker compose -f docker-compose.prod.yml up -d --build

# to‘xtatish
docker compose -f docker-compose.prod.yml down
```

## Eslatma

Hozir HTTP (80). Domen bo‘lsa keyin Caddy/Certbot bilan HTTPS qo‘shamiz.
CDN_BASE_URL va MinIO public URL ni keyinroq to‘g‘rilash mumkin — avval sayt ochilishi muhim.
