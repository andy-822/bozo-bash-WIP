'use client';

import { create } from 'zustand';
import { Game } from '@/types';

interface ModalStore {
  // Modal states
  createLeagueOpen: boolean;
  createSeasonOpen: boolean;
  inviteModalOpen: boolean;
  pickModalOpen: boolean;

  // Selected data for modals
  selectedGame: Game | null;
  selectedLeagueId: string | null;

  // Actions
  openCreateLeague: () => void;
  closeCreateLeague: () => void;

  openCreateSeason: (leagueId: string) => void;
  closeCreateSeason: () => void;

  openInviteModal: (leagueId: string) => void;
  closeInviteModal: () => void;

  openPickModal: (game: Game) => void;
  closePickModal: () => void;

  closeAllModals: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  // Initial states
  createLeagueOpen: false,
  createSeasonOpen: false,
  inviteModalOpen: false,
  pickModalOpen: false,
  selectedGame: null,
  selectedLeagueId: null,

  // Actions
  openCreateLeague: () => set({ createLeagueOpen: true }),
  closeCreateLeague: () => set({ createLeagueOpen: false }),

  openCreateSeason: (leagueId: string) => set({
    createSeasonOpen: true,
    selectedLeagueId: leagueId
  }),
  closeCreateSeason: () => set({
    createSeasonOpen: false,
    selectedLeagueId: null
  }),

  openInviteModal: (leagueId: string) => set({
    inviteModalOpen: true,
    selectedLeagueId: leagueId
  }),
  closeInviteModal: () => set({
    inviteModalOpen: false,
    selectedLeagueId: null
  }),

  openPickModal: (game: Game) => set({
    pickModalOpen: true,
    selectedGame: game
  }),
  closePickModal: () => set({
    pickModalOpen: false,
    selectedGame: null
  }),

  closeAllModals: () => set({
    createLeagueOpen: false,
    createSeasonOpen: false,
    inviteModalOpen: false,
    pickModalOpen: false,
    selectedGame: null,
    selectedLeagueId: null,
  }),
}));