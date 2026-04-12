# College Event Management (MERN)

A simple MERN application with:
- Public website to view events and register without authentication
- QR-based event pass generation after registration
- Admin panel with email/password login
- Admin signup approval controlled by super-admin
- Admin-only access for viewing all registrations and creating events

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, React Router, Axios
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, express-rate-limit

## Project Structure

```text
College Event Management/
  Client/
  Server/
  Readme.md
```

## Features Implemented

### Public
- View all active events
- View event details
- Register for events without login
- Receive QR pass with unique pass ID
- Reopen pass by pass ID
- Optional Google login for user dashboard (feature-flagged)
- User dashboard shell for profile, tickets, schedule, and in-app alerts (feature-flagged)
- View live queue and wait-time board (entry, food, restroom)
- Join virtual queue using event pass ID
- Track queue ticket status and position
- Explore smart navigation map for each event venue
- Request route hints between venue zones
- Browse food stalls and menu catalog for an event
- Place food orders using event pass ID
- Track food order lifecycle status

### Admin
- Register as admin (starts as pending)
- Login only if approved
- Create events
- View all registrations
- Super-admin can approve/reject pending admins
- Permission-gated admin operations (RBAC matrix with super-admin override)
- Real-time command center (live registrations, check-ins, crowd status)
- Smart ticket scanner with duplicate-entry prevention
- Queue and wait-time operations in command center
  - Create queue points
  - Update queue status and manual wait times
  - Serve next queue ticket
  - View queue analytics cards and throughput chart
- Event user broadcast alerts from command center (all registrants or checked-in audience)
- Realtime simulator controls for crowd and queue auto-updates
- Smart navigation map management APIs (save/reset template)
- Admin Navigation Editor page for zone and route-hint configuration
- Food and services operations foundation
  - Manage stalls and menu catalog per event
  - Monitor event food orders
  - Progress order lifecycle (placed -> accepted -> preparing -> ready -> picked-up/cancelled)
- Security hardening baseline
  - Route-level rate limiting for auth/admin mutations/public registration and queue joins
  - Socket auth hardening with permission checks and event room ID validation
  - Persistent audit logs for auth, scanner, queue, simulator, and event operations

## Business Rules Applied

- Super-admin is seeded manually (or via seed script)
- Every new admin requires super-admin approval before login
- Duplicate registrations with same email are allowed
- Event capacity is informational and does not block registration

## Prerequisites

- Node.js 18+
- MongoDB local instance or MongoDB Atlas connection string

## Backend Setup (Server)

1. Open terminal in `Server`
2. Install packages:

```bash
npm install
```

3. Create `.env` from `.env.example`
4. Configure environment values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/college_event_management
JWT_SECRET=replace_with_a_strong_secret
CLIENT_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-frontend-domain.com
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@college.edu
SUPER_ADMIN_PASSWORD=ChangeThisPassword123!
ENABLE_PHASE2_USER_AUTH=false
ENABLE_PHASE2_USER_DASHBOARD=false
GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
```

5. Seed super-admin account:

```bash
npm run seed:superadmin
```

6. Start backend server:

```bash
npm run dev
```

Backend base URL: `http://localhost:5000/api`

## Frontend Setup (Client)

1. Open terminal in `Client`
2. Install packages:

```bash
npm install
```

3. Create `.env` from `.env.example`
4. Set API URL:

```env
VITE_API_URL=http://localhost:5000/api
VITE_ENABLE_PHASE2_USER_AUTH=false
VITE_ENABLE_PHASE2_USER_DASHBOARD=false
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
```

5. Start frontend:

```bash
npm run dev
```

Frontend URL: `http://localhost:5173`

## API Summary

### Public Routes
- `GET /api/public/events`
- `GET /api/public/events/:id`
- `POST /api/public/events/:eventId/register`
- `GET /api/public/events/:eventId/queues`
- `POST /api/public/events/:eventId/queues/:queuePointId/join`
- `GET /api/public/events/:eventId/navigation`
- `GET /api/public/events/:eventId/navigation/route?from=...&to=...`
- `GET /api/public/events/:eventId/food/catalog`
- `POST /api/public/events/:eventId/food/orders`
- `GET /api/public/food/orders/:orderId?passId=...`
- `GET /api/public/queues/tickets/:ticketId`
- `GET /api/public/passes/:passId`

