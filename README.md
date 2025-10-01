MBTI Chat Fullstack Demo
========================

This archive contains a minimal **full-stack** scaffold for the MBTI Chat app:
- frontend/ - Vite + React + Tailwind (calls backend API)
- backend/  - Express + Prisma + PostgreSQL (JWT auth)

### Important notes
- The backend uses **Prisma**. After you deploy, run migrations with Prisma to create tables.
- The `.env.example` in backend/ shows required env vars: `DATABASE_URL`, `JWT_SECRET`, `PORT`.

### Quick local dev (backend)
1. cd backend
2. npm install
3. Set env vars (copy .env.example -> .env) and edit DATABASE_URL to point to local Postgres.
4. npx prisma generate
5. npx prisma migrate dev --name init
6. npm run dev
7. Backend will run on localhost:4000 by default.

### Quick local dev (frontend)
1. cd frontend
2. npm install
3. Set `VITE_API_URL` in frontend `.env` or run Vite with env var (default is http://localhost:4000)
4. npm run dev

### Deploy on Render
1. Create a Postgres instance on Render and copy DATABASE_URL.
2. Push repo to GitHub.
3. Create a **Web Service** in Render for the backend:
   - Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Start Command: `npm start`
   - Add environment variables: `DATABASE_URL`, `JWT_SECRET`
4. Create a **Static Site** in Render for the frontend:
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Add env var `VITE_API_URL` pointing to your backend URL.

Notes for production:
- Replace JWT secret and consider httpOnly cookies + refresh tokens for improved security.
- Integrate a real ad provider and server-side verification for ad watches if monetizing.
- Add rate limits, CAPTCHAs, email verification, and more robust error handling.

This project intentionally keeps the backend concise so you can inspect and extend it.

