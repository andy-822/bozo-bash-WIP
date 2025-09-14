'use client';

import { useState } from 'react';
import { Plus, Users, Trophy, Calendar, Code, ArrowRight, X } from 'lucide-react';
import { useLeague } from '@/contexts/LeagueContext';

export default function LeagueSelection() {
  const { 
    userLeagues, 
    currentLeague, 
    currentSeason,
    availableSeasons,
    loading, 
    setCurrentLeague, 
    setCurrentSeason,
    createLeague, 
    joinLeague 
  } = useLeague();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info-blue mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your leagues...</p>
        </div>
      </div>
    );
  }

  // If user has leagues and both league/season are selected, don't show this screen
  if (currentLeague && currentSeason) {
    return null;
  }

  const handleCreateLeague = async () => {
    if (!createName.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      const league = await createLeague(createName.trim(), createDescription.trim() || undefined);
      setCurrentLeague(league);
      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to join league');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="bg-info-blue p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            {userLeagues.length === 0 ? 'Welcome to The Bozos!' : 'Select Your League'}
          </h1>
          <p className="text-gray-400 text-lg">
            {userLeagues.length === 0 
              ? 'Create a new league or join an existing one to get started'
              : 'Choose which league and season you want to play in'
            }
          </p>
        </div>

        {/* League Selection */}
        {userLeagues.length > 0 && !currentLeague && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Your Leagues</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userLeagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => setCurrentLeague(league)}
                  className="bg-dark-bg hover:bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">{league.name}</h3>
                      {league.description && (
                        <p className="text-gray-400 text-sm mb-3">{league.description}</p>
                      )}
                      <div className="flex items-center text-xs text-gray-500">
                        <Code className="h-3 w-3 mr-1" />
                        {league.invite_code}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-500 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Season Selection */}
        {currentLeague && !currentSeason && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Select Season for {currentLeague.name}
            </h2>
            {availableSeasons.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableSeasons.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => setCurrentSeason(season)}
                    className="bg-dark-bg hover:bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">{season.name}</h3>
                        <div className="flex items-center text-sm text-gray-400">
                          <Calendar className="h-4 w-4 mr-2" />
                          {season.sport} • {season.year}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-500 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-dark-bg rounded-lg p-8 border border-gray-700 text-center">
                <Calendar className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Seasons Available</h3>
                <p className="text-gray-400 mb-4">
                  This league doesn&apos;t have any active seasons yet. 
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-info-blue hover:bg-info-blue/80 text-white px-4 py-2 rounded-lg mb-4"
                >
                  Refresh Page
                </button>
                <p className="text-sm text-gray-500">
                  League ID: {currentLeague.id}<br/>
                  Available seasons: {availableSeasons.length}<br/>
                  Check browser console for errors.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create/Join Actions */}
        {(!currentLeague || userLeagues.length === 0) && (
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
        )}

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
      </div>
    </div>
  );
}