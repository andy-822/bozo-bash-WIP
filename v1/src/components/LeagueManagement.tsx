'use client';

import { useState } from 'react';
import { Plus, Users, Code, X, UserPlus, Settings, Crown } from 'lucide-react';
import { useLeague } from '@/contexts/LeagueContext';
import { useUser } from '@/contexts/UserContext';
import InvitationManager from './InvitationManager';

export default function LeagueManagement() {
  const {
    userLeagues,
    createLeague,
    joinLeague,
    refreshLeagues
  } = useLeague();
  const { currentUser } = useUser();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInvitationManager, setShowInvitationManager] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleCreateLeague = async () => {
    if (!createName.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      const league = await createLeague(createName.trim(), createDescription.trim() || undefined);
      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
      setSuccess(`League "${league.name}" created successfully! Invite code: ${league.invite_code}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create league');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinLeague = async () => {
    if (!inviteCode.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      await joinLeague(inviteCode.trim());
      setShowJoinModal(false);
      setInviteCode('');
      setSuccess('Successfully joined the league!');
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to join league');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManageInvitations = (leagueId: string, userIsAdmin: boolean) => {
    setSelectedLeagueId(leagueId);
    setIsAdmin(userIsAdmin);
    setShowInvitationManager(true);
  };

  const closeInvitationManager = () => {
    setShowInvitationManager(false);
    setSelectedLeagueId(null);
    setIsAdmin(false);
  };

  return (
    <div className="space-y-8">
      {/* Success Message */}
      {success && (
        <div className="bg-success-green/20 border border-success-green/30 rounded-lg p-4">
          <p className="text-success-green">{success}</p>
        </div>
      )}

      {/* Your Leagues */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Your Leagues ({userLeagues.length})</h2>
        {userLeagues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userLeagues.map((league) => (
              <div
                key={league.id}
                className="bg-dark-bg border border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">{league.name}</h3>
                      {league.creator_id === currentUser?.id && (
                        <Crown className="h-4 w-4 text-warning-yellow" title="You created this league" />
                      )}
                    </div>
                    {league.description && (
                      <p className="text-gray-400 text-sm mb-3">{league.description}</p>
                    )}
                  </div>
                  {/* League Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleManageInvitations(league.id, league.creator_id === currentUser?.id)}
                      className="text-info-blue hover:text-accent-cyan p-2 rounded-lg hover:bg-gray-700 transition-colors"
                      title="Manage Invitations"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                    <button
                      className="text-gray-400 hover:text-gray-300 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                      title="League Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-500">
                    <Code className="h-3 w-3 mr-1" />
                    {league.invite_code}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(league.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-dark-bg rounded-lg p-8 border border-gray-700 text-center">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">You haven&apos;t joined any leagues yet.</p>
          </div>
        )}
      </div>

      {/* Create/Join Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create League */}
        <div className="bg-dark-bg rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="bg-success-green/20 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Plus className="h-6 w-6 text-success-green" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Create New League</h3>
            <p className="text-gray-400 text-sm mb-6">
              Start a new parlay challenge with your friends
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-success-green hover:bg-success-green/80 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Create League
            </button>
          </div>
        </div>

        {/* Join League */}
        <div className="bg-dark-bg rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="bg-info-blue/20 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Users className="h-6 w-6 text-info-blue" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Join League</h3>
            <p className="text-gray-400 text-sm mb-6">
              Enter an invite code to join an existing league
            </p>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full bg-info-blue hover:bg-info-blue/80 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Join League
            </button>
          </div>
        </div>
      </div>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-bg rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Create New League</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  League Name *
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="input-dark w-full"
                  placeholder="e.g., The Bozos, Work Friends, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="input-dark w-full h-20 resize-none"
                  placeholder="Describe your league..."
                />
              </div>

              {error && (
                <p className="text-error-red text-sm">{error}</p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLeague}
                  disabled={!createName.trim() || isSubmitting}
                  className="flex-1 bg-success-green hover:bg-success-green/80 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-bg rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Join League</h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="input-dark w-full text-center font-mono text-lg"
                  placeholder="ABCD1234"
                  maxLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the 8-character code shared by your league admin
                </p>
              </div>

              {error && (
                <p className="text-error-red text-sm">{error}</p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinLeague}
                  disabled={!inviteCode.trim() || isSubmitting}
                  className="flex-1 bg-info-blue hover:bg-info-blue/80 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invitation Manager Modal */}
      {showInvitationManager && selectedLeagueId && (
        <InvitationManager
          leagueId={selectedLeagueId}
          isAdmin={isAdmin}
          onClose={closeInvitationManager}
        />
      )}
    </div>
  );
}