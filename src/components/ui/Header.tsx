'use client';

import { Trophy, TrendingUp, LogOut, ChevronDown, Users, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useLeague } from '@/contexts/LeagueContext';
import { useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const { currentUser, logout } = useUser();
  const { currentLeague, currentSeason, userLeagues, availableSeasons, setCurrentLeague, setCurrentSeason } = useLeague();
  const [showLeagueDropdown, setShowLeagueDropdown] = useState(false);
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);

  const navItems = [
    { href: '/', label: 'Dashboard', active: pathname === '/' },
    { href: '/submit', label: 'Submit Pick', active: pathname === '/submit' },
    { href: '/leaderboard', label: 'Leaderboard', active: pathname === '/leaderboard' },
  ];

  return (
    <header className="bg-slate-800 border-b border-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & League Info */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 p-2 rounded-lg">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white">{currentLeague?.name || 'The Bozos'}</h1>
                {userLeagues.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLeagueDropdown(!showLeagueDropdown)}
                      className="text-gray-400 hover:text-white"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {showLeagueDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 min-w-48">
                        {userLeagues.map((league) => (
                          <button
                            key={league.id}
                            onClick={() => {
                              setCurrentLeague(league);
                              setShowLeagueDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-slate-600 ${
                              league.id === currentLeague?.id ? 'bg-slate-600 text-white' : 'text-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span className="truncate">{league.name}</span>
                            </div>
                          </button>
                        ))}
                        <div className="border-t border-slate-600 mt-1 pt-1">
                          <Link 
                            href="/leagues"
                            onClick={() => setShowLeagueDropdown(false)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-600 rounded-b-lg text-blue-400 hover:text-blue-300 flex items-center space-x-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Join/Create League</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-400">{currentSeason?.name || 'No Season Selected'}</p>
                {availableSeasons.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                      className="text-gray-400 hover:text-white"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showSeasonDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 min-w-40">
                        {availableSeasons.map((season) => (
                          <button
                            key={season.id}
                            onClick={() => {
                              setCurrentSeason(season);
                              setShowSeasonDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-600 first:rounded-t-lg last:rounded-b-lg ${
                              season.id === currentSeason?.id ? 'bg-slate-600 text-white' : 'text-gray-300'
                            }`}
                          >
                            {season.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-4">
            {currentUser && (
              <>
                <div className="hidden md:flex items-center space-x-3">
                  {currentUser.user_metadata?.avatar_url ? (
                    <img 
                      src={currentUser.user_metadata.avatar_url} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {currentUser.user_metadata?.full_name?.[0] || currentUser.email?.[0] || 'U'}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-400">Logged in</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-slate-700 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-slate-600">
          <nav className="flex space-x-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  item.active
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}