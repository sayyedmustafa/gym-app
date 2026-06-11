# Gym app

A multi-tenant gym management web app for owners and staff to manage members, plans, payments, and WhatsApp reminders.

## Features

- **Google Sign-in** — Secure authentication via Supabase Auth
- **Multi-tenant** — Create a gym or join one via invite code
- **Member Management** — Add members with name, phone, photo, plan, and start date
- **Status Tracking** — Active, Expiring Soon (7 days), Expired, Frozen
- **Membership Plans** — Create plans with pricing, duration, and freeze/pause support
- **Payment Logging** — Record payments (cash/card/UPI) with automatic membership extension
- **WhatsApp Reminders** — Per-member button or bulk "Remind All Expiring" (opens wa.me links)
- **Role-based Access** — Owner (full admin) vs Staff (day-to-day operations)
- **Multiple Owners** — A gym can have multiple owners
- **Revenue Dashboard** — Monthly revenue visible to owners only
- **Responsive UI** — Desktop sidebar + mobile bottom navigation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v3, shadcn/ui-inspired components |
| State | Zustand (auth/gym), TanStack Query (server state) |
| Forms | React Hook Form + Zod validation |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Hosting | GitHub Pages (frontend), Supabase (backend) |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- Google OAuth credentials configured in Supabase

### Setup

```bash
# Clone the repo
git clone https://github.com/sayyedmustafa/gym-app.git
cd gym-app

# Install dependencies
npm install

# Copy env file and fill in your Supabase credentials
cp .env.example .env.local

# Start dev server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI primitives (Button, Card, Badge, etc.)
│   ├── AppShell.tsx     # Layout: sidebar (desktop) + bottom nav (mobile)
│   ├── StatusBadge.tsx  # Member status indicator
│   └── guards.tsx       # Route guards (RequireAuth, RequireGym)
├── lib/
│   ├── supabase.ts      # Supabase client
│   ├── utils.ts         # cn(), formatINR()
│   └── whatsapp.ts      # WhatsApp deep-link builder
├── pages/
│   ├── Login.tsx        # Google sign-in
│   ├── Onboarding.tsx   # Create gym / Join via invite code
│   ├── Dashboard.tsx    # Stats overview
│   ├── Members.tsx      # Member list with tabs & actions
│   ├── Plans.tsx        # Membership plan CRUD
│   ├── Staff.tsx        # Team management & invite codes
│   └── Settings.tsx     # Gym & profile settings
├── stores/auth.ts       # Zustand auth + gym switcher store
├── types/database.ts    # TypeScript types for DB schema
├── router.tsx           # React Router config
├── App.tsx              # Root component (QueryClient + Router + Toaster)
└── main.tsx             # Entry point
```

## Role Permissions

| Action | Owner | Staff |
|--------|:-----:|:-----:|
| View Dashboard (counts) | ✅ | ✅ |
| View Revenue | ✅ | ❌ |
| Add/Edit Members | ✅ | ✅ |
| Delete Members | ✅ | ❌ |
| Record Payments | ✅ | ✅ |
| View Payment History | ✅ | ❌ |
| Manage Plans (CRUD) | ✅ | ❌ |
| Generate Invite Codes | ✅ | ❌ |
| Promote/Demote Staff | ✅ | ❌ |
| WhatsApp Reminders | ✅ | ✅ |

## Scripts

```bash
npm run dev      # Start dev server (hot reload)
npm run build    # Type-check + production build
npm run preview  # Preview production build locally
npm run lint     # ESLint
```

## Deployment

This app is configured to deploy to **GitHub Pages** using GitHub Actions (configured in `.github/workflows/deploy.yml`).

### Setup Instructions:

1. **Supabase Auth Configuration**:
   - In your Supabase Dashboard, go to **Authentication** -> **URL Configuration**.
   - Set the **Site URL** to: `https://<your-github-username>.github.io/gym-app/`
   - Add these URLs to **Redirect URLs**:
     - `https://<your-github-username>.github.io/gym-app/onboarding`
     - `http://localhost:5173/gym-app/onboarding` (for local development)

2. **Google Cloud Console Configuration**:
   - In the Google Cloud Console, ensure that the callback URL from Supabase is listed under **Authorized redirect URIs** in your OAuth 2.0 Client IDs credentials.

3. **Repository Actions Secrets**:
   - Push your code to your GitHub repository named `gym-app`.
   - Go to your repository **Settings** -> **Secrets and variables** -> **Actions**.
   - Create two repository secrets:
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key

4. **GitHub Pages Activation**:
   - Go to your repository **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select **GitHub Actions**.
   - Push your changes to the `main` branch to trigger the build and deployment.

## License

MIT