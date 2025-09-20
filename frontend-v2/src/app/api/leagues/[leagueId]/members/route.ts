import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId } from '@/lib/validation';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ leagueId: string }> }
) {
    try {
        const { leagueId } = await params;

        // Validate league ID
        const validation = validateId(leagueId, 'League ID');
        if (!validation.isValid) {
            return NextResponse.json({ error: validation.errorMessage }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Check if user has access to this league (admin or member) using admin client
        const { data: league, error: leagueError } = await supabaseAdmin
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
            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .single();

            hasAccess = !membershipError && !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied. You must be a member of this league.' }, { status: 403 });
        }

        // Fetch league members using admin client
        const { data: membersData, error: membersError } = await supabaseAdmin
            .from('league_memberships')
            .select(`
                user_id,
                joined_at,
                profiles!inner(
                    username,
                    avatar_url
                )
            `)
            .eq('league_id', leagueId);

        if (membersError) {
            console.error('Members fetch error:', membersError);
            return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
        }

        return NextResponse.json({ members: membersData || [] });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}