# Outlivion Backend API

Backend API для VPN платформы Outlivion.

## 🚀 Быстрый старт

### Требования
- Node.js 20+
- PostgreSQL 15+
- pnpm (рекомендуется) или npm

### Установка

```bash
# Установить зависимости
pnpm install

# Настроить .env
cp env.example .env
# Отредактируйте .env со своими настройками

# Применить миграции
pnpm db:migrate

# Заполнить тестовыми данными (опционально)
pnpm db:seed
```

### Разработка

```bash
# Запустить в dev режиме
pnpm dev

# Сервер запустится на http://localhost:3001
```

### Production

```bash
# Собрать проект
pnpm build

# Запустить production сервер
pnpm start
```

## 📦 Основные команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск в dev режиме с hot reload |
| `pnpm build` | Сборка TypeScript в JavaScript |
| `pnpm start` | Запуск production сервера |
| `pnpm db:migrate` | Применить миграции БД |
| `pnpm db:seed` | Заполнить БД тестовыми данными |
| `pnpm db:studio` | Открыть Drizzle Studio |

## 🔧 Переменные окружения

Создайте файл `.env` на основе `env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/outlivion_db

# Server
PORT=3001
NODE_ENV=production

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Marzban
MARZBAN_URL=https://your-marzban.com
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=password

# Mercuryo
MERCURYO_API_KEY=key
MERCURYO_SECRET=secret
MERCURYO_WEBHOOK_SECRET=webhook_secret

# Frontend
FRONTEND_URL=https://your-domain.com
```

## 📚 API Endpoints

### Авторизация
- `POST /auth/telegram` - Вход через Telegram
- `POST /auth/refresh` - Обновление токена

### Пользователь
- `GET /user/me` - Данные пользователя
- `GET /user/subscription` - Текущая подписка
- `GET /user/transactions` - История платежей

### Оплата
- `POST /billing/create` - Создать платеж
- `POST /billing/webhook` - Webhook от Mercuryo

### Промокоды
- `POST /promo/apply` - Активировать промокод
- `GET /promo/validate/:code` - Проверить промокод

### Серверы
- `GET /servers` - Список серверов
- `GET /servers/:id/config` - VLESS конфигурация

## 🔐 Безопасность

- ✅ JWT токены (Access + Refresh)
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ CORS с белым списком
- ✅ Zod валидация
- ✅ Webhook security

## 🛠 Технологии

- **Express.js** - Web framework
- **PostgreSQL** - База данных
- **Drizzle ORM** - ORM
- **TypeScript** - Язык программирования
- **JWT** - Аутентификация
- **Winston** - Логирование
- **Zod** - Валидация

## 📊 Структура проекта

```
src/
├── cron/              # Фоновые задачи
├── db/                # База данных (схема, миграции)
├── middleware/        # Middleware (auth, validation)
├── routes/            # API routes
├── services/          # Внешние сервисы (Marzban, Mercuryo)
├── utils/             # Утилиты
└── index.ts           # Точка входа
```

## 📄 Лицензия

ISC

---

**Часть Outlivion VPN Platform**
