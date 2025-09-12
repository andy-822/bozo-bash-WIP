'use client';

import { useState } from 'react';
import { Plus, Users, Code, X } from 'lucide-react';
import { useLeague } from '@/contexts/LeagueContext';

export default function LeagueManagement() {
  const { 
    userLeagues, 
    createLeague, 
    joinLeague,
    refreshLeagues
  } = useLeague();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  return (
    <div className="space-y-8">
      {/* Success Message */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-400">{success}</p>
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
                className="bg-slate-800 border border-slate-600 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">{league.name}</h3>
                    {league.description && (
                      <p className="text-gray-400 text-sm mb-3">{league.description}</p>
                    )}
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
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-600 text-center">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">You haven&apos;t joined any leagues yet.</p>
          </div>
        )}
      </div>

      {/* Create/Join Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create League */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
          <div className="text-center">
            <div className="bg-green-500/20 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Plus className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Create New League</h3>
            <p className="text-gray-400 text-sm mb-6">
              Start a new parlay challenge with your friends
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Create League
            </button>
          </div>
        </div>

        {/* Join League */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
          <div className="text-center">
            <div className="bg-blue-500/20 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Join League</h3>
            <p className="text-gray-400 text-sm mb-6">
              Enter an invite code to join an existing league
            </p>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Join League
            </button>
          </div>
        </div>
      </div>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
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
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLeague}
                  disabled={!createName.trim() || isSubmitting}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
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
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
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
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinLeague}
                  disabled={!inviteCode.trim() || isSubmitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}