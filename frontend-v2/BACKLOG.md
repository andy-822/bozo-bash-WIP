# Bozos Parlay Challenge - Backlog

## High Priority Features

### Core Functionality
- [ ] User picks/bets system
- [ ] Game data integration (API)
- [ ] Parlay creation and tracking
- [ ] League standings/leaderboards
- [ ] Weekly scoring system

### User Management
- [ ] Join league functionality (join codes/invites)
- [ ] User profiles and settings
- [ ] League member management (admin controls)

## Medium Priority

### UI/UX Improvements
- [ ] Dashboard with league overview
- [ ] Game schedule display
- [ ] Pick submission interface
- [ ] Results and history views
- [ ] Mobile responsive design optimization

### Data & Integration
- [ ] Real-time game scores
- [ ] Odds integration
- [ ] Historical data and stats
- [ ] Export league data

## Technical Improvements

### Performance & Architecture
- [ ] **Implement SSR (Server-Side Rendering)**
  - Fix session/cookie handling issues in API routes
  - Convert pages to SSR for better SEO and performance
  - Implement middleware for authentication
  - Keep mutations client-side while making reads server-side
- [ ] Database query optimization
- [ ] Caching strategy
- [ ] Error handling and retry logic

### Developer Experience
- [ ] API documentation
- [ ] Testing setup (unit/integration)
- [ ] CI/CD pipeline
- [ ] Environment configuration management

## Nice to Have

### Advanced Features
- [ ] Notifications (email/push)
- [ ] Chat/messaging in leagues
- [ ] Custom scoring rules
- [ ] Multiple sport support
- [ ] Advanced analytics and insights

### Social Features
- [ ] Public league discovery
- [ ] Social sharing
- [ ] Achievements/badges
- [ ] League templates

## Infrastructure
- [ ] Production deployment (Vercel)
- [ ] Monitoring and logging
- [ ] Backup strategy
- [ ] Security audit

---

## Completed ✅
- [x] Google OAuth authentication
- [x] User context and session management
- [x] Create league functionality
- [x] Basic league structure (database schema)
- [x] RLS policies setup
- [x] Client-side league creation (working around SSR issues)