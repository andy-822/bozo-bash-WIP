'use client';

import { useUser } from '@/contexts/UserContext';
import { useLeague } from '@/contexts/LeagueContext';
import Login from './Login';
import LeagueSelection from './LeagueSelection';

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const { isAuthenticated, loading: userLoading } = useUser();
  const { currentLeague, currentSeason, loading: leagueLoading } = useLeague();

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Show league selection if user hasn't selected league/season
  if (!currentLeague || !currentSeason) {
    return <LeagueSelection />;
  }

  return <>{children}</>;
}