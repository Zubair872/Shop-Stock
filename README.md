# Shop Stock (Vue 3 + Express + MongoDB)

Dukaan ka stock, sale (POS), orders aur munafa ka hisab.

## Chalane ka tareeqa (local)
```bash
cd backend && cp .env.example .env     # MONGO_URI aur JWT_SECRET bharein (NODE_ENV=development kar dein)
npm install && npm run dev             # http://localhost:3001

cd frontend && npm install && npm run dev   # vite /api ko khud backend tak bhejta hai
```
Tests: `cd backend && npm test`

## Free deployment (Render + MongoDB Atlas)
1. Create a free MongoDB Atlas cluster and database user. Allow the Render outbound IP range
   (or `0.0.0.0/0` with a strong database password), then copy the connection string.
2. Push this repository to GitHub.
3. In Render, choose **New → Blueprint**, select this repository, and apply `render.yaml`.
4. Open the `shop-stock-api` service environment settings and set `MONGO_URI` to the Atlas
   connection string. Render generates `JWT_SECRET` automatically.
5. After deployment, open `https://shop-stock-web.onrender.com`. Free Render services may sleep
   when idle, so the first request can take several seconds.

The application cannot create the Atlas/Render accounts or enter their secrets automatically.

## Production se pehle zaroor karein
1. `JWT_SECRET` kam az kam 32 characters (warna server start nahi hoga).
2. Frontend alag domain par ho to backend mein `CORS_ORIGIN=https://frontend-domain` set karein
   (khaali ho to production mein sirf same-origin chalta hai). Frontend mein `VITE_API_BASE_URL=https://backend-domain/api`.
3. Pehla account banane ke baad `ALLOW_REGISTRATION=false`.
4. Docker se: `.env` mein `JWT_SECRET=...` likhein, phir `docker compose up --build` (app: http://localhost:8080).

## Naye features
Sale par discount, payment method (cash/card/wallet), customer naam/phone; order cancel (stock wapas);
double-click par duplicate order se hifazat (Idempotency-Key); restock aur wastage API; stock history;
kg/litre mein decimal quantity; munafa (cost price se); dashboard (aaj, 7/30/90 din, chart, top products,
kam stock, expiry); CSV export (orders, products); order pagination/filters; password change; health checks.

## Security
Rate limiting (login/register/API), security headers, JWT HS256 only, timing-safe login,
atomic stock updates, price hamesha server se. Rate limiter in-memory hai: serverless par partial hifazat.

## Maloom hadein
- MongoDB transactions nahi hain; sale/cancel beech mein fail ho to compensation chalti hai (rare edge case).
- Frontend par automated tests nahi hain.
