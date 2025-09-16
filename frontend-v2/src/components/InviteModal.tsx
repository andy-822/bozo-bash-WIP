'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Mail, Copy, Check, UserPlus, ExternalLink } from 'lucide-react';

interface InviteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leagueId: string;
    leagueName: string;
    onMemberAdded?: () => void;
}

export default function InviteModal({ open, onOpenChange, leagueId, leagueName, onMemberAdded }: InviteModalProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleEmailInvite = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            setError('Please enter an email address');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/league-invites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    leagueId,
                    email: email.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send invitation');
            }

            if (data.userExists) {
                setSuccess(`User successfully added to ${leagueName}!`);
                setEmail('');
                // Refresh the member list if callback provided
                if (onMemberAdded) {
                    onMemberAdded();
                }
            } else {
                setSuccess(data.message);
                setInviteLink(data.inviteLink);
            }

        } catch (error) {
            console.error('Error sending invitation:', error);
            setError(error instanceof Error ? error.message : 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    const generateInviteLink = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/league-invites?league_id=${leagueId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate invite link');
            }

            setInviteLink(data.inviteLink);

        } catch (error) {
            console.error('Error generating invite link:', error);
            setError(error instanceof Error ? error.message : 'Failed to generate invite link');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (!inviteLink) return;

        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    const handleClose = () => {
        setEmail('');
        setError(null);
        setSuccess(null);
        setInviteLink(null);
        setCopied(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Invite to {leagueName}
                    </DialogTitle>
                    <DialogDescription>
                        Invite people to join your league by email or share an invite link
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Email Invitation */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <Label htmlFor="email" className="font-medium">Invite by Email</Label>
                        </div>

                        <form onSubmit={handleEmailInvite} className="space-y-3">
                            <Input
                                id="email"
                                type="email"
                                placeholder="friend@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? 'Sending...' : 'Send Invitation'}
                            </Button>
                        </form>
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>

                    {/* Invite Link */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            <Label className="font-medium">Share Invite Link</Label>
                        </div>

                        {!inviteLink ? (
                            <Button
                                variant="outline"
                                onClick={generateInviteLink}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Generating...' : 'Generate Invite Link'}
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={inviteLink}
                                        readOnly
                                        className="text-xs"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={copyToClipboard}
                                        className="flex-shrink-0"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Share this link with people you want to invite to the league
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-700">{success}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}