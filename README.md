# mold-inspector

Node.js + React web service for mold inspection workflows.

## Environment variables

- `APP_USERNAME` (default: `admin`)
- `APP_PASSWORD` (default: `password`)
- `PORT` (default: `3000`)
- `DATABASE_URL` — PostgreSQL connection string. When set, the app uses PostgreSQL for persistent storage. When omitted, an in-memory store is used (data is lost on restart).
- `DATABASE_SSL` — Set to `false` to disable SSL for the database connection (e.g. for local PostgreSQL). Defaults to enabled for non-localhost connections.
- `DATABASE_SSL_REJECT_UNAUTHORIZED` — Set to `false` to allow self-signed certificates (required for Render's internal PostgreSQL URLs). Defaults to `true` (strict certificate verification).

## Run locally

```bash
npm install
npm run build
npm start
```

App: `http://localhost:3000`

### Development

Run API server:

```bash
npm run dev
```

Run frontend dev server (in a separate terminal):

```bash
npm --prefix client run dev
```

## Deploy to Render

### 1. Create a PostgreSQL database

1. In Render, click **New → PostgreSQL**.
2. Fill in a name (e.g. `mold-inspector-db`) and choose a region.
3. Click **Create Database** and wait for it to be ready.
4. From the database dashboard, copy the **Internal Database URL** (used for services in the same Render region).

### 2. Create the web service

1. Click **New → Web Service** and connect the repository.
2. Use these settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
3. Add environment variables in Render:
   - `APP_USERNAME`
   - `APP_PASSWORD`
   - `DATABASE_URL` — paste the **Internal Database URL** copied from the PostgreSQL dashboard
   - `DATABASE_SSL_REJECT_UNAUTHORIZED` → `false` — required because Render's internal PostgreSQL uses a self-signed certificate
4. Deploy the service.

Render will provide the `PORT` value automatically.

> **Tip:** The app creates all required database tables automatically on startup.
