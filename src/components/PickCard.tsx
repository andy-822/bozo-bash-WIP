import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatOdds } from '@/lib/data';
import { Pick } from '@/lib/types';
import { Database } from '@/lib/database.types';

type DatabasePick = Database['public']['Tables']['picks']['Row'] & {
  games: Database['public']['Tables']['games']['Row'];
};

interface PickCardProps {
  pick: Pick | DatabasePick;
  showUser?: boolean;
}

export default function PickCard({ pick, showUser = true }: PickCardProps) {
  // Check if this is a database pick or legacy mock data pick
  const isDatabasePick = 'games' in pick && !('game' in pick);
  
  // Extract the data in a common format
  const game = isDatabasePick ? (pick as DatabasePick).games : (pick as Pick).game;
  const user = isDatabasePick ? null : (pick as Pick).user; // Database picks don't have user data embedded yet
  
  // Handle database vs legacy game field differences
  const awayTeam = isDatabasePick ? (game as any).away_team : (game as any).awayTeam;
  const homeTeam = isDatabasePick ? (game as any).home_team : (game as any).homeTeam;
  const gameTime = isDatabasePick ? (game as any).game_time : (game as any).gameTime;
  
  // Handle betType difference (bet_type vs betType)
  const betType = isDatabasePick ? (pick as DatabasePick).bet_type : (pick as Pick).betType;
  
  // Handle odds (ensure it's not null)
  const odds = pick.odds ?? 0;
  const getStatusIcon = () => {
    switch (pick.status) {
      case 'won':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'lost':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (pick.status) {
      case 'won':
        return 'status-won';
      case 'lost':
        return 'status-lost';
      default:
        return 'status-pending';
    }
  };

  const formatGameTime = (date: Date | string) => {
    const gameTime = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(gameTime);
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 card-hover border border-slate-600">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {showUser && user && (
            <div className="flex items-center mb-2">
              <span className="text-lg mr-2">{user.avatar}</span>
              <span className="text-sm font-medium text-gray-200">{user.name}</span>
            </div>
          )}
          
          <div className="space-y-1">
            <h3 className="font-semibold text-white">
              {awayTeam} @ {homeTeam}
            </h3>
            <p className="text-sm text-gray-400">
              {formatGameTime(gameTime)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`${getStatusBadge()}`}>
            {pick.status.charAt(0).toUpperCase() + pick.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-lg font-bold text-white">{pick.selection}</p>
          <p className="text-sm text-gray-400 capitalize">
            {betType === 'moneyline' ? 'Money Line' : betType}
          </p>
        </div>
        
        <div className="text-right">
          <p className={`text-lg font-bold ${
            odds > 0 ? 'text-green-400' : 'text-gray-200'
          }`}>
            {formatOdds(odds)}
          </p>
          <p className="text-xs text-gray-500">NFL</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-gray-500">
          Submitted {new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }).format(isDatabasePick ? new Date(pick.created_at!) : (pick as Pick).submittedAt)}
        </p>
      </div>
    </div>
  );
}