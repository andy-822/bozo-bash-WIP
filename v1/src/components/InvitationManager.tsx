'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Link2,
  Users,
  UserPlus,
  X,
  Copy,
  Check,
  Clock,
  AlertCircle,
  Send,
  Trash2,
  RefreshCw,
  Search,
  UserX,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useLeague } from '@/contexts/LeagueContext';

interface InvitationManagerProps {
  leagueId: string;
  isAdmin?: boolean;
  onClose?: () => void;
}

type InvitationType = 'email' | 'link' | 'search';

export default function InvitationManager({
  leagueId,
  isAdmin = false,
  onClose
}: InvitationManagerProps) {
  const {
    sendEmailInvitation,
    createInviteLink,
    getLeagueInvitations,
    getUserInvitations,
    cancelInvitation,
    resendInvitation,
    getLeagueJoinRequests,
    approveJoinRequest,
    rejectJoinRequest
  } = useLeague();

  const [activeTab, setActiveTab] = useState<'invite' | 'pending' | 'requests'>('invite');
  const [inviteType, setInviteType] = useState<InvitationType>('email');

  // Form states
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [linkExpireDays, setLinkExpireDays] = useState(7);

  // Data states
  const [invitations, setInvitations] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [userInvitations, setUserInvitations] = useState<any[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string>('');

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Load data
  useEffect(() => {
    if (isAdmin) {
      loadLeagueInvitations();
      loadJoinRequests();
    } else {
      loadUserInvitations();
    }
  }, [leagueId, isAdmin]);

  const loadLeagueInvitations = async () => {
    try {
      const data = await getLeagueInvitations(leagueId);
      setInvitations(data);
    } catch (err) {
      console.error('Error loading invitations:', err);
    }
  };

  const loadUserInvitations = async () => {
    try {
      const data = await getUserInvitations();
      setUserInvitations(data.filter(inv => inv.league_id === leagueId));
    } catch (err) {
      console.error('Error loading user invitations:', err);
    }
  };

  const loadJoinRequests = async () => {
    try {
      const data = await getLeagueJoinRequests(leagueId);
      setJoinRequests(data);
    } catch (err) {
      console.error('Error loading join requests:', err);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');
    try {
      await sendEmailInvitation(leagueId, email.trim(), role, message.trim() || undefined);
      setSuccess('Invitation sent successfully!');
      setEmail('');
      setMessage('');
      await loadLeagueInvitations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInviteLink = async () => {
    setIsLoading(true);
    setError('');
    try {
      const invitation = await createInviteLink(leagueId, role, linkExpireDays);
      setGeneratedLink(invitation.invite_link);
      setSuccess('Invite link created successfully!');
      await loadLeagueInvitations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create invite link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
      setSuccess('Invitation cancelled');
      await loadLeagueInvitations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitation(invitationId);
      setSuccess('Invitation resent');
      await loadLeagueInvitations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend invitation');
    }
  };

  const handleApproveJoinRequest = async (requestId: string) => {
    try {
      await approveJoinRequest(requestId, 'Welcome to the league!');
      setSuccess('Join request approved');
      await loadJoinRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve join request');
    }
  };

  const handleRejectJoinRequest = async (requestId: string) => {
    try {
      await rejectJoinRequest(requestId, 'Sorry, your request was not approved at this time.');
      setSuccess('Join request rejected');
      await loadJoinRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject join request');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'declined': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'expired': return <AlertCircle className="h-4 w-4 text-gray-400" />;
      case 'cancelled': return <UserX className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-bg rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {isAdmin ? 'Manage Invitations' : 'Your Invitations'}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('invite')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'invite'
                ? 'text-info-blue border-b-2 border-info-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Send Invites
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-info-blue border-b-2 border-info-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending Invites ({invitations.filter(i => i.status === 'pending').length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'text-info-blue border-b-2 border-info-blue'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Join Requests ({joinRequests.length})
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-success-green/20 border border-success-green/30 rounded-lg p-3 mb-4">
              <p className="text-success-green text-sm">{success}</p>
            </div>
          )}
          {error && (
            <div className="bg-error-red/20 border border-error-red/30 rounded-lg p-3 mb-4">
              <p className="text-error-red text-sm">{error}</p>
            </div>
          )}

          {/* Send Invites Tab */}
          {activeTab === 'invite' && isAdmin && (
            <div className="space-y-6">
              {/* Invitation Type Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setInviteType('email')}
                  className={`p-4 rounded-lg border transition-colors ${
                    inviteType === 'email'
                      ? 'border-info-blue bg-info-blue/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <Mail className="h-6 w-6 mx-auto mb-2 text-info-blue" />
                  <span className="block text-sm font-medium text-white">Email Invitation</span>
                </button>
                <button
                  onClick={() => setInviteType('link')}
                  className={`p-4 rounded-lg border transition-colors ${
                    inviteType === 'link'
                      ? 'border-info-blue bg-info-blue/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <Link2 className="h-6 w-6 mx-auto mb-2 text-info-blue" />
                  <span className="block text-sm font-medium text-white">Invite Link</span>
                </button>
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Role
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="member"
                      checked={role === 'member'}
                      onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                      className="mr-2"
                    />
                    <span className="text-gray-300">Member</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                      className="mr-2"
                    />
                    <span className="text-gray-300">Admin</span>
                  </label>
                </div>
              </div>

              {/* Email Invitation Form */}
              {inviteType === 'email' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-dark w-full"
                      placeholder="friend@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Personal Message (Optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-dark w-full h-20 resize-none"
                      placeholder="Join our league for some friendly competition!"
                    />
                  </div>
                  <button
                    onClick={handleSendEmailInvite}
                    disabled={!email.trim() || isLoading}
                    className="w-full bg-info-blue hover:bg-info-blue/80 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Link Generation Form */}
              {inviteType === 'link' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Link Expires In
                    </label>
                    <select
                      value={linkExpireDays}
                      onChange={(e) => setLinkExpireDays(Number(e.target.value))}
                      className="input-dark w-full"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>1 week</option>
                      <option value={14}>2 weeks</option>
                      <option value={30}>1 month</option>
                    </select>
                  </div>
                  <button
                    onClick={handleCreateInviteLink}
                    disabled={isLoading}
                    className="w-full bg-success-green hover:bg-success-green/80 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="h-5 w-5 mr-2" />
                        Generate Invite Link
                      </>
                    )}
                  </button>

                  {/* Generated Link Display */}
                  {generatedLink && (
                    <div className="bg-gray-700 rounded-lg p-4 mt-4">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Share this link:
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={generatedLink}
                          readOnly
                          className="input-dark flex-1 mr-2 text-sm"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="bg-info-blue hover:bg-info-blue/80 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                        >
                          {copiedLink ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pending Invitations Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {invitations.length > 0 ? (
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(invitation.status)}
                          <div>
                            <p className="text-white font-medium">
                              {invitation.email || 'Invite Link'}
                            </p>
                            <p className="text-sm text-gray-400">
                              Role: {invitation.role} •
                              Created: {formatDate(invitation.created_at)} •
                              Expires: {formatDate(invitation.expires_at)}
                            </p>
                            {invitation.message && (
                              <p className="text-sm text-gray-300 mt-1">"{invitation.message}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {isAdmin && invitation.status === 'pending' && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="text-info-blue hover:text-accent-cyan p-1"
                            title="Resend invitation"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="text-error-red hover:text-error-red/80 p-1"
                            title="Cancel invitation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No pending invitations</p>
                </div>
              )}
            </div>
          )}

          {/* Join Requests Tab */}
          {activeTab === 'requests' && isAdmin && (
            <div className="space-y-4">
              {joinRequests.length > 0 ? (
                <div className="space-y-3">
                  {joinRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="bg-info-blue rounded-full w-8 h-8 flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {request.user?.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="text-white font-medium">{request.user?.name}</p>
                              <p className="text-sm text-gray-400">{request.user?.email}</p>
                            </div>
                          </div>
                          {request.message && (
                            <p className="text-gray-300 text-sm mb-3">"{request.message}"</p>
                          )}
                          <p className="text-xs text-gray-500">
                            Requested: {formatDate(request.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleApproveJoinRequest(request.id)}
                            className="bg-success-green hover:bg-success-green/80 text-white px-3 py-1 rounded text-sm flex items-center"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectJoinRequest(request.id)}
                            className="bg-error-red hover:bg-error-red/80 text-white px-3 py-1 rounded text-sm flex items-center"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No pending join requests</p>
                </div>
              )}
            </div>
          )}

          {/* Non-admin view */}
          {!isAdmin && (
            <div className="text-center py-8">
              <p className="text-gray-400">Contact your league admin to invite new members.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}