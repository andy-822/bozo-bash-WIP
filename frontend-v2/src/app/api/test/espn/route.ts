import { NextRequest, NextResponse } from 'next/server';
import {
  fetchESPNScoreboard,
  processESPNGames,
  getCompletedGames,
  getLiveGames,
} from '@/lib/espn-monitor';
import { getCurrentNFLWeek } from '@/lib/nfl-week';

/**
 * Test endpoint to manually check ESPN API integration
 * GET /api/test/espn
 * GET /api/test/espn?week=3
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get('week');
  const week = weekParam ? parseInt(weekParam) : getCurrentNFLWeek();

  console.log(`Testing ESPN integration for week ${week}`);

  try {
    // 1. Fetch ESPN data
    const startTime = Date.now();
    const espnData = await fetchESPNScoreboard(week);
    const fetchTime = Date.now() - startTime;

    // 2. Process the data
    const processedGames = processESPNGames(espnData);
    const completedGames = getCompletedGames(processedGames);
    const liveGames = getLiveGames(processedGames);

    // 3. Format response
    const response = {
      success: true,
      week: week,
      currentWeek: getCurrentNFLWeek(),
      timing: {
        espnFetchTime: `${fetchTime}ms`,
      },
      espnResponse: {
        season: espnData.season,
        week: espnData.week,
        totalEvents: espnData.events?.length || 0,
      },
      processedData: {
        totalGames: processedGames.length,
        completedGames: completedGames.length,
        liveGames: liveGames.length,
        scheduledGames: processedGames.length - completedGames.length - liveGames.length,
      },
      games: processedGames.map(game => ({
        espnId: game.espnGameId,
        teams: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
        score: game.status.completed
          ? `${game.awayTeam.score}-${game.homeTeam.score}`
          : 'In Progress/Scheduled',
        status: {
          name: game.status.name,
          state: game.status.state,
          completed: game.status.completed,
        },
        startTime: game.startTime,
      })),
      completedGamesDetail: completedGames.map(game => ({
        espnId: game.espnGameId,
        matchup: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
        finalScore: `${game.awayTeam.score}-${game.homeTeam.score}`,
        winner: game.homeTeam.score! > game.awayTeam.score! ? game.homeTeam.abbreviation : game.awayTeam.abbreviation,
      })),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('ESPN test failed:', error);

    return NextResponse.json({
      success: false,
      week,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to fetch or process ESPN data',
    }, { status: 500 });
  }
}