# PingBot

Telegram-first API monitoring service.

## Setup

### Prerequisites

- Docker (for PostgreSQL & Redis)
- Node.js 18+
- Yarn

### Getting started

```bash
cp .env.example .env
# Fill in your environment variables
docker compose up -d
yarn install
yarn start:dev
```

## Environment Variables

See `.env.example` for required variables. You will need:

- A PostgreSQL database
- A Redis instance
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Payment provider credentials

## License

Proprietary — All rights reserved.