### Admin Auth Routes
- `POST /api/auth/admin/register`
- `POST /api/auth/admin/login`
- `GET /api/auth/admin/me` (Bearer token)

### User Routes (Phase 2 Feature-Flagged)
- `POST /api/user/auth/google`
- `GET /api/user/me` (Bearer user token)
- `GET /api/user/tickets` (Bearer user token)
- `GET /api/user/notifications` (Bearer user token)
- `PATCH /api/user/notifications/:notificationId/read` (Bearer user token)

### Admin Protected Routes
- `POST /api/admin/events`
- `GET /api/admin/events`
- `GET /api/admin/registrations`
- `GET /api/admin/command/summary`
- `POST /api/admin/scanner/check-in`
- `PATCH /api/admin/events/:eventId/live-ops`
- `POST /api/admin/events/:eventId/broadcast`
- `POST /api/admin/events/:eventId/food/stalls`
- `GET /api/admin/events/:eventId/food/stalls`
- `PATCH /api/admin/food/stalls/:stallId`
- `POST /api/admin/food/stalls/:stallId/items`
- `PATCH /api/admin/food/items/:itemId`
- `GET /api/admin/events/:eventId/food/orders`
- `PATCH /api/admin/food/orders/:orderId/status`
- `GET /api/admin/queues/overview`
- `GET /api/admin/queues/analytics`
- `POST /api/admin/events/:eventId/queues`
- `PATCH /api/admin/queues/:queuePointId`
- `POST /api/admin/queues/:queuePointId/serve-next`
- `GET /api/admin/simulator/status`
- `POST /api/admin/simulator/start`
- `POST /api/admin/simulator/stop`
- `GET /api/admin/events/:eventId/navigation`
- `PUT /api/admin/events/:eventId/navigation`
- `POST /api/admin/events/:eventId/navigation/reset`
- `GET /api/admin/admins/pending` (super-admin only)
- `PATCH /api/admin/admins/:adminId/approval` (super-admin only)

## Admin Workflow

1. Seed super-admin via backend seed script
2. Other admins register using Admin Register page
3. Super-admin logs in and approves/rejects pending admins
4. Approved admins can login and manage events/registrations

## Status

Initial MVP implementation is complete for public registration, QR pass generation, admin auth with approval gate, admin event creation, and admin registration visibility.

Phase 1 implementation started with real-time smart platform capabilities:
- Socket.io-based admin real-time channel
- Command Center page in admin panel (`/admin/command-center`)
- Webcam/manual ticket scanner in admin panel (`/admin/scanner`)
- Ticket check-in state tracking in registration records
- Duplicate-entry prevention at scan time
- Manual crowd status updates for event operations
- Queue and wait-time module with realtime command center updates
  - Public queue board page (`/events/:eventId/queues`)
  - Virtual queue join and status tracking
  - Admin queue controls and serve-next operations
  - Queue analytics metrics and throughput chart in command center
  - Event-wise analytics scope filter in command center
  - Simulator controls for auto crowd and wait-time updates
- Smart navigation module started
  - Public map and route-hint page (`/events/:eventId/navigation`)
  - Admin navigation editor (`/admin/navigation`)
  - Drag-and-drop zone repositioning in map preview
  - Save-time validation for duplicate zone codes and invalid route hints
  - Live inline route-quality warnings per route hint while editing
  - Field-level invalid input highlighting in route hint forms
  - One-click route quality quick-fix actions (auto endpoints, default steps, zone jump)
  - Undo/Redo history controls for safer rapid map edits
  - Admin save/reset navigation APIs

Cross-phase quality gates baseline implemented:
- Permission-aware authorization checks for sensitive admin APIs
- Rate limiting on authentication, scanner, admin write operations, and public high-frequency actions
- Audit trail persistence for key operational and security events

Phase 2 foundation implemented behind feature flags:
- Google user authentication backend (`/api/user/auth/google`)
- User profile and ticket dashboard APIs
- User in-app notification APIs with read-state tracking
- User socket namespace (`/user`) with event subscription support
- User dashboard shell routes on client (`/user/login`, `/dashboard`) when flags are enabled

Phase 4 foundation started with food and services backend:
- New Mongo models for stalls, catalog items, and food orders
- Public APIs for food catalog, order placement, and order status tracking
- Admin APIs for stall/catalog management and order lifecycle transitions
