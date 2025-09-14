'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trophy, Users, Calendar, Check, X, AlertCircle } from 'lucide-react';
import { useLeague } from '@/contexts/LeagueContext';
import { useUser } from '@/contexts/UserContext';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { acceptInvitation, declineInvitation } = useLeague();
  const { currentUser, loading: userLoading } = useUser();

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = params.token as string;

  useEffect(() => {
    if (!userLoading) {
      if (currentUser) {
        loadInvitation();
      } else {
        // Redirect to login with return URL
        router.push(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
      }
    }
  }, [currentUser, userLoading, token]);

  const loadInvitation = async () => {
    try {
      // We'll fetch invitation details from the database
      // For now, we'll just validate the token exists
      setLoading(false);
    } catch (err) {
      setError('Invalid or expired invitation link');
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    setProcessing(true);
    setError('');
    try {
      const result = await acceptInvitation(token);
      if (result.success) {
        setSuccess('Successfully joined the league!');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setError(result.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeclineInvitation = async () => {
    setProcessing(true);
    setError('');
    try {
      await declineInvitation(token);
      setSuccess('Invitation declined');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setProcessing(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info-blue mx-auto mb-4"></div>
          <p className="text-gray-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-dark-bg rounded-lg p-8 text-center border border-gray-700">
            <AlertCircle className="h-16 w-16 text-error-red mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-4">Invalid Invitation</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-info-blue hover:bg-info-blue/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-dark-bg rounded-lg p-8 text-center border border-gray-700">
            <Check className="h-16 w-16 text-success-green mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-4">Success!</h1>
            <p className="text-gray-400 mb-6">{success}</p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-info-blue mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-dark-bg rounded-lg border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-info-blue to-magenta-600 p-8 text-center">
            <div className="bg-white/20 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">You're Invited!</h1>
            <p className="text-blue-100">Join the ultimate parlay challenge</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Mock invitation details - in reality, you'd fetch these */}
            <div className="bg-gray-700 rounded-lg p-6 mb-8">
              <div className="flex items-start space-x-4">
                <div className="bg-info-blue rounded-full w-12 h-12 flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white mb-2">
                    Loading League Details...
                  </h2>
                  <div className="space-y-2">
                    <div className="flex items-center text-gray-400">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>2025 NFL Season</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <Users className="h-4 w-4 mr-2" />
                      <span>Role: Member</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-error-red/20 border border-error-red/30 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-error-red mr-2" />
                  <p className="text-error-red">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={handleAcceptInvitation}
                disabled={processing}
                className="flex-1 bg-success-green hover:bg-success-green/80 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Accept Invitation
                  </>
                )}
              </button>
              <button
                onClick={handleDeclineInvitation}
                disabled={processing}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <X className="h-5 w-5 mr-2" />
                    Decline
                  </>
                )}
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                By accepting this invitation, you'll join this league and can start making picks.
                You can leave the league at any time from your dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}