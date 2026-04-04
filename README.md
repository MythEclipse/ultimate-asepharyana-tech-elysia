# Elysia API

Elysia-based API service untuk auth, social/chat, history, image cache, dan quiz battle (REST + WebSocket).

## Stack

- Runtime: Bun
- Framework: Elysia
- Database: MySQL + Drizzle ORM
- Cache: Redis
- Object Storage: MinIO / S3-compatible
- API Docs: Swagger (`/docs`) + AsyncAPI viewer (`/docs-ws`)

## Prerequisites

- Bun
- MySQL
- Redis
- MinIO (opsional tapi direkomendasikan untuk upload/avatar)

## Install and Run

```bash
bun install
bun run dev
```

Server default: `http://localhost:4092`

## Environment Variables

Minimal:

```env
NODE_ENV=development
DATABASE_URL=mysql://asephs:hunterz@localhost:3306/sosmed
JWT_SECRET=change-me
REDIS_URL=redis://localhost:6379
```

MinIO (opsional):

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=mytheclipse
MINIO_BUCKET_NAME=api
MINIO_PUBLIC_URL=http://localhost:9000
MINIO_AVATAR_PREFIX=avatars
```

Email (opsional):

```env
SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
FROM_EMAIL=noreply@example.com
FROM_NAME=App
APP_URL=http://localhost:4092
```

## Database Commands (Drizzle)

```bash
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
```

## Available Scripts

```bash
bun run dev
bun run start
bun run build
bun run test
bun run lint
bun run check-types

# quiz helpers
bun run quiz:seed
bun run quiz:test
```

## Main Endpoints

- `GET /health`
- `GET /docs` (Swagger UI)
- `GET /docs-ws` (AsyncAPI viewer)
- `GET /docs-ws/asyncapi.yaml`
- `WS /api/quiz/battle`

## Integration Test Scripts

```bash
# Linux/macOS
chmod +x test-all-api.sh
./test-all-api.sh
./test-all-api.sh -s

# Windows PowerShell
.\test-all-api.ps1
.\test-all-api.ps1 -s
```

`-s` akan menjalankan server otomatis sebelum test lalu mematikannya setelah selesai.
