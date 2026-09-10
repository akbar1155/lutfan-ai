# Telegram Bot Setup Guide

This guide explains how to configure the Telegram Login Widget for Lutfan AI in production.

## Prerequisites

- A Telegram account
- Access to [@BotFather](https://t.me/BotFather)
- Your production domain (e.g., `lutfan.uz` or `lutfan.israilov.uz`)

## Step 1: Create Telegram Bot

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather)
2. Send the command `/newbot`
3. Follow the prompts:
   - **Bot name**: `Lutfan AI` (or your preferred display name)
   - **Bot username**: `lutfan_ai_bot` (must end with `_bot`)
4. BotFather will reply with your bot token. **Save this securely** - you'll need it for the environment configuration.

Example response:
```
Done! Congratulations on your new bot.
You will find it at t.me/lutfan_ai_bot
You can now add a description, about section and profile picture for your bot.

Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-123456789

Keep your token secure and store it safely, it can be used by anyone to control your bot.
```

## Step 2: Configure Bot Domain

The Telegram Login Widget only works with verified domains. You must register your production domain with the bot:

1. In your chat with [@BotFather](https://t.me/BotFather), send `/setdomain`
2. Select your bot (`@lutfan_ai_bot`)
3. Send your production domain **without** protocol or path:
   - ✅ Correct: `lutfan.uz`
   - ✅ Correct: `lutfan.israilov.uz`
   - ❌ Wrong: `https://lutfan.uz`
   - ❌ Wrong: `http://lutfan.uz/`
   - ❌ Wrong: `localhost`

4. BotFather will confirm the domain registration

## Step 3: Configure Environment Variables

Add the bot credentials to your production environment:

### Backend (.env.production)

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-123456789
TELEGRAM_BOT_USERNAME=lutfan_ai_bot
```

### Frontend (Build-time)

The frontend needs the bot username at build time:

```bash
VITE_TELEGRAM_BOT_USERNAME=lutfan_ai_bot
```

For Docker builds, pass it as a build arg in `docker-compose.prod.yml`:
```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      VITE_TELEGRAM_BOT_USERNAME: ${TELEGRAM_BOT_USERNAME}
```

## Step 4: Optional Bot Configuration

### Set Bot Description

This appears when users first interact with your bot:

```
/setdescription
Select: @lutfan_ai_bot
Enter: Lutfan AI - Премиум цифровые пригласительные с использованием AI
```

### Set Bot About Text

Short description for the bot profile:

```
/setabouttext
Select: @lutfan_ai_bot
Enter: Создавайте премиальные цифровые пригласительные для ваших событий
```

### Set Bot Profile Picture

Upload a square image (512x512px recommended):

```
/setuserpic
Select: @lutfan_ai_bot
Upload your logo image
```

### Set Bot Commands (Optional)

If you plan to add Telegram bot commands in the future:

```
/setcommands
Select: @lutfan_ai_bot
Enter command list:
start - Запустить бота
help - Помощь
```

## Step 5: Deploy and Test

1. **Deploy your application** with the new environment variables
2. **Clear browser cache** and visit your production site
3. **Click the Telegram Login button** - it should show the official Telegram widget
4. **Complete authentication** through Telegram
5. **Verify** you're logged in and can access protected pages

## Troubleshooting

### Widget doesn't appear

1. Check that your domain is correctly set in BotFather (`/setdomain`)
2. Verify `TELEGRAM_BOT_TOKEN` is set in backend environment
3. Verify `VITE_TELEGRAM_BOT_USERNAME` was set during frontend build
4. Check browser console for errors
5. Ensure you're accessing the site via the registered domain (not IP address)

### "Invalid Telegram hash" error

1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Check that the token matches the bot username
3. Ensure system clock is synchronized (auth_date validation)

### Widget shows but login fails

1. Check backend logs for detailed error messages
2. Verify backend can reach database
3. Check CORS and CSRF settings allow the frontend domain
4. Verify JWT secrets are configured

## Security Best Practices

1. **Never commit** the `TELEGRAM_BOT_TOKEN` to git
2. **Use strong JWT secrets** (64+ random characters)
3. **Keep the bot token secure** - it can control your bot
4. **Monitor auth logs** for suspicious activity
5. **Set up rate limiting** on authentication endpoints

## Development vs Production

### Development (localhost)

The Telegram Login Widget **will not work** on localhost because:
- Telegram's widget only works on registered domains
- localhost cannot be registered with BotFather

For development, use the **dev login button** (shown when `DEBUG=true`):
- Bypasses Telegram authentication
- Creates test users automatically
- Only available when `DJANGO_DEBUG=true` or `ALLOW_DEV_LOGIN=true`

### Production

The real Telegram Login Widget will automatically appear when:
- Site is accessed via the registered domain
- `TELEGRAM_BOT_TOKEN` is configured
- `VITE_TELEGRAM_BOT_USERNAME` matches the bot

## Testing the Integration

### Backend Test

Test the Telegram auth endpoint:

```bash
curl -X POST https://your-domain.uz/api/v1/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456789,
    "first_name": "Test",
    "username": "testuser",
    "auth_date": '$(date +%s)',
    "hash": "test_hash"
  }'
```

Expected: 401 "Invalid Telegram hash" (this is correct - proves validation works)

### Frontend Test

1. Open your production site in incognito/private window
2. Click "Войти" (Login)
3. Verify the blue Telegram button appears
4. Click it and complete authentication in Telegram
5. Verify you're redirected back and logged in

## Migration Checklist

Before going to production:

- [ ] Create bot with @BotFather
- [ ] Set bot domain with `/setdomain`
- [ ] Configure bot description and profile picture
- [ ] Add `TELEGRAM_BOT_TOKEN` to production environment
- [ ] Add `VITE_TELEGRAM_BOT_USERNAME` to build configuration
- [ ] Deploy application
- [ ] Test login flow on production domain
- [ ] Disable dev login (`ALLOW_DEV_LOGIN=false` in production)
- [ ] Monitor error logs for auth issues
- [ ] Test on multiple devices/browsers

## Additional Resources

- [Telegram Login Widget Documentation](https://core.telegram.org/widgets/login)
- [BotFather Commands Reference](https://core.telegram.org/bots#6-botfather)
- [Telegram Bot API](https://core.telegram.org/bots/api)
