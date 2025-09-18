import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId, validateRequestBody } from '@/lib/validation';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { searchParams } = new URL(request.url);
        const week = searchParams.get('week');

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Build query
        let query = supabaseAdmin
            .from('picks')
            .select(`
                id,
                game_id,
                bet_type,
                selection,
                result,
                created_at,
                games!inner(
                    id,
                    start_time,
                    home_team:teams!games_home_team_id_fkey(name, abbreviation),
                    away_team:teams!games_away_team_id_fkey(name, abbreviation)
                )
            `)
            .eq('user_id', user.id);

        // Filter by week if provided
        if (week) {
            // For week filtering, we need to find picks made during that week
            // This is a simplified approach - in production you might want more precise week tracking
            query = query.order('created_at', { ascending: false });
        }

        const { data: picks, error: picksError } = await query;

        if (picksError) {
            return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
        }

        // If week is specified, filter picks to that week
        let filteredPicks = picks || [];
        if (week) {
            // Simple filtering - in production you'd want better week tracking
            filteredPicks = picks?.filter(() => {
                // This is a simplified check - you might want to store week number on picks
                return true; // For now, return all picks
            }) || [];
        }

        return NextResponse.json({ picks: filteredPicks });

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

        // Check for existing pick this week - delete if exists (overwrite behavior)

        // For simplicity, we'll find any recent pick by this user and delete it
        // In production, you might want to store the week number on picks for better tracking
        const { data: existingPicks } = await supabaseAdmin
            .from('picks')
            .select('id')
            .eq('user_id', user.id)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
            .order('created_at', { ascending: false });

        // Delete existing picks from this week
        if (existingPicks && existingPicks.length > 0) {
            const { error: deleteError } = await supabaseAdmin
                .from('picks')
                .delete()
                .eq('user_id', user.id)
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

            if (deleteError) {
                console.error('Error deleting existing picks:', deleteError);
                // Continue anyway - we'll still create the new pick
            }
        }

        // Create the new pick
        const { data: newPick, error: createError } = await supabaseAdmin
            .from('picks')
            .insert({
                user_id: user.id,
                game_id,
                bet_type,
                selection,
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