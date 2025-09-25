import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = parseInt(params.gameId);

    if (isNaN(gameId)) {
      return NextResponse.json({
        error: 'Invalid game ID'
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // Fetch player props for the specific game
    const { data: props, error } = await supabase
      .from('player_props')
      .select(`
        id,
        athlete_id,
        athlete_name,
        team_id,
        sportsbook,
        market_key,
        description,
        over_price,
        under_price,
        point,
        last_update,
        teams:team_id (
          name,
          abbreviation
        )
      `)
      .eq('game_id', gameId)
      .order('athlete_name')
      .order('market_key');

    if (error) {
      console.error('Error fetching player props:', error);
      return NextResponse.json({
        error: 'Failed to fetch player props'
      }, { status: 500 });
    }

    // Group props by player and market for better organization
    const groupedProps = props?.reduce((acc, prop) => {
      const key = `${prop.athlete_id}-${prop.market_key}`;
      if (!acc[key]) {
        acc[key] = {
          ...prop,
          sportsbooks: []
        };
      }
      acc[key].sportsbooks.push({
        sportsbook: prop.sportsbook,
        over_price: prop.over_price,
        under_price: prop.under_price,
        last_update: prop.last_update
      });
      return acc;
    }, {} as any);

    return NextResponse.json({
      success: true,
      props: props || [],
      groupedProps: groupedProps ? Object.values(groupedProps) : [],
      total: props?.length || 0
    });

  } catch (error) {
    console.error('Player props API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}