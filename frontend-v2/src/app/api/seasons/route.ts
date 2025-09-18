import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId, validateRequestBody } from '@/lib/validation';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('league_id');

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Validate league ID to prevent SQL injection
        const leagueValidation = validateId(leagueId, 'League ID');
        if (!leagueValidation.isValid) {
            return NextResponse.json({ error: leagueValidation.errorMessage }, { status: 400 });
        }

        // Verify user has access to this league (either admin or member)
        const { data: league, error: leagueError } = await supabase
            .from('leagues')
            .select('id, admin_id')
            .eq('id', leagueId)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Check if user is admin
        let hasAccess = league.admin_id === user.id;

        // If not admin, check if user is a member
        if (!hasAccess) {
            const { data: membership, error: membershipError } = await supabase
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .single();

            hasAccess = !membershipError && !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch seasons for this league using admin client
        const { data: seasons, error: seasonsError } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('league_id', leagueId)
            .order('start_date', { ascending: false });

        if (seasonsError) {
            return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
        }

        return NextResponse.json({ seasons });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name, league_id, start_date, end_date } = await request.json();

        // Validate request body to prevent SQL injection
        const bodyValidation = validateRequestBody(
            { name, league_id },
            { name: 'string', league_id: 'id' }
        );
        if (!bodyValidation.isValid) {
            return NextResponse.json({ error: bodyValidation.errorMessage }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Verify user is admin of this league
        const { data: league, error: leagueError } = await supabase
            .from('leagues')
            .select('admin_id')
            .eq('id', league_id)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        if (league.admin_id !== user.id) {
            return NextResponse.json({ error: 'Only league admin can create seasons' }, { status: 403 });
        }

        // Create the season using admin client to bypass RLS
        const { data: season, error: createError } = await supabaseAdmin
            .from('seasons')
            .insert({
                name: name.trim(),
                league_id,
                start_date: start_date || null,
                end_date: end_date || null
            })
            .select()
            .single();

        if (createError) {
            return NextResponse.json(
                { error: 'Failed to create season' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, season });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}