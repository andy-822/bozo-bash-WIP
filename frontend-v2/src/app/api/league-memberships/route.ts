import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
    try {
        const { league_id } = await request.json();
        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!league_id) {
            return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
        }

        // Check if league exists
        const { data: league, error: leagueError } = await supabaseAdmin
            .from('leagues')
            .select('id, name')
            .eq('id', league_id)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Check if user is already a member
        const { data: existingMembership } = await supabaseAdmin
            .from('league_memberships')
            .select('user_id')
            .eq('league_id', league_id)
            .eq('user_id', user.id)
            .single();

        if (existingMembership) {
            return NextResponse.json({ error: 'You are already a member of this league' }, { status: 400 });
        }

        // Add user to league
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('league_memberships')
            .insert({
                league_id,
                user_id: user.id
            })
            .select()
            .single();

        if (membershipError) {
            return NextResponse.json({
                error: 'Failed to join league',
                details: membershipError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            membership,
            message: `Successfully joined ${league.name}`
        });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}