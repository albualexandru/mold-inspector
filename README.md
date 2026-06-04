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
