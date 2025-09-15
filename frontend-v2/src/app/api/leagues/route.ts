import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Fetch leagues where user is a member
        const { data: leagues, error } = await supabase
            .from('leagues')
            .select(`
                id,
                name,
                created_at,
                admin_id,
                sport_id,
                sports!inner(name)
            `)
            .eq('league_memberships.user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
        }

        return NextResponse.json({ leagues: leagues || [] });

    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'League name is required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const user = session.user;

        // Create the league
        const { data: league, error: createError } = await supabase
            .from('leagues')
            .insert({
                name: name.trim(),
                admin_id: user.id,
                sport_id: 1, // American Football
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