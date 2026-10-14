## Deployment Notes

This project is a monorepo with:

- `backend/` – Express + MongoDB API
- `frontend-customer/` – Vite React app for customers
- `frontend-owner/` – Vite React app for cafe owners

The current package `engines` fields use **Node 24.x**.

---

## Backend Service

### Service root

```text
backend
```

### Runtime

Use Node `24.x`, matching `backend/package.json`:

```json
"engines": {
  "node": "24.x"
}
```

### Build and start

```bash
npm install
npm start
```

`npm start` runs:

```bash
node src/server.js
```

### Backend environment variables

```env
MONGO_URI=your-mongodb-connection-string
NODE_ENV=production
JWT_SECRET=your-long-random-secret-min-32-chars
JWT_EXPIRES_IN=7d

FRONTEND_URL=https://your-customer-frontend-url.com
CORS_ORIGINS=https://your-customer-frontend-url.com,https://your-owner-frontend-url.com

CREATE_DEFAULT_OWNER=false
DEFAULT_OWNER_PHONE=
DEFAULT_OWNER_PASSWORD=
DEFAULT_OWNER_NAME=Cafe Owner
DEFAULT_OWNER_USERNAME=

SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your-fast2sms-api-key

ENABLE_PAYMENT=true
```

### Port

Do not hardcode a production port on Render/Fly/etc. The server uses:

```js
const PORT = process.env.PORT || 3000;
```

For local development, set this in `backend/.env` if you want the README default:

```env
PORT=5000
```

Then the backend runs at:

```text
http://localhost:5000
```

---

## Customer Frontend

### Service root

```text
frontend-customer
```

### Build and publish

```bash
npm install && npm run build
```

Publish directory:

```text
dist
```

### Customer frontend environment variables

```env
VITE_API_URL=https://your-backend-url.com
VITE_ENABLE_PAYMENT=true
VITE_UPI_ID=cafe@upi
VITE_CAFE_NAME=Cafe%20Saarchi
```

Local development default:

```env
VITE_API_URL=http://localhost:5000
```

---

## Owner Frontend

### Service root

```text
frontend-owner
```

### Build and publish

```bash
npm install && npm run build
```

Publish directory:

```text
dist
```

### Owner frontend environment variables

```env
VITE_API_URL=https://your-backend-url.com
VITE_ENABLE_PAYMENT=true
```

Local development default:

```env
VITE_API_URL=http://localhost:5000
```

---

## OTP Provider Environments

`SMS_PROVIDER` controls OTP delivery:

| Provider | Use case | Behavior |
|---|---|---|
| `mock` | local development only | logs OTP in backend console |
| `website` | demo only | returns OTP in API response so frontend can display it |
| `fast2sms` | production-like deployment | sends OTP through Fast2SMS |

Recommended setup:

```env
# Local development
SMS_PROVIDER=mock

# Portfolio demo only
SMS_PROVIDER=website

# Production-like deployment
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your-fast2sms-api-key
```

Do not use `mock` or `website` for a real cafe deployment.

---

## Owner Bootstrap

Default owner creation is disabled unless explicitly enabled:

```env
CREATE_DEFAULT_OWNER=false
```

To create an owner during local setup:

```env
CREATE_DEFAULT_OWNER=true
DEFAULT_OWNER_PHONE=your-owner-phone
DEFAULT_OWNER_PASSWORD=your-strong-password
DEFAULT_OWNER_NAME=Cafe Owner
DEFAULT_OWNER_USERNAME=owner
```

Start the backend once, then set `CREATE_DEFAULT_OWNER=false` again. Never use weak or shared owner credentials.

---

## Deployment Checklist

- Backend has `MONGO_URI`, `JWT_SECRET`, CORS, and OTP provider configured.
- Customer frontend has `VITE_API_URL` pointing to backend.
- Owner frontend has `VITE_API_URL` pointing to backend.
- `CREATE_DEFAULT_OWNER` is disabled after owner bootstrap.
- `mock` / `website` OTP providers are not used for real cafe deployment.
- Payment flow is understood: customer submits payment claim, owner confirms final paid status.
