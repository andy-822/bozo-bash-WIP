interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend = 'neutral',
  className = ''
}: StatsCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-6 card-hover ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className={`text-sm mt-1 ${getTrendColor()}`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-4">
            <div className="bg-blue-500/20 p-3 rounded-lg">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}