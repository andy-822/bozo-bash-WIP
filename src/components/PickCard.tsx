import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatOdds } from '@/lib/data';
import { Pick } from '@/lib/types';

interface PickCardProps {
  pick: Pick;
  showUser?: boolean;
}

export default function PickCard({ pick, showUser = true }: PickCardProps) {
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

  const formatGameTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 card-hover border border-slate-600">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {showUser && (
            <div className="flex items-center mb-2">
              <span className="text-lg mr-2">{pick.user.avatar}</span>
              <span className="text-sm font-medium text-gray-200">{pick.user.name}</span>
            </div>
          )}
          
          <div className="space-y-1">
            <h3 className="font-semibold text-white">
              {pick.game.awayTeam} @ {pick.game.homeTeam}
            </h3>
            <p className="text-sm text-gray-400">
              {formatGameTime(pick.game.gameTime)}
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
            {pick.betType === 'moneyline' ? 'Money Line' : pick.betType}
          </p>
        </div>
        
        <div className="text-right">
          <p className={`text-lg font-bold ${
            pick.odds > 0 ? 'text-green-400' : 'text-gray-200'
          }`}>
            {formatOdds(pick.odds)}
          </p>
          <p className="text-xs text-gray-500">{pick.game.sport}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-gray-500">
          Submitted {new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }).format(pick.submittedAt)}
        </p>
      </div>
    </div>
  );
}