import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateRequestBody } from '@/lib/validation';

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Fetch leagues where user is admin
        const { data: adminLeagues, error: adminError } = await supabaseAdmin
            .from('leagues')
            .select(`
                id,
                name,
                created_at,
                admin_id,
                sport_id,
                sports(name)
            `)
            .eq('admin_id', user.id);

        // Get memberships first
        const { data: memberships, error: membershipError } = await supabaseAdmin
            .from('league_memberships')
            .select('league_id')
            .eq('user_id', user.id);

        let memberLeagues: Array<{
            id: number;
            name: string;
            created_at: string;
            admin_id: string;
            sport_id: number;
            sports: { name: string } | null;
        }> = [];
        let memberError = null;

        if (memberships && memberships.length > 0) {
            // Get league details for those specific league IDs
            const leagueIds = memberships.map(m => m.league_id);
            const { data: memberLeagueData, error: memberLeagueError } = await supabaseAdmin
                .from('leagues')
                .select(`
                    id,
                    name,
                    created_at,
                    admin_id,
                    sport_id,
                    sports(name)
                `)
                .in('id', leagueIds);

            memberLeagues = (memberLeagueData || []) as unknown as typeof memberLeagues;
            memberError = memberLeagueError;
        }

        if (memberError || adminError || membershipError) {
            console.error('League fetch errors:', { memberError, adminError, membershipError });
            return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
        }

        // Combine both types of leagues
        const memberLeaguesData = memberLeagues || [];
        const adminLeaguesData = adminLeagues || [];

        // Type assertion to ensure consistent structure
        type LeagueData = {
            id: number;
            name: string;
            created_at: string;
            admin_id: string;
            sport_id: number;
            sports: { name: string }[] | null;
        };

        const allLeagues: LeagueData[] = [
            ...(memberLeaguesData.flat() as LeagueData[]),
            ...(adminLeaguesData as LeagueData[])
        ];

        // Remove duplicates by ID (in case user is both admin and member)
        const uniqueLeagues = allLeagues.filter((league, index, arr) =>
            arr.findIndex(l => l.id === league.id) === index
        );

        return NextResponse.json({ leagues: uniqueLeagues });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name, sport_id } = await request.json();

        // Validate request body to prevent SQL injection
        const bodyValidation = validateRequestBody(
            { name, sport_id },
            { name: 'string', sport_id: 'id' }
        );
        if (!bodyValidation.isValid) {
            return NextResponse.json({ error: bodyValidation.errorMessage }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // user is already available from getUser() call above

        // Create the league
        const { data: league, error: createError } = await supabase
            .from('leagues')
            .insert({
                name: name.trim(),
                admin_id: user.id,
                sport_id: sport_id,
            })
            .select()
            .single();

        if (createError) {
            return NextResponse.json(
                { error: 'Failed to create league' },
                { status: 500 }
            );
        }

        // Add the creator as a member of the league
        const { error: memberError } = await supabase
            .from('league_memberships')
            .insert({
                league_id: league.id,
                user_id: user.id,
            });

        if (memberError) {
            // League was created successfully, membership is optional
        }

        return NextResponse.json({ success: true, league });

    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}