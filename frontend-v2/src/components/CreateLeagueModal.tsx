'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/userStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateLeagueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeagueCreated?: () => void;
}

interface Sport {
  id: number;
  name: string;
}

export default function CreateLeagueModal({ open, onOpenChange, onLeagueCreated }: CreateLeagueModalProps) {
  const user = useUserStore((state) => state.user);
  const [formData, setFormData] = useState({
    name: '',
    sport_id: '',
  });
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sportsLoading, setSportsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSports();
    }
  }, [open]);

  const fetchSports = async () => {
    setSportsLoading(true);

    // For now, just use the known sports from the database
    const knownSports = [
      { id: 1, name: 'American Football' },
      { id: 2, name: 'Hockey' },
      { id: 5, name: 'NFL' }
    ];

    setSports(knownSports);

    // Auto-select American Football (id: 1) since that's what we use for football
    setFormData(prev => ({ ...prev, sport_id: '1' }));

    setSportsLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!user) {
        throw new Error('No authentication found');
      }

      // Use the API route instead of direct database calls
      const response = await fetch('/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          sport_id: parseInt(formData.sport_id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create league');
      }


      // Close modal and reset form
      onOpenChange(false);
      setFormData({ name: '', sport_id: '' });

      // Trigger refresh of leagues list
      onLeagueCreated?.();

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create league');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ name: '', sport_id: '' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New League</DialogTitle>
          <DialogDescription>
            Set up a new parlay challenge league for you and your friends.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="The Bozos League"
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sport_id" className="text-right">
                Sport
              </Label>
              {sportsLoading ? (
                <div className="col-span-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Loading sports...
                </div>
              ) : (
                <select
                  id="sport_id"
                  value={formData.sport_id}
                  onChange={(e) => handleInputChange('sport_id', e.target.value)}
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Select a sport</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim() || !formData.sport_id}>
              {isLoading ? 'Creating...' : 'Create League'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}