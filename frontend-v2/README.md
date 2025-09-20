# NFL Fantasy Parlay Challenge

A full-stack fantasy sports application where users create leagues, make picks on NFL games, and compete for points. Built with Next.js, Supabase, and ESPN API integration.

## Features

### 🏈 **NFL Game Integration**
- **Global Games Architecture** - All NFL games shared across fantasy leagues
- **ESPN API Integration** - Real-time game data, scores, and updates
- **Automated Scoring** - Picks evaluated when games complete
- **Multi-format Betting** - Moneyline, spread, and totals

### 🏆 **League Management**
- **Create/Join Leagues** - Admin controls with invite system
- **Multiple Seasons** - Each league can have multiple fantasy seasons
- **Member Management** - Invite codes and membership controls
- **Access Control** - Row-level security for data privacy

### 📊 **Pick & Scoring System**
- **Weekly Picks** - One pick per user per week
- **Live Tracking** - Real-time game status and pick results
- **Points System** - Configurable scoring rules per league
- **Leaderboards** - Season and weekly rankings

### 🔒 **Security & Performance**
- **Row-Level Security (RLS)** - Comprehensive database security
- **Rate Limiting** - API protection and abuse prevention
- **Optimistic Updates** - Fast UI with TanStack Query
- **Real-time Data** - Live game updates and scoring

## Architecture

### Frontend Stack
- **Next.js 14** - App Router, Server Components
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Server state management
- **Zustand** - Client state management

### Backend Stack
- **Supabase** - PostgreSQL database with RLS
- **Next.js API Routes** - Server-side API endpoints
- **ESPN API** - Game data and live scores
- **Row-Level Security** - Database-level access control

### Database Schema

#### Core Tables
- **`games`** - Global NFL games (ESPN sourced)
- **`teams`** - NFL teams with ESPN mapping
- **`leagues`** - Fantasy leagues created by users
- **`seasons`** - Fantasy seasons within leagues
- **`picks`** - User picks with season context
- **`odds`** - Game odds from multiple sources

#### Supporting Tables
- **`league_memberships`** - User access to leagues
- **`scoring_events`** - Audit log for automated scoring
- **`odds_source_mapping`** - Maps external odds to internal games
- **`user_season_stats`** - Aggregated user performance

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase recommended)
- ESPN API access (optional - games can be manually seeded)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd frontend-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```

   Configure your environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Database Setup**

   Run the database migrations in order:
   ```sql
   -- 1. Run the main schema (from your existing database)
   -- 2. Apply ESPN architecture updates
   \i espn-architecture-migration.sql

   -- 3. Migrate to global games architecture
   \i remove-season-from-games-migration-v3-secure.sql
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Data Architecture

### Global Games Model
The application uses a **global games architecture** where:

- **NFL games exist once** - Shared across all fantasy leagues
- **Picks provide context** - `picks.season_id` links picks to fantasy seasons
- **No duplication** - 272 NFL games serve unlimited fantasy leagues

### Security Model
- **League-based access** - Users see data only for their leagues
- **Admin controls** - League creators manage seasons and settings
- **User privacy** - RLS ensures picks are only visible to league members
- **Service role** - Automated processes use elevated permissions

## API Endpoints

### Games
- `GET /api/games?season_id={id}` - All NFL games (global)
- `GET /api/games?season_id={id}&week={week}` - Week-filtered games

### Picks
- `GET /api/picks?season_id={id}&week={week}&user_only=true` - User picks
- `POST /api/picks?season_id={id}` - Create pick

### Leagues
- `GET /api/leagues/{id}/members` - League membership
- `GET /api/league-picks?league_id={id}&week={week}` - All league picks

### Seasons
- `GET /api/seasons/{id}` - Season details
- `GET /api/leaderboard?type=season&season_id={id}` - Rankings

## Development

### Key Files
- **`src/app/leagues/[leagueId]/seasons/[seasonId]/page.tsx`** - Main season page
- **`src/hooks/useGames.ts`** - Game data fetching
- **`src/hooks/usePicks.ts`** - Pick management
- **`src/components/MakePickModal.tsx`** - Pick creation UI

### Database Migrations
The application has evolved through several architectural changes:

1. **Initial Schema** - Season-specific games
2. **ESPN Integration** - Added ESPN fields and automated scoring
3. **Global Games** - Moved to shared game pool with RLS security

### Testing
```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests (if configured)
npm test
```

## Deployment

### Environment Variables (Production)
```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
DATABASE_URL=your_production_database_url
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm start
```

## Migration Notes

If upgrading from an older version, ensure you've run all migrations:

1. **ESPN Architecture Migration** - Adds ESPN integration
2. **Global Games Migration** - Removes `season_id` from games, adds to picks
3. **Security Migration** - Updates RLS policies for new architecture

## Contributing

1. Follow TypeScript best practices
2. Use the existing component patterns
3. Ensure RLS policies are maintained for security
4. Test with multiple leagues and users

## Support

For issues or questions:
1. Check the migration logs in `espn_api_calls` table
2. Verify RLS policies are working correctly
3. Ensure API endpoints return expected data structure

---

Built with ❤️ for fantasy football enthusiasts