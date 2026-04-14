# College Event Management (MERN)

A simple MERN application with:
- Public website to view events and register without authentication
- QR-based event pass generation after registration
- Admin panel with email/password login
- Admin signup approval controlled by super-admin
- Admin-only access for viewing all registrations and creating events

## Chosen Vertical

Campus Event Operations and Engagement (EventTech).

This project focuses on solving operational and attendee-experience challenges in college events:
- registration and entry validation,
- live command operations,
- crowd and queue visibility,
- venue navigation,
- food ordering and service lifecycle,
- attendee notifications and status tracking.

## Approach and Logic

- Phase-first delivery:
  Build in incremental phases so each module is independently deployable and testable.
- Domain module separation:
  Keep backend modules focused by domain (`auth`, `events`, `queues`, `navigation`, `food`, `user`) to reduce coupling and simplify maintenance.
- Realtime plus API model:
  Use REST APIs for source-of-truth writes and reads, and Socket.IO for live operational updates.
- Security baseline by default:
  JWT auth, role/permission guards, rate limiting, and audit logs are integrated into critical flows.
- Feature-flagged evolution:
  User-facing Phase 2 capabilities (Google login, dashboard) are toggled by env flags to avoid unsafe partial releases.

## How the Solution Works

1. Event discovery and registration:
  Public users browse events and register; system creates a registration with a unique pass ID and QR payload.
2. Entry and command operations:
  Admin scans passes, prevents duplicate check-ins, updates live event operations, and monitors command center metrics.
3. Queue and navigation intelligence:
  Queue points can be managed live; attendees can join virtual queues and fetch route hints for venue movement.
4. User companion layer:
  Optional Google-authenticated users can view tickets, notifications, and live event updates in dashboard.
5. Food and services lifecycle:
  Admin manages stalls and catalog; attendees place orders by pass ID; orders progress through status lifecycle (`placed` to `accepted` to `preparing` to `ready` to `picked-up/cancelled`).
6. Realtime communication:
  Operational updates, broadcasts, and order events are emitted to relevant admin/user sockets while persistent data remains in MongoDB.

## Assumptions Made

- College event teams operate with two admin roles: `admin` and `super-admin`.
- Event capacity is informational and does not hard-block registrations.
- Pass ID is treated as the lightweight attendee credential for queue and food operations.
- Payment integration is out of scope for current food ordering phase.
- Venue map geometry and route hints are manually configured by admins.
- CORS allowlist is managed through environment variables for multi-deployment frontend origins.
- Realtime updates are best-effort and complemented by API polling/read endpoints for consistency.

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
- Trigger SOS emergency alerts using pass ID
- Get nearest-exit guidance from venue map zones
- Create and join social groups with consent-based location sharing
- View smart guidance recommendations (least-crowded gate, arrival window, rush forecast)

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
- Emergency and social foundation
  - Monitor and resolve SOS incidents
  - Send event emergency broadcasts
  - View social group activity summary
- Rule-based intelligence (Phase 6)
  - Generate deterministic event recommendations from telemetry
  - Recommend least-crowded entry gate and best arrival window
  - Predict near-term rush trend from queue/check-in velocities
  - Visualize recent check-in and queue-join momentum buckets
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
- `GET /api/public/events/:eventId/intelligence/recommendations`
- `GET /api/public/events/:eventId/emergency/nearest-exit?from=...`
- `POST /api/public/events/:eventId/emergency/sos`
- `GET /api/public/events/:eventId/food/catalog`
- `POST /api/public/events/:eventId/food/orders`
- `GET /api/public/food/orders/:orderId?passId=...`
- `POST /api/public/events/:eventId/social/groups`
- `POST /api/public/events/:eventId/social/groups/:groupCode/join`
- `PATCH /api/public/events/:eventId/social/groups/:groupCode/location`
- `GET /api/public/events/:eventId/social/groups/:groupCode?passId=...`
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
- `POST /api/admin/events/:eventId/emergency/broadcast`
- `GET /api/admin/events/:eventId/emergency/incidents`
- `PATCH /api/admin/emergency/incidents/:incidentId`
- `GET /api/admin/events/:eventId/social/groups`
- `GET /api/admin/events/:eventId/intelligence/insights`
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

Phase 5 foundation started with emergency and social backend:
- New Mongo models for emergency incidents and social groups
- Public SOS, nearest-exit, and social-group APIs
- Admin emergency incident panel, emergency broadcast, and social-group monitoring APIs

Phase 6 rule-based intelligence implemented:
- Backend intelligence controller derives recommendations from registrations, check-ins, queue load, and live operations
- Public recommendation API for smart gate, arrival, and rush guidance
- Admin intelligence insights API with telemetry and 15-minute historical momentum buckets
- Frontend pages added: public smart guidance (`/events/:eventId/intelligence`) and admin intelligence console (`/admin/intelligence`)
