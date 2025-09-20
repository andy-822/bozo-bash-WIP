import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId } from '@/lib/validation';

interface ScoringRulesRequest {
  league_id: number;
  points_per_win?: number;
  points_per_loss?: number;
  points_per_push?: number;
  streak_bonus?: number;
  weekly_winner_bonus?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    const leagueValidation = validateId(leagueId, 'League ID');
    if (!leagueValidation.isValid) {
      return NextResponse.json({ error: leagueValidation.errorMessage }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user has access to this league
    const { data: membership } = await supabaseAdmin
      .from('league_memberships')
      .select('league_id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'League not found or access denied' }, { status: 404 });
    }

    // Get scoring rules for the league
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('league_scoring_rules')
      .select('*')
      .eq('league_id', leagueId)
      .single();

    if (rulesError && rulesError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return NextResponse.json({ error: 'Failed to fetch scoring rules' }, { status: 500 });
    }

    // Return default rules if none exist
    const scoringRules = rules || {
      league_id: parseInt(leagueId),
      points_per_win: 1,
      points_per_loss: 0,
      points_per_push: 0,
      streak_bonus: 0,
      weekly_winner_bonus: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      scoring_rules: scoringRules
    });

  } catch (err) {
    console.error('API: Get scoring rules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ScoringRulesRequest = await request.json();
    const { league_id, points_per_win, points_per_loss, points_per_push, streak_bonus, weekly_winner_bonus } = body;

    if (!league_id) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    const leagueValidation = validateId(league_id.toString(), 'League ID');
    if (!leagueValidation.isValid) {
      return NextResponse.json({ error: leagueValidation.errorMessage }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user is admin of this league
    const { data: league } = await supabaseAdmin
      .from('leagues')
      .select('id, admin_id')
      .eq('id', league_id)
      .eq('admin_id', user.id)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'League not found or insufficient permissions' }, { status: 403 });
    }

    // Validate scoring rules values
    const rules = {
      league_id,
      points_per_win: points_per_win ?? 1,
      points_per_loss: points_per_loss ?? 0,
      points_per_push: points_per_push ?? 0,
      streak_bonus: streak_bonus ?? 0,
      weekly_winner_bonus: weekly_winner_bonus ?? 0,
      updated_at: new Date().toISOString()
    };

    // Validate that scoring values are reasonable
    if (rules.points_per_win < 0 || rules.points_per_win > 100) {
      return NextResponse.json({ error: 'Points per win must be between 0 and 100' }, { status: 400 });
    }

    if (rules.points_per_loss < -10 || rules.points_per_loss > 10) {
      return NextResponse.json({ error: 'Points per loss must be between -10 and 10' }, { status: 400 });
    }

    if (rules.points_per_push < -5 || rules.points_per_push > 5) {
      return NextResponse.json({ error: 'Points per push must be between -5 and 5' }, { status: 400 });
    }

    if (rules.streak_bonus < 0 || rules.streak_bonus > 50) {
      return NextResponse.json({ error: 'Streak bonus must be between 0 and 50' }, { status: 400 });
    }

    if (rules.weekly_winner_bonus < 0 || rules.weekly_winner_bonus > 100) {
      return NextResponse.json({ error: 'Weekly winner bonus must be between 0 and 100' }, { status: 400 });
    }

    // Upsert scoring rules
    const { data: updatedRules, error: upsertError } = await supabaseAdmin
      .from('league_scoring_rules')
      .upsert(rules, {
        onConflict: 'league_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to upsert scoring rules:', upsertError);
      return NextResponse.json({ error: 'Failed to update scoring rules' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Scoring rules updated successfully',
      scoring_rules: updatedRules
    });

  } catch (err) {
    console.error('API: Update scoring rules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    const leagueValidation = validateId(leagueId, 'League ID');
    if (!leagueValidation.isValid) {
      return NextResponse.json({ error: leagueValidation.errorMessage }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user is admin of this league
    const { data: league } = await supabaseAdmin
      .from('leagues')
      .select('id, admin_id')
      .eq('id', leagueId)
      .eq('admin_id', user.id)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'League not found or insufficient permissions' }, { status: 403 });
    }

    // Reset to default scoring rules
    const defaultRules = {
      league_id: parseInt(leagueId),
      points_per_win: 1,
      points_per_loss: 0,
      points_per_push: 0,
      streak_bonus: 0,
      weekly_winner_bonus: 0,
      updated_at: new Date().toISOString()
    };

    const { error: resetError } = await supabaseAdmin
      .from('league_scoring_rules')
      .upsert(defaultRules, {
        onConflict: 'league_id'
      });

    if (resetError) {
      console.error('Failed to reset scoring rules:', resetError);
      return NextResponse.json({ error: 'Failed to reset scoring rules' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Scoring rules reset to defaults',
      scoring_rules: defaultRules
    });

  } catch (err) {
    console.error('API: Reset scoring rules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}