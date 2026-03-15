## Deployment to Render

This project is a monorepo with:

- `backend/` – Express + MongoDB API
- `frontend-customer/` – Vite React app for customers
- `frontend-owner/` – Vite React app for cafe owners

All services are Node 18 compatible.

---

## 1. Backend (Render Web Service)

### Repository path

- Root: this repo
- Service root: `backend`

### Environment

- **Runtime**: Node `18.x`

`backend/package.json` already specifies:

```json
"engines": {
  "node": "18.x"
}
```

### Build & start commands

- **Build command**: `npm install`
- **Start command**: `npm start`

`backend/package.json`:

```json
"scripts": {
  "dev": "nodemon src/server.js",
  "start": "node src/server.js"
}
```

### Required environment variables

Create these in Render for the backend service (or from `.env` when running locally):

```bash
MONGO_URI=your-mongodb-connection-string
PORT=5000
NODE_ENV=production

JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

FRONTEND_URL=https://yourdomain.com
# Optional: comma‑separated list of allowed origins
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

SMS_PROVIDER=mock
FAST2SMS_API_KEY=your-fast2sms-api-key
```

Notes:

- `PORT` is managed by Render. The app reads `process.env.PORT || 5000` and will use the Render port automatically.
- `FRONTEND_URL` and `CORS_ORIGINS` are used to configure CORS.

### CORS configuration

`backend/src/app.js` uses:

```js
const allowedOrigins = [];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.CORS_ORIGINS) {
  allowedOrigins.push(
    ...process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  );
}

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : undefined,
    credentials: true,
  })
);
```

For a domain from GoDaddy, set:

- `FRONTEND_URL=https://yourdomain.com`
- `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`

### Logs & health check

- On startup, the server logs:

```js
console.log(`Server running on port ${PORT}`);
```

- Health endpoint:

```txt
GET /health
```

This returns basic uptime and timestamp information and can be used for Render health checks.

---

## 2. Frontend – Customer (Render Static Site)

### Repository path

- Service root: `frontend-customer`

### Environment

In Render Static Site settings, set:

```bash
VITE_API_URL=https://your-backend-service.onrender.com
```

### Build & publish

- **Build command**: `npm install && npm run build`
- **Publish directory**: `dist`

`frontend-customer/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

### API base URL

`frontend-customer/src/main.jsx` configures Axios with the environment base URL:

```js
import axios from 'axios';

axios.defaults.baseURL = import.meta.env.VITE_API_URL;
```

All API calls (e.g. `/api/menu`, `/api/orders`, etc.) will go through this base URL in production.

---

## 3. Frontend – Owner (Render Static Site)

### Repository path

- Service root: `frontend-owner`

### Environment

In Render Static Site settings, set:

```bash
VITE_API_URL=https://your-backend-service.onrender.com
```

You can point both frontends at the same backend URL.

### Build & publish

- **Build command**: `npm install && npm run build`
- **Publish directory**: `dist`

`frontend-owner/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

### API base URL

`frontend-owner/src/main.jsx` also configures Axios globally:

```js
import axios from 'axios';

axios.defaults.baseURL = import.meta.env.VITE_API_URL;
```

All owner dashboard API calls use this base URL.

---

## 4. Node version

All three `package.json` files (`backend`, `frontend-customer`, `frontend-owner`) specify:

```json
"engines": {
  "node": "18.x"
}
```

Render will automatically pick a compatible Node 18 runtime.

---

## 5. Monorepo layout

The repository is structured as:

```txt
project
 ├ backend
 │   ├ src
 │   │   ├ app.js
 │   │   └ server.js
 │   ├ package.json
 │   └ .env.example
 ├ frontend-customer
 │   ├ src
 │   ├ package.json
 │   └ .env.example
 ├ frontend-owner
 │   ├ src
 │   ├ package.json
 │   └ .env.example
 └ DEPLOYMENT.md
```

Use three separate Render services (one Web Service for `backend`, two Static Sites for the frontends) pointing to the appropriate subdirectories.

