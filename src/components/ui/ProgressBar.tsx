interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showNumbers?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

export default function ProgressBar({ 
  current, 
  total, 
  label, 
  showNumbers = true,
  color = 'blue',
  size = 'md'
}: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  const getColorClasses = () => {
    switch (color) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'h-1.5';
      case 'lg': return 'h-3';
      default: return 'h-2';
    }
  };

  return (
    <div className="w-full">
      {(label || showNumbers) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-200">{label}</span>
          )}
          {showNumbers && (
            <span className="text-sm text-gray-400">
              {current} / {total}
            </span>
          )}
        </div>
      )}
      <div className={`progress-bar ${getSizeClasses()}`}>
        <div 
          className={`progress-fill ${getColorClasses()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showNumbers && (
        <div className="mt-1 text-xs text-gray-400 text-right">
          {percentage.toFixed(1)}%
        </div>
      )}
    </div>
  );
}