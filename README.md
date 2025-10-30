## Stateflow — Backend (API)

TypeScript Node/Express API with MongoDB, Passport (Google/Local), Socket.IO, and a service/controller architecture.

### Tech Stack
- Node.js, Express, TypeScript
- MongoDB with Mongoose
- Passport (Google OAuth 2.0, Local)
- JWT auth, cookie-session
- Socket.IO for realtime collaboration and notifications
- Zod for validation

### Requirements
- Node.js 18+
- MongoDB (local or Atlas)

### Install
```
pnpm i        # or npm i / yarn
```

### Environment Variables
Create `backend/.env` with:

```
NODE_ENV=development
PORT=8000
BASE_PATH=/api

# Mongo
MONGO_URI=mongodb://localhost:27017/stateflow

# Sessions / JWT
SESSION_SECRET=change_me
SESSION_EXPIRES_IN=7d
JWT_SECRET=another_secret

# Google OAuth
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback

# Frontend
FRONTEND_ORIGIN=localhost
FRONTEND_GOOGLE_CALLBACK_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173

# Optional AI
GEMINI_API_KEY=your_key
```

Notes:
- `CLIENT_URL` is used by Socket.IO CORS (`src/services/collaboration.service.ts`).
- Config reading lives in `src/config/app.config.ts` via `utils/get-env.ts`.

### Scripts
From `backend/package.json`:
```
pnpm dev      # ts-node-dev, watches src/index.ts
pnpm build    # tsc → outputs to dist/, copies package.json
pnpm start    # node dist/index.js
pnpm seed     # seed roles (src/seeders/role.seeder.ts)
```

### Project Structure (high level)
```
src/
  config/               # env, http/passport config
  controllers/          # route handlers
  middlewares/
  models/               # mongoose schemas
  services/             # business logic (auth, member, page, task, etc.)
  routes/               # express routers
  utils/
  seeders/
  index.ts              # app bootstrap
```

Key areas:
- Auth: `src/controllers/auth.controller.ts`, `src/services/auth.service.ts`
- Collaboration sockets: `src/services/collaboration.service.ts`
- Pages/Tasks/Projects: respective controllers + services + models

### Run Locally
1) Start MongoDB
2) Seed roles (optional): `pnpm seed`
3) Start API: `pnpm dev` (http://localhost:8000)

### Build & Run
```
pnpm build
pnpm start
```

### API Base URL
- Defaults to `http://localhost:8000/api` (`BASE_PATH=/api`). The frontend uses `VITE_API_BASE_URL` to call this.

### CORS & Sockets
- Socket CORS origin is `process.env.CLIENT_URL || "http://localhost:5173"`.
- Ensure this matches the frontend dev URL and any deployed URL.

### Google OAuth Naming
If Google shows a different app name (e.g., “NeuralDocs”), change it in Google Cloud Console → APIs & Services → OAuth consent screen (App name, logo). This is not controlled by the API.

### Deployment Tips
- Set all secrets via environment variables in your host.
- Build, then run from `dist/`.
- Configure allowed origins for CORS and Socket.IO.


