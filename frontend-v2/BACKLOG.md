# Bozos Parlay Challenge - Development Backlog

## Current Status
✅ **COMPLETED**: Multi-league system and season management successfully implemented
- Users can create/join multiple leagues
- League switching via header dropdown
- Real Supabase integration with authentication
- Season creation and management (CRUD operations)
- Dashboard, submit, and leaderboard components using real data
- Fixed login flow to show league selection instead of auto-selecting

## Immediate Next Tasks

### 🎮 Pick Management System (HIGH PRIORITY)
- [ ] **User picks/bets system** - Core functionality for making picks
- [ ] **Pick submission interface** - UI for users to submit picks
- [ ] **Pick deadline enforcement** - Prevent picks after game start time
- [ ] **Pick editing** - Allow users to modify picks before deadline
- [ ] **Bulk pick submission** - Submit multiple picks at once (parlay-style)
- [ ] **Pick history** - Show user's past picks and results
- [ ] **Parlay creation and tracking** - Multi-game bet combinations

### 🏆 Season & Game Management
- [ ] **Multi-sport game templates** - Create sample games for different sports (NHL, NBA)
- [ ] **Season switching dropdown** - Will appear in header once multiple seasons exist
- [ ] **Admin game results** - Allow league creators to update game scores
- [ ] **Game status tracking** - scheduled → live → completed
- [ ] **Week progression** - Auto-advance weeks or manual control
- [ ] **Partition games into weeks** - Allow viewing historical picks from past weeks
- [ ] **Weekly pick persistence** - Keep completed week picks visible instead of overwriting

### 📊 Enhanced Leaderboard & Scoring
- [ ] **User scoring/points system** - Award points to users for correct picks with event-driven architecture and batched processing
- [ ] **Flexible scoring rules system** - Configurable scoring rules per league (base points, streak bonuses, difficulty multipliers, etc.)
- [ ] **Scoring database tables** - user_scores, scoring_events, weekly_leaderboards tables with audit trail
- [ ] **Automated scoring job** - Scheduled processing to award points after games complete (every 30min-2hrs during game days)
- [ ] **League standings/leaderboards** - Real-time standings calculation
- [ ] **Weekly scoring system** - Points calculation per week
- [ ] **Streak calculation** - Calculate real win/loss streaks from pick history
- [ ] **Season-level stats and leaderboards** - Individual seasons track their own stats, picks, and standings
- [ ] **Season completion rollup** - When season ends, roll season stats up to league-level historical data
- [ ] **Seasonal stats** - Track stats per season, not just overall
- [ ] **League historical leaderboards** - Aggregate stats from all completed seasons
- [ ] **Season vs. League stat views** - Toggle between current season and all-time league stats
- [ ] **Winnings tracking** - Add monetary tracking if desired
- [ ] **Advanced filters** - Filter by sport, time period, etc.

## Medium Priority

### 🔗 Data Integration
- [ ] **Game data integration (API)** - ESPN/other sports APIs
- [ ] **Automatic game updates** - API integration for live scores
- [ ] **Real-time game scores** - Live score updates
- [ ] **Odds integration** - Betting odds data
- [ ] **NFL team table** - Add team data table for logo fetching and team info
- [ ] **Team/player stats integration** - Pull relevant stats per game from ESPN API
- [ ] **News integration** - Add ESPN news endpoint with relevant game images
- [ ] **ESPN Hidden API integration** - Use comprehensive sports data

### 👥 User Management & Social
- [ ] **Join league functionality** - Join codes/invites/email invitations
- [ ] **User profiles and settings** - Expand user profiles with stats, bio
- [ ] **League member management** - Admin controls for managing members
- [ ] **League activity feed** - Show recent picks, results, etc.
- [ ] **League chat/comments** - Discussion features

### 🎨 UI/UX Improvements
- [ ] **Dashboard with league overview** - Enhanced dashboard view
- [ ] **Game schedule display** - Better game listing and scheduling
- [ ] **Results and history views** - Historical data viewing
- [ ] **Mobile responsive design** - Optimize for mobile devices
- [ ] **Dark/light theme** - Theme switching
- [ ] **Fully customizable color themes** - Allow users to create and customize their own color schemes and themes
- [ ] **Loading states** - Better loading animations
- [ ] **Error boundaries** - Better error handling and recovery
- [ ] **Accessibility** - ARIA labels, keyboard navigation
- [ ] **Fix dashboard refresh** - Prevent returning to league select on refresh
- [ ] **Navigation caching** - Fix hanging during navigation and improve caching
- [ ] **Dashboard back button** - Add navigation from dashboard to league select screen

## Technical Improvements

### 🏗️ Performance & Architecture
- [ ] **Implement SSR (Server-Side Rendering)**
  - Fix session/cookie handling issues in API routes
  - Convert pages to SSR for better SEO and performance
  - Implement middleware for authentication
  - Keep mutations client-side while making reads server-side
- [ ] **Database query optimization** - Optimize Supabase queries
- [ ] **Caching strategy** - Implement proper caching
- [ ] **Performance optimization** - Memoization, lazy loading
- [ ] **TypeScript improvements** - Better type safety throughout
- [ ] **Component refactoring** - Break down large components

### 🧪 Developer Experience
- [ ] **Testing** - Unit tests, integration tests
- [ ] **API documentation** - Code comments, API docs
- [ ] **CI/CD pipeline** - Automated testing and deployment
- [ ] **Environment configuration management** - Better env handling

### 🔔 Notifications & Communication
- [ ] **Pick reminders** - Email/notification when picks are due
- [ ] **Notifications (email/push)** - General notification system
- [ ] **League invites via email** - Send invite emails directly

## Advanced Features (Nice to Have)

### 🚀 Advanced Functionality
- [ ] **League templates** - Pre-configured league types (NFL only, Multi-sport, etc.)
- [ ] **Custom scoring rules** - Different point systems per league
- [ ] **Playoff brackets** - Tournament-style competitions
- [ ] **League analytics** - Advanced stats and insights
- [ ] **Public leagues** - Discoverable leagues anyone can join
- [ ] **Multiple sport support** - Full multi-sport integration
- [ ] **Advanced analytics and insights** - Deep data analysis

### 🔐 Admin & Security Features
- [ ] **League moderation** - Remove users, manage permissions
- [ ] **Season archiving** - Archive completed seasons
- [ ] **Data export** - Export league data (CSV, etc.)
- [ ] **Audit logs** - Track league changes and activity
- [ ] **Admin panel security** - Implement proper role-based access control
- [ ] **User whitelist system** - Control access for friend-only leagues
- [ ] **Role management** - Define and implement user roles throughout app

### 🌐 Social Features
- [ ] **Public league discovery** - Find and join public leagues
- [ ] **Social sharing** - Share results and achievements
- [ ] **Achievements/badges** - Gamification elements
- [ ] **Historical pick viewing** - View who picked what 2+ weeks in the past for data analysis

## Infrastructure & Production

### 🚀 Deployment & Monitoring
- [ ] **Production deployment (Vercel)** - Deploy to production
- [ ] **Monitoring and logging** - Application monitoring
- [ ] **Backup strategy** - Data backup and recovery
- [ ] **Security audit** - Security review and testing

## Quick Wins (Low effort, high impact)
1. Pick deadline enforcement
2. Mobile responsive fixes
3. Better error messages
4. Loading state improvements
5. Basic pick submission interface

## Current Architecture Notes
- **Database**: Supabase PostgreSQL with RLS policies
- **Auth**: Supabase Auth with Google OAuth
- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **State**: React Context API for league/user management
- **Deployment**: Ready for Vercel deployment

## Database Schema Summary
```
leagues (1) → (many) seasons (1) → (many) games
   ↓                ↓
league_memberships  picks
   ↓
users
```

Each league can have multiple seasons, each season can have multiple games, users can make picks on games. Perfect for multi-sport leagues!

---

## Completed ✅
- [x] Google OAuth authentication
- [x] User context and session management
- [x] Create league functionality
- [x] Basic league structure (database schema)
- [x] RLS policies setup
- [x] Client-side league creation (working around SSR issues)
- [x] Multi-league system implementation
- [x] League switching via header dropdown
- [x] Season management (CRUD operations)
- [x] Season creation functionality
- [x] Season creation UI with modal/form