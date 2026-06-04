# mold-inspector

Node.js + React web service for mold inspection workflows.

## Environment variables

- `APP_USERNAME` (default: `admin`)
- `APP_PASSWORD` (default: `password`)
- `PORT` (default: `3000`)

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

1. Push this repository to GitHub.
2. In Render, create a new **Web Service** and connect the repository.
3. Use these settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Add environment variables in Render:
   - `APP_USERNAME`
   - `APP_PASSWORD`
5. Deploy the service.

Render will provide the `PORT` value automatically.
