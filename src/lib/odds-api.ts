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
  
  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ODDS_API_KEY not found in environment variables');
    }
  }

  // Track API usage in console (database table not created yet)
  private async logRequest(
    endpoint: string, 
    sport: string, 
    markets: string[], 
    usage: RequestUsage, 
    success: boolean = true, 
    error?: string
  ) {
    console.log('API Request:', {
      endpoint,
      sport,
      markets: markets.join(','),
      requests_used: usage.requests_used,
      requests_remaining: usage.requests_remaining,
      success,
      error_message: error,
      timestamp: new Date().toISOString()
    });
  }

  // Get current month's usage (simplified for now)
  async getCurrentMonthUsage(): Promise<number> {
    // For now, return 0 since we don't have usage tracking table
    // In production, you'd want to create the odds_api_requests table
    console.log('Usage tracking not implemented yet');
    return 0;
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
    if (!this.apiKey) {
      throw new Error('Odds API key not configured');
    }

    const canMakeRequest = await this.shouldMakeRequest();
    if (!canMakeRequest) {
      throw new Error('Monthly API limit approaching. Skipping request.');
    }

    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: 'us', // US sportsbooks only
      markets: markets.join(','),
      oddsFormat: 'american',
      dateFormat: 'iso'
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

  // Store odds data (simplified for now - logs to console)
  async storeOddsData(oddsData: OddsAPIResponse[]): Promise<void> {
    console.log('Odds data received:', {
      gamesCount: oddsData.length,
      games: oddsData.map(game => ({
        id: game.id,
        teams: `${game.away_team} @ ${game.home_team}`,
        commence_time: game.commence_time,
        bookmakers: game.bookmakers.length
      }))
    });
    
    // TODO: Implement odds storage when database schema is complete
    console.log('Odds storage not implemented yet - would store to sportsbooks/odds tables');
  }

  // Get stored odds for a game (simplified for now)
  async getGameOdds(gameId: string, marketTypes: string[] = ['h2h', 'spreads', 'totals']) {
    console.log('Fetching odds for game:', gameId, 'markets:', marketTypes);
    // TODO: Implement when odds table exists
    return [];
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