import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId, validateRequestBody } from '@/lib/validation';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { searchParams } = new URL(request.url);
        const week = searchParams.get('week');
        const seasonId = searchParams.get('season_id');
        const userOnly = searchParams.get('user_only') === 'true';

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Build base query
        let query = supabaseAdmin
            .from('picks')
            .select(`
                id,
                game_id,
                bet_type,
                selection,
                result,
                points_awarded,
                week,
                created_at,
                games!inner(
                    id,
                    season_id,
                    start_time,
                    home_team:teams!games_home_team_id_fkey(name, abbreviation),
                    away_team:teams!games_away_team_id_fkey(name, abbreviation)
                )
            `);

        // Filter by user if userOnly is true, otherwise show all picks
        if (userOnly) {
            query = query.eq('user_id', user.id);
        }

        // Filter by season if provided
        if (seasonId) {
            query = query.eq('games.season_id', seasonId);
        }

        // Filter by week if provided
        if (week) {
            query = query.eq('week', parseInt(week));
        }

        // Order by creation date
        query = query.order('created_at', { ascending: false });

        const { data: picks, error: picksError } = await query;

        if (picksError) {
            console.error('Picks query error:', picksError);
            return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
        }

        return NextResponse.json({
            picks: picks || [],
            week: week ? parseInt(week) : null
        });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { game_id, bet_type, selection } = await request.json();
        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Validate game_id to prevent SQL injection
        const gameIdValidation = validateId(game_id, 'Game ID');
        if (!gameIdValidation.isValid) {
            return NextResponse.json({ error: gameIdValidation.errorMessage }, { status: 400 });
        }

        // Validate bet_type and selection
        const bodyValidation = validateRequestBody(
            { bet_type, selection },
            { bet_type: 'string', selection: 'string' }
        );
        if (!bodyValidation.isValid) {
            return NextResponse.json({ error: bodyValidation.errorMessage }, { status: 400 });
        }

        if (!['moneyline', 'spread', 'total'].includes(bet_type)) {
            return NextResponse.json({ error: 'Invalid bet type' }, { status: 400 });
        }

        // Check if game exists and hasn't started
        const { data: game, error: gameError } = await supabaseAdmin
            .from('games')
            .select('id, start_time')
            .eq('id', game_id)
            .single();

        if (gameError || !game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

        // Check if game has started (deadline enforcement)
        const gameTime = new Date(game.start_time);
        const now = new Date();

        if (now >= gameTime) {
            return NextResponse.json({
                error: 'Game has already started. Picks are no longer allowed.'
            }, { status: 400 });
        }

        // Get the season and week for this game
        const { data: gameWithSeason, error: seasonError } = await supabaseAdmin
            .from('games')
            .select(`
                id,
                start_time,
                season_id,
                seasons(id, start_date)
            `)
            .eq('id', game_id)
            .single();

        if (seasonError || !gameWithSeason) {
            return NextResponse.json({ error: 'Game season not found' }, { status: 404 });
        }

        // Calculate week number based on game start time and season start
        const seasonStart = new Date(gameWithSeason.seasons.start_date);
        const gameStart = new Date(gameWithSeason.start_time);
        const weekNumber = Math.ceil((gameStart.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Check for existing pick this week in this season
        const { data: existingPick, error: existingError } = await supabaseAdmin
            .from('picks')
            .select('id, game_id')
            .eq('user_id', user.id)
            .eq('week', weekNumber)
            .eq('games.season_id', gameWithSeason.season_id)
            .single();

        if (existingError && existingError.code !== 'PGRST116') {
            console.error('Error checking existing pick:', existingError);
            return NextResponse.json({ error: 'Error checking existing picks' }, { status: 500 });
        }

        // If user already has a pick this week, return error instead of deleting
        if (existingPick) {
            return NextResponse.json({
                error: `You already have a pick for Week ${weekNumber}. You can only make one pick per week.`,
                existing_pick: existingPick
            }, { status: 400 });
        }

        // Create the new pick
        const { data: newPick, error: createError } = await supabaseAdmin
            .from('picks')
            .insert({
                user_id: user.id,
                game_id,
                bet_type,
                selection,
                week: weekNumber,
                result: null // Will be updated when game completes
            })
            .select()
            .single();

        if (createError) {
            return NextResponse.json({
                error: 'Failed to create pick',
                details: createError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            pick: newPick,
            message: 'Pick submitted successfully'
        });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}