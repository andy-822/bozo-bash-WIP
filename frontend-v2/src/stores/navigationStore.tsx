'use client';

import { create } from 'zustand';

export interface Breadcrumb {
  label: string;
  href?: string; // Optional link - if no href, it's the current page
}

interface NavigationStore {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
  addBreadcrumb: (crumb: Breadcrumb) => void;
  clearBreadcrumbs: () => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  breadcrumbs: [],

  setBreadcrumbs: (crumbs: Breadcrumb[]) => set({ breadcrumbs: crumbs }),

  addBreadcrumb: (crumb: Breadcrumb) => set((state) => ({
    breadcrumbs: [...state.breadcrumbs, crumb]
  })),

  clearBreadcrumbs: () => set({ breadcrumbs: [] }),
}));