'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
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
}

export default function CreateLeagueModal({ open, onOpenChange }: CreateLeagueModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);

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
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('No authentication found');
      }

      // Create league directly with Supabase client
      const { data: league, error: createError } = await supabase
        .from('leagues')
        .insert({
          name: formData.name.trim(),
          admin_id: session.user.id,
          sport_id: 1, // American Football
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message || 'Failed to create league');
      }

      // Add creator as member
      const { error: memberError } = await supabase
        .from('league_memberships')
        .insert({
          league_id: league.id,
          user_id: session.user.id,
        });

      if (memberError) {
        console.warn('Failed to add creator as member:', memberError);
        // League was created successfully, membership is optional
      }

      console.log('League created successfully:', league);

      // Close modal and reset form
      onOpenChange(false);
      setFormData({ name: '', description: '' });

      // You might want to trigger a refresh of the leagues list here
      // or show a success toast notification

    } catch (error) {
      console.error('Error creating league:', error);
      // You might want to show an error toast here
      alert(error instanceof Error ? error.message : 'Failed to create league');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ name: '', description: '' });
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
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Weekly parlay challenge"
                className="col-span-3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading ? 'Creating...' : 'Create League'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}