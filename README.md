# NFL Fantasy Parlay Challenge

> **⚠️ Work in Progress** - This application is currently under active development. Features may be incomplete, and breaking changes may occur.

A full-stack fantasy sports application where users create leagues, make picks on NFL games, and compete for points. Built with Next.js, Supabase, and ESPN API integration.

## Features

- **NFL Game Integration** - Real-time ESPN data with automated scoring
- **League Management** - Create/join leagues with admin controls
- **Weekly Picks** - Moneyline, spread, and totals betting
- **Live Tracking** - Real-time game status and results
- **Leaderboards** - Season and weekly rankings

## Tech Stack

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, TanStack Query
**Backend:** Supabase, PostgreSQL, ESPN API
**Security:** Row-Level Security (RLS), rate limiting

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

1. **Clone and install**
   ```bash
   git clone [repository-url]
   cd frontend-v2
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```

   Add your Supabase credentials to `.env.local`

3. **Database Setup**
   Run the provided SQL migrations in your Supabase dashboard

4. **Start Development**
   ```bash
   npm run dev
   ```

## Architecture

The app uses a global games model where NFL games are shared across all leagues, with picks linked to specific fantasy seasons. Row-level security ensures users only see data from their leagues.

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

## Contributing

1. Follow TypeScript best practices
2. Maintain RLS policies for security
3. Test with multiple leagues and users