// Test endpoint to debug odds API issues
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('=== ODDS API TEST ===');

    // Check environment variables
    const apiKey = process.env.ODDS_API_KEY;
    const useMock = process.env.USE_MOCK_ODDS;

    console.log('Environment check:', {
      ODDS_API_KEY: apiKey ? 'Present' : 'Missing',
      USE_MOCK_ODDS: useMock,
      NODE_ENV: process.env.NODE_ENV
    });

    // Test basic API connectivity
    if (apiKey && !useMock) {
      try {
        console.log('Testing Odds API connectivity...');
        const testUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&dateFormat=iso&commenceTimeFrom=2025-09-01T00:00:00Z&commenceTimeTo=2026-02-28T23:59:59Z`;

        const response = await fetch(testUrl);
        const usage = {
          requests_used: parseInt(response.headers.get('x-requests-used') || '1'),
          requests_remaining: parseInt(response.headers.get('x-requests-remaining') || '499')
        };

        console.log('API Response Status:', response.status);
        console.log('API Usage:', usage);

        if (response.ok) {
          const data = await response.json();
          console.log(`API returned ${data.length} games`);

          return NextResponse.json({
            success: true,
            message: 'Odds API is working',
            apiKey: 'Present',
            gamesFound: data.length,
            usage
          });
        } else {
          const errorText = await response.text();
          console.error('API Error:', errorText);

          return NextResponse.json({
            success: false,
            error: `API Error: ${response.status} - ${errorText}`,
            apiKey: 'Present'
          });
        }
      } catch (apiError) {
        console.error('API Connection Error:', apiError);
        return NextResponse.json({
          success: false,
          error: `API Connection failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
          apiKey: 'Present'
        });
      }
    } else {
      console.log('Using mock mode or no API key');
      return NextResponse.json({
        success: true,
        message: 'Mock mode enabled or no API key',
        apiKey: apiKey ? 'Present' : 'Missing',
        useMock: useMock === 'true'
      });
    }

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}