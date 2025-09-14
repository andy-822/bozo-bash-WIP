# Bozos Parlay Challenge - Development Backlog

## Current Status
✅ **COMPLETED**: Multi-league system successfully implemented
- Users can create/join multiple leagues
- League switching via header dropdown
- Real Supabase integration with authentication
- Dashboard, submit, and leaderboard components using real data
- Fixed login flow to show league selection instead of auto-selecting

## Immediate Next Tasks

### 🏆 Season Management
- [ ] **Add "Create Season" functionality** - Allow league creators to add new seasons (NFL, NHL, NBA, etc.)
- [ ] **Season creation UI** - Add modal/form in LeagueManagement component
- [ ] **Multi-sport game templates** - Create sample games for different sports (NHL, NBA)
- [ ] **Season switching dropdown** - Will appear in header once multiple seasons exist

### 🎮 Pick Management Improvements
- [ ] **Pick deadline enforcement** - Prevent picks after game start time
- [ ] **Pick editing** - Allow users to modify picks before deadline
- [ ] **Bulk pick submission** - Submit multiple picks at once (parlay-style)
- [ ] **Pick history** - Show user's past picks and results
- [ ] **Partition games into weeks** - Allow viewing historical picks from past weeks
- [ ] **Historical pick viewing** - View who picked what 2+ weeks in the past for data analysis
- [ ] **Weekly pick persistence** - Keep completed week picks visible instead of overwriting

### 📊 Enhanced Leaderboard
- [ ] **Streak calculation** - Calculate real win/loss streaks from pick history
- [ ] **Seasonal stats** - Track stats per season, not just overall
- [ ] **Winnings tracking** - Add monetary tracking if desired
- [ ] **Advanced filters** - Filter by sport, time period, etc.

### 🎯 Game Management
- [ ] **Admin game results** - Allow league creators to update game scores
- [ ] **Automatic game updates** - API integration for live scores (ESPN/etc)
- [ ] **Game status tracking** - scheduled → live → completed
- [ ] **Week progression** - Auto-advance weeks or manual control
- [ ] **Season creation interface** - Need a way to create new seasons
- [ ] **NFL team table** - Add team data table for logo fetching and team info
- [ ] **Team/player stats integration** - Pull relevant stats per game from ESPN API
- [ ] **News integration** - Add ESPN news endpoint with relevant game images
- [ ] **ESPN Hidden API integration** - Use https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b for comprehensive sports data

### 🔔 Notifications & Social
- [ ] **Pick reminders** - Email/notification when picks are due
- [ ] **League activity feed** - Show recent picks, results, etc.
- [ ] **User profiles** - Expand user profiles with stats, bio
- [ ] **League chat/comments** - Discussion features

### 🎨 UI/UX Improvements
- [ ] **Mobile responsiveness** - Optimize for mobile devices
- [ ] **Dark/light theme** - Theme switching
- [ ] **Loading states** - Better loading animations
- [ ] **Error boundaries** - Better error handling and recovery
- [ ] **Accessibility** - ARIA labels, keyboard navigation
- [ ] **Fix dashboard refresh** - Prevent returning to league select on refresh
- [ ] **Navigation caching** - Fix hanging during navigation and improve caching
- [ ] **Dashboard back button** - Add navigation from dashboard to league select screen

### 🏗️ Technical Debt
- [ ] **TypeScript improvements** - Better type safety throughout
- [ ] **Component refactoring** - Break down large components
- [ ] **Performance optimization** - Memoization, lazy loading
- [ ] **Testing** - Unit tests, integration tests
- [ ] **Documentation** - Code comments, API docs

### 🚀 Advanced Features
- [ ] **League templates** - Pre-configured league types (NFL only, Multi-sport, etc.)
- [ ] **Custom scoring** - Different point systems per league
- [ ] **Playoff brackets** - Tournament-style competitions
- [ ] **League analytics** - Advanced stats and insights
- [ ] **Public leagues** - Discoverable leagues anyone can join
- [ ] **League invites via email** - Send invite emails directly

### 🔐 Admin Features
- [ ] **League moderation** - Remove users, manage permissions
- [ ] **Season archiving** - Archive completed seasons
- [ ] **Data export** - Export league data (CSV, etc.)
- [ ] **Audit logs** - Track league changes and activity
- [ ] **Admin panel security** - Implement proper role-based access control
- [ ] **User whitelist system** - Control access for friend-only leagues
- [ ] **Role management** - Define and implement user roles throughout app

## Current Architecture Notes
- **Database**: Supabase PostgreSQL with RLS policies
- **Auth**: Supabase Auth with Google OAuth
- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **State**: React Context API for league/user management
- **Deployment**: Ready for Vercel deployment

## Quick Wins (Low effort, high impact)
1. Add season creation (current priority)
2. Mobile responsive fixes
3. Pick deadline enforcement  
4. Better error messages
5. Loading state improvements

## Database Schema Summary
```
leagues (1) → (many) seasons (1) → (many) games
   ↓                ↓
league_memberships  picks
   ↓
users
```

Each league can have multiple seasons, each season can have multiple games, users can make picks on games. Perfect for multi-sport leagues!