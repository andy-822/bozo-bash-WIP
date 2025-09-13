// Odds API Service - Free Tier Optimized
// Manages API calls to stay within 500 requests/month limit

import { supabase } from './supabase';

interface OddsAPIResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string; // 'h2h', 'spreads', 'totals'
      last_update: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

interface RequestUsage {
  requests_used: number;
  requests_remaining: number;
}

class OddsAPIService {
  private apiKey: string;
  private baseUrl = 'https://api.the-odds-api.com/v4';
  private useMockData: boolean;
  
  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || '';
    this.useMockData = process.env.USE_MOCK_ODDS === 'true';
    console.log('Environment check:', {
      USE_MOCK_ODDS: process.env.USE_MOCK_ODDS,
      useMockData: this.useMockData,
      hasApiKey: !!this.apiKey
    });
    if (!this.apiKey && !this.useMockData) {
      console.warn('ODDS_API_KEY not found in environment variables');
    }
  }

  // Track API usage in database
  private async logRequest(
    endpoint: string, 
    sport: string, 
    markets: string[], 
    usage: RequestUsage, 
    success: boolean = true, 
    error?: string
  ) {
    try {
      await supabase.from('odds_api_requests').insert({
        endpoint,
        sport,
        markets: markets.join(','),
        requests_used: usage.requests_used,
        requests_remaining: usage.requests_remaining,
        success,
        error_message: error
      });
    } catch (err) {
      console.error('Failed to log API request:', err);
    }
  }

  // Get current month's usage from database
  async getCurrentMonthUsage(): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('odds_api_requests')
      .select('requests_used')
      .gte('created_at', startOfMonth.toISOString());

    if (error) {
      console.error('Error fetching usage:', error);
      return 0;
    }

    return data?.reduce((total, req) => total + req.requests_used, 0) || 0;
  }

  // Check if we should make a request based on usage limits
  async shouldMakeRequest(): Promise<boolean> {
    const currentUsage = await this.getCurrentMonthUsage();
    const remainingRequests = 500 - currentUsage;
    
    // Conservative approach: keep 100 requests as buffer
    return remainingRequests > 100;
  }

  // Fetch odds for NFL games
  async fetchNFLOdds(markets: string[] = ['h2h', 'spreads', 'totals']): Promise<OddsAPIResponse[]> {
    if (this.useMockData) {
      console.log('Using mock odds data');
      const mockData = [
        {
          "id": "mock123",
          "sport_key": "americanfootball_nfl",
          "sport_title": "NFL",
          "commence_time": "2025-09-15T20:20:00Z",
          "home_team": "Kansas City Chiefs",
          "away_team": "Buffalo Bills",
          "bookmakers": [
            {
              "key": "draftkings",
              "title": "DraftKings",
              "last_update": "2024-12-13T17:00:00Z",
              "markets": [
                {
                  "key": "h2h",
                  "last_update": "2024-12-13T17:00:00Z",
                  "outcomes": [
                    {"name": "Kansas City Chiefs", "price": -150},
                    {"name": "Buffalo Bills", "price": 130}
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "mock456",
          "sport_key": "americanfootball_nfl", 
          "sport_title": "NFL",
          "commence_time": "2025-09-15T17:00:00Z",
          "home_team": "Dallas Cowboys",
          "away_team": "Philadelphia Eagles",
          "bookmakers": [
            {
              "key": "fanduel",
              "title": "FanDuel", 
              "last_update": "2024-12-13T17:00:00Z",
              "markets": [
                {
                  "key": "h2h",
                  "last_update": "2024-12-13T17:00:00Z",
                  "outcomes": [
                    {"name": "Dallas Cowboys", "price": 110},
                    {"name": "Philadelphia Eagles", "price": -130}
                  ]
                }
              ]
            }
          ]
        }
      ];
      
      // Log mock request (with 0 API usage)
      await this.logRequest('mock-endpoint', 'americanfootball_nfl', markets, { requests_used: 0, requests_remaining: 500 }, true);
      
      return mockData as OddsAPIResponse[];
    }

    if (!this.apiKey) {
      throw new Error('Odds API key not configured');
    }

    const canMakeRequest = await this.shouldMakeRequest();
    if (!canMakeRequest) {
      throw new Error('Monthly API limit approaching. Skipping request.');
    }

    // Set date range for current 2025 NFL season (September 2025 - February 2026)
    const seasonStart = '2025-09-01T00:00:00Z';
    const seasonEnd = '2026-02-28T23:59:59Z';
    
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: 'us', // US sportsbooks only
      markets: markets.join(','),
      oddsFormat: 'american',
      dateFormat: 'iso',
      commenceTimeFrom: seasonStart,
      commenceTimeTo: seasonEnd
    });

    const endpoint = `${this.baseUrl}/sports/americanfootball_nfl/odds`;
    const url = `${endpoint}?${params}`;

    try {
      const response = await fetch(url);
      
      // Extract usage from headers
      const usage: RequestUsage = {
        requests_used: parseInt(response.headers.get('x-requests-used') || '1'),
        requests_remaining: parseInt(response.headers.get('x-requests-remaining') || '499')
      };

      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        await this.logRequest(endpoint, 'americanfootball_nfl', markets, usage, false, error);
        throw new Error(error);
      }

      const data: OddsAPIResponse[] = await response.json();
      
      // Log successful request
      await this.logRequest(endpoint, 'americanfootball_nfl', markets, usage, true);
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logRequest(endpoint, 'americanfootball_nfl', markets, { requests_used: 1, requests_remaining: 499 }, false, errorMessage);
      throw error;
    }
  }

  // Store odds data in our database
  async storeOddsData(oddsData: OddsAPIResponse[]): Promise<void> {
    console.log('Processing odds for games:', oddsData.map(g => `${g.away_team} @ ${g.home_team}`));
    
    // Get all games in database for comparison
    const { data: allGames, error: gamesQueryError } = await supabase
      .from('games')
      .select('id, home_team, away_team, season_id');
    
    console.log('Database query result:', { allGames, error: gamesQueryError });
    
    console.log('Database games:', allGames?.map(g => `${g.away_team} @ ${g.home_team}`));
    
    for (const game of oddsData) {
      // Find matching game in our database by team names and date
      const { data: dbGame, error: gameError } = await supabase
        .from('games')
        .select('id')
        .eq('home_team', game.home_team)
        .eq('away_team', game.away_team)
        .single();

      let gameId: string;
      
      if (gameError || !dbGame) {
        console.log(`No matching game found for ${game.away_team} @ ${game.home_team}, creating new game...`);
        
        // Get the active season (you might want to make this more robust)
        const { data: activeSeason } = await supabase
          .from('seasons')
          .select('id')
          .eq('is_active', true)
          .single();
          
        if (!activeSeason) {
          console.error('No active season found, skipping game creation');
          continue;
        }
        
        // Create the missing game
        const { data: newGame, error: createError } = await supabase
          .from('games')
          .insert({
            season_id: activeSeason.id,
            home_team: game.home_team,
            away_team: game.away_team,
            game_time: game.commence_time,
            week: Math.ceil((new Date(game.commence_time).getTime() - new Date('2025-09-01').getTime()) / (7 * 24 * 60 * 60 * 1000)) // Rough week calculation
          })
          .select('id')
          .single();
          
        if (createError || !newGame) {
          console.error(`Failed to create game ${game.away_team} @ ${game.home_team}:`, createError);
          continue;
        }
        
        gameId = newGame.id;
        console.log(`Created new game: ${game.away_team} @ ${game.home_team} with ID ${gameId}`);
      } else {
        gameId = dbGame.id;
      }

      // Process each bookmaker's odds
      console.log(`Processing ${game.bookmakers.length} bookmakers for game: ${game.away_team} @ ${game.home_team}`);
      
      for (const bookmaker of game.bookmakers) {
        console.log(`Processing bookmaker: ${bookmaker.key}`);
        
        // Get or create sportsbook
        const { data: sportsbook, error: sportsbookError } = await supabase
          .from('sportsbooks')
          .select('id')
          .eq('key', bookmaker.key)
          .single();

        console.log(`Sportsbook query result:`, { sportsbook, error: sportsbookError });

        if (!sportsbook) {
          console.warn(`Unknown sportsbook: ${bookmaker.key}`);
          continue;
        }

        // Store each market type
        console.log(`Processing ${bookmaker.markets.length} markets for ${bookmaker.key}`);
        
        for (const market of bookmaker.markets) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 6); // Odds expire after 6 hours

          console.log(`Storing odds for market: ${market.key}`);
          
          const { data: oddsResult, error: oddsError } = await supabase
            .from('odds')
            .upsert({
              game_id: gameId,
              sportsbook_id: sportsbook.id,
              market_type: market.key,
              market_key: market.key,
              outcomes: market.outcomes,
              expires_at: expiresAt.toISOString()
            }, {
              onConflict: 'game_id,sportsbook_id,market_type,market_key'
            });
            
          console.log(`Odds storage result:`, { data: oddsResult, error: oddsError });
        }
      }
    }
  }

  // Get stored odds for a game
  async getGameOdds(gameId: string, marketTypes: string[] = ['h2h', 'spreads', 'totals']) {
    const { data, error } = await supabase
      .from('odds')
      .select(`
        *,
        sportsbooks (key, title)
      `)
      .eq('game_id', gameId)
      .in('market_type', marketTypes)
      .gt('expires_at', new Date().toISOString()) // Only non-expired odds
      .order('fetched_at', { ascending: false });

    if (error) {
      console.error('Error fetching odds:', error);
      return [];
    }

    return data;
  }

  // Full sync: fetch and store NFL odds
  async syncNFLOdds(): Promise<{ success: boolean; gamesProcessed: number; error?: string }> {
    try {
      console.log('Starting NFL odds sync...');
      
      const oddsData = await this.fetchNFLOdds(['h2h', 'spreads', 'totals']);
      await this.storeOddsData(oddsData);
      
      console.log(`Successfully synced odds for ${oddsData.length} NFL games`);
      
      return {
        success: true,
        gamesProcessed: oddsData.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('NFL odds sync failed:', errorMessage);
      
      return {
        success: false,
        gamesProcessed: 0,
        error: errorMessage
      };
    }
  }
}

export const oddsAPI = new OddsAPIService();
export type { OddsAPIResponse, RequestUsage };