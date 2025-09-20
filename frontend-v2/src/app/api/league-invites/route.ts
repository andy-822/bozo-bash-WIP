import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId, validateEmail } from '@/lib/validation';
import { generateSecureInviteCode } from '@/lib/crypto-utils';

export async function POST(request: NextRequest) {
    try {
        const { leagueId, email } = await request.json();
        const supabase = await createServerSupabaseClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Validate league ID to prevent SQL injection
        const leagueIdValidation = validateId(leagueId, 'League ID');
        if (!leagueIdValidation.isValid) {
            return NextResponse.json({ error: leagueIdValidation.errorMessage }, { status: 400 });
        }

        // Validate email format
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return NextResponse.json({ error: emailValidation.errorMessage }, { status: 400 });
        }

        // Verify user is admin of this league
        const { data: league, error: leagueError } = await supabaseAdmin
            .from('leagues')
            .select('id, name, admin_id')
            .eq('id', leagueId)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        if (league.admin_id !== user.id) {
            return NextResponse.json({ error: 'Only league administrators can send invitations' }, { status: 403 });
        }

        // Check if user already exists in the system
        const { data: existingUser } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('email', email)
            .single();

        if (existingUser) {
            // Check if user is already a member
            const { data: existingMembership } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', leagueId)
                .eq('user_id', existingUser.id)
                .single();

            if (existingMembership) {
                return NextResponse.json({ error: 'User is already a member of this league' }, { status: 400 });
            }

            // Add user directly to league
            const { error: membershipError } = await supabaseAdmin
                .from('league_memberships')
                .insert({
                    league_id: leagueId,
                    user_id: existingUser.id
                });

            if (membershipError) {
                return NextResponse.json({ error: 'Failed to add user to league' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: 'User successfully added to league',
                userExists: true
            });
        }

        // Generate secure invite code and store in database
        const inviteCode = generateSecureInviteCode();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        // Store invitation in database
        const { error: inviteError } = await supabaseAdmin
            .from('league_invites')
            .insert({
                league_id: leagueId,
                invite_code: inviteCode,
                invited_email: email,
                expires_at: expiresAt.toISOString()
            })
            .select('id, invite_code')
            .single();

        if (inviteError) {
            return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
        }

        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteCode}`;

        return NextResponse.json({
            success: true,
            message: 'Invitation created successfully',
            inviteLink,
            userExists: false,
            note: 'Share this link with the user to join the league. Link expires in 7 days.'
        });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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
        const leagueIdValidation = validateId(leagueId, 'League ID');
        if (!leagueIdValidation.isValid) {
            return NextResponse.json({ error: leagueIdValidation.errorMessage }, { status: 400 });
        }

        // Get league info and verify access
        const { data: league, error: leagueError } = await supabaseAdmin
            .from('leagues')
            .select('id, name, admin_id')
            .eq('id', leagueId)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Check if user has access to this league (admin or member)
        let hasAccess = league.admin_id === user.id;

        if (!hasAccess) {
            const { data: membership } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .single();

            hasAccess = !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // For now, return a simple invite link
        // In a full implementation, you'd return pending invitations from a database table
        const inviteCode = btoa(`${leagueId}:${Date.now()}`).replace(/[+/=]/g, '');
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteCode}`;

        return NextResponse.json({
            inviteLink,
            leagueName: league.name
        });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}