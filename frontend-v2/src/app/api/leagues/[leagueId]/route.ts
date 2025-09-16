import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ leagueId: string }> }
) {
    try {
        const { leagueId } = await params;
        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Fetch league with additional info for the invite page
        const { data: leagueData, error: leagueError } = await supabaseAdmin
            .from('leagues')
            .select(`
                id,
                name,
                created_at,
                admin_id,
                sport_id,
                sports(name)
            `)
            .eq('id', leagueId)
            .single();

        if (leagueError || !leagueData) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Get member count
        const { count: memberCount } = await supabaseAdmin
            .from('league_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', leagueId);

        // Transform the data
        const league = {
            id: leagueData.id,
            name: leagueData.name,
            created_at: leagueData.created_at,
            admin_id: leagueData.admin_id,
            sport_id: leagueData.sport_id,
            sport_name: Array.isArray(leagueData.sports)
                ? leagueData.sports[0]?.name
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                : (leagueData.sports as any)?.name || 'Unknown',
            member_count: memberCount || 0
        };

        return NextResponse.json({ league });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}