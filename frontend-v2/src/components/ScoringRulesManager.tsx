'use client';

import { useState, useEffect } from 'react';
import { useScoringRules, useUpdateScoringRules, useResetScoringRules, validateScoringRules, getDefaultScoringRules } from '@/hooks/useScoringRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  Trophy,
  Zap
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ScoringRulesManagerProps {
  leagueId: string;
  isAdmin: boolean;
}

export default function ScoringRulesManager({ leagueId, isAdmin }: ScoringRulesManagerProps) {
  const [formData, setFormData] = useState(getDefaultScoringRules(parseInt(leagueId)));
  const [errors, setErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useScoringRules(leagueId);
  const updateMutation = useUpdateScoringRules();
  const resetMutation = useResetScoringRules();

  // Update form data when API data loads
  useEffect(() => {
    if (data?.scoring_rules) {
      setFormData(data.scoring_rules);
      setHasChanges(false);
    }
  }, [data]);

  // Handle form field changes
  const handleChange = (field: string, value: number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    setHasChanges(true);

    // Validate in real-time
    const validation = validateScoringRules(newData);
    setErrors(validation.errors);
  };

  // Handle save
  const handleSave = async () => {
    const validation = validateScoringRules(formData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive"
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(formData);
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Scoring rules updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update scoring rules.",
        variant: "destructive"
      });
    }
  };

  // Handle reset to defaults
  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync(leagueId);
      setHasChanges(false);
      toast({
        title: "Reset Complete",
        description: "Scoring rules have been reset to defaults.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset scoring rules.",
        variant: "destructive"
      });
    }
  };

  // Handle revert changes
  const handleRevert = () => {
    if (data?.scoring_rules) {
      setFormData(data.scoring_rules);
      setHasChanges(false);
      setErrors([]);
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scoring Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Only league administrators can modify scoring rules.
            </AlertDescription>
          </Alert>

          {data?.scoring_rules && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{data.scoring_rules.points_per_win}</div>
                  <div className="text-sm text-gray-600">Win</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{data.scoring_rules.points_per_loss}</div>
                  <div className="text-sm text-gray-600">Loss</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{data.scoring_rules.points_per_push}</div>
                  <div className="text-sm text-gray-600">Push</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{data.scoring_rules.streak_bonus}</div>
                  <div className="text-sm text-gray-600">Streak Bonus</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{data.scoring_rules.weekly_winner_bonus}</div>
                  <div className="text-sm text-gray-600">Weekly Winner</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scoring Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scoring Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load scoring rules: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scoring Rules
          </CardTitle>

          {hasChanges && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevert}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending || errors.length > 0}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Validation Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Basic Scoring */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Basic Scoring
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="points_per_win">Points per Win</Label>
              <Input
                id="points_per_win"
                type="number"
                min="0"
                max="100"
                value={formData.points_per_win}
                onChange={(e) => handleChange('points_per_win', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Standard: 1 point</p>
            </div>

            <div>
              <Label htmlFor="points_per_loss">Points per Loss</Label>
              <Input
                id="points_per_loss"
                type="number"
                min="-10"
                max="10"
                value={formData.points_per_loss}
                onChange={(e) => handleChange('points_per_loss', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Standard: 0 points</p>
            </div>

            <div>
              <Label htmlFor="points_per_push">Points per Push</Label>
              <Input
                id="points_per_push"
                type="number"
                min="-5"
                max="5"
                value={formData.points_per_push}
                onChange={(e) => handleChange('points_per_push', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Standard: 0 points</p>
            </div>
          </div>
        </div>

        {/* Bonus Scoring */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Bonus Scoring
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="streak_bonus">Streak Bonus</Label>
              <Input
                id="streak_bonus"
                type="number"
                min="0"
                max="50"
                value={formData.streak_bonus}
                onChange={(e) => handleChange('streak_bonus', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bonus points awarded for every 3-win streak
              </p>
            </div>

            <div>
              <Label htmlFor="weekly_winner_bonus">Weekly Winner Bonus</Label>
              <Input
                id="weekly_winner_bonus"
                type="number"
                min="0"
                max="100"
                value={formData.weekly_winner_bonus}
                onChange={(e) => handleChange('weekly_winner_bonus', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bonus points for weekly leaderboard winners
              </p>
            </div>
          </div>
        </div>

        {/* Scoring Preview */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4">Scoring Preview</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-green-600">Perfect Week (3-0)</div>
                <div className="text-gray-600">
                  {3 * formData.points_per_win + (formData.streak_bonus > 0 ? formData.streak_bonus : 0) + formData.weekly_winner_bonus} points
                </div>
              </div>
              <div>
                <div className="font-medium text-blue-600">Good Week (2-1)</div>
                <div className="text-gray-600">
                  {2 * formData.points_per_win + 1 * formData.points_per_loss} points
                </div>
              </div>
              <div>
                <div className="font-medium text-orange-600">Average Week (1-2)</div>
                <div className="text-gray-600">
                  {1 * formData.points_per_win + 2 * formData.points_per_loss} points
                </div>
              </div>
              <div>
                <div className="font-medium text-red-600">Bad Week (0-3)</div>
                <div className="text-gray-600">
                  {3 * formData.points_per_loss} points
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!hasChanges && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reset to Defaults
            </Button>
          </div>
        )}

        {/* Success Indicator */}
        {(updateMutation.isSuccess || resetMutation.isSuccess) && !hasChanges && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Scoring rules have been successfully updated. Changes will apply to future game scoring.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}