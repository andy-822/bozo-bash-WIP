import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ seasonId: string }> }
) {
    try {
        const supabase = await createServerSupabaseClient();
        const { seasonId } = await params;

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Fetch season with league info using admin client
        const { data: season, error: seasonError } = await supabaseAdmin
            .from('seasons')
            .select(`
                *,
                leagues!inner(
                    id,
                    name,
                    admin_id
                )
            `)
            .eq('id', seasonId)
            .single();

        if (seasonError || !season) {
            return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Check if user has access to this league
        let hasAccess = season.leagues.admin_id === user.id;

        // If not admin, check if user is a member
        if (!hasAccess) {
            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', season.leagues.id)
                .eq('user_id', user.id)
                .single();

            hasAccess = !membershipError && !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        return NextResponse.json({ season });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ seasonId: string }> }
) {
    try {
        const { name, start_date, end_date } = await request.json();
        const supabase = await createServerSupabaseClient();
        const { seasonId } = await params;

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Season name is required' }, { status: 400 });
        }

        // Verify user is admin of the league this season belongs to
        const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select(`
                id,
                leagues!inner(admin_id)
            `)
            .eq('id', seasonId)
            .single();

        if (seasonError || !season) {
            return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        const league = Array.isArray(season.leagues) ? season.leagues[0] : season.leagues;
        if (league.admin_id !== user.id) {
            return NextResponse.json({ error: 'Only league admin can update seasons' }, { status: 403 });
        }

        // Update the season
        const { data: updatedSeason, error: updateError } = await supabase
            .from('seasons')
            .update({
                name: name.trim(),
                start_date: start_date || null,
                end_date: end_date || null
            })
            .eq('id', seasonId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json(
                { error: 'Failed to update season' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, season: updatedSeason });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ seasonId: string }> }
) {
    try {
        const supabase = await createServerSupabaseClient();
        const { seasonId } = await params;

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Verify user is admin of the league this season belongs to
        const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select(`
                id,
                leagues!inner(admin_id)
            `)
            .eq('id', seasonId)
            .single();

        if (seasonError || !season) {
            return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        const league = Array.isArray(season.leagues) ? season.leagues[0] : season.leagues;
        if (league.admin_id !== user.id) {
            return NextResponse.json({ error: 'Only league admin can delete seasons' }, { status: 403 });
        }

        // Check if season has any games
        const { data: games, error: gamesError } = await supabase
            .from('games')
            .select('id')
            .eq('season_id', seasonId)
            .limit(1);

        if (gamesError) {
            return NextResponse.json({ error: 'Failed to check season dependencies' }, { status: 500 });
        }

        if (games && games.length > 0) {
            return NextResponse.json({
                error: 'Cannot delete season with existing games'
            }, { status: 400 });
        }

        // Delete the season
        const { error: deleteError } = await supabase
            .from('seasons')
            .delete()
            .eq('id', seasonId);

        if (deleteError) {
            return NextResponse.json(
                { error: 'Failed to delete season' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}