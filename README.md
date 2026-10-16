# DevSync — full-stack real-time collaboration workspace

DevSync is a portfolio-ready learning project built around the React and Node.js concepts shown in the supplied course screenshots. It includes an authenticated workspace, projects, tasks, real-time task updates, and a topic checklist.

## Current features

- Register and log in with password hashing (bcrypt) and JWT authentication.
- Protected frontend routes and authenticated REST endpoints.
- Create projects and create, update, and delete tasks.
- Task workflow: To do → In progress → Completed, with priorities and descriptions.
- Real-time task events with Socket.IO. Connected project members see updates without refreshing.
- MongoDB persistence with Mongoose schemas and indexes.
- Request validation with Zod, centralized errors, Helmet, CORS allow-list, and API rate limiting.
- Responsive dashboard, project board, settings, and React/Node learning roadmap.
- Learning checklist saved locally in the browser.

## Stack

- Frontend: React 18, Vite, React Router, Context API, hooks, Styled Components, Axios, Socket.IO Client, Lucide icons.
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, Zod, Socket.IO.

## Requirements

- Node.js 20 or newer (LTS recommended)
- npm 10 or newer
- MongoDB local instance or MongoDB Atlas database

## Run locally

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create `server/.env` from `server/.env.example` and set `MONGODB_URI`, a long random `JWT_SECRET`, and `CLIENT_URL=http://localhost:5173`.

3. Create `client/.env` from `client/.env.example`. Defaults work for local development.

4. Start both services from the root:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`, create an account, then create a project and add tasks.

API health check: `http://localhost:5000/api/health`

## Main API routes

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | API health | No |
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/me` | Current user | Yes |
| GET | `/api/projects` | List accessible projects | Yes |
| POST | `/api/projects` | Create project | Yes |
| GET | `/api/projects/:projectId` | Get project and tasks | Yes |
| POST | `/api/projects/:projectId/tasks` | Create task | Yes |
| PATCH | `/api/projects/:projectId/tasks/:taskId` | Update task | Yes |
| DELETE | `/api/projects/:projectId/tasks/:taskId` | Delete task | Yes |

Send authenticated requests with `Authorization: Bearer <token>`.

## Deployment

### 1. Database — MongoDB Atlas

Create a cluster, create a database user, configure network access appropriately, and copy the connection string. Do not commit it to Git.

### 2. Backend — Render (Web Service)

- Connect the GitHub repository.
- Root directory: `server` (or configure the service for the monorepo workspace).
- Build command: `npm install` from repository root if using npm workspaces; otherwise install from `server`.
- Start command: `npm start`.
- Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (the deployed frontend origin), and `NODE_ENV=production`.
- Use a Render plan that supports persistent WebSocket connections for Socket.IO.

### 3. Frontend — Vercel

- Import the repository and set the root directory to `client`.
- Build command: `npm run build`; output directory: `dist`.
- Set `VITE_API_URL` to the deployed API base URL ending in `/api`.
- Set `VITE_SOCKET_URL` to the deployed API origin (without `/api`).
- Configure SPA rewrites so direct navigation to routes such as `/projects/:projectId` serves `index.html`.

### 4. CORS and smoke test

Set the backend `CLIENT_URL` to the exact deployed frontend origin. Verify registration/login, project creation, task updates, and two-browser real-time updates. Use HTTPS in production.

## Important production-hardening backlog

This is a working portfolio starter, not a security-audited commercial product. Before production use, consider:

- Move JWTs from localStorage to secure, HttpOnly, SameSite cookies and add CSRF protection where applicable.
- Add refresh-token rotation, email verification, password reset, account deletion, and session revocation.
- Add project invitations/member management UI and role-based permissions.
- Add persistent chat/messages, notifications, file uploads, and activity history.
- Add automated integration tests and CI checks; validate all error paths and access-control cases.
- Add pagination for large collections, structured logging, monitoring, backups, and deployment health checks.
- Configure a shared Socket.IO adapter if deploying multiple API instances.

## Suggested placement learning path

1. Understand React components, props, state, lists, lifecycle/effects, Context API, Router, and Styled Components.
2. Trace a UI action from React → Axios → Express route → Zod validation → Mongoose → response.
3. Inspect JWT authentication middleware and password hashing; explain authentication versus authorization.
4. Open two browser sessions and observe Socket.IO task events.
5. Add project invitations and role permissions, then test forbidden access.
6. Write frontend and backend tests, add GitHub Actions CI, and deploy both services.

## Repository layout

```text
devsync/
  client/       React + Vite application
  server/       Express API + Socket.IO
  package.json  npm workspaces and root scripts
```
