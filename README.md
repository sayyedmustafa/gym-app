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
| Hosting | Vercel (frontend), Supabase (backend) |

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

1. Push to GitHub
2. Import repo on [Vercel](https://vercel.com)
3. Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy
5. Add the Vercel URL to:
   - Supabase Auth → Site URL & Redirect URLs
   - Google OAuth → Authorized redirect URIs

## License

MIT