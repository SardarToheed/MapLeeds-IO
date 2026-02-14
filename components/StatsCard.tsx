import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: string; // Mapped to new palette internally
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, trendUp, color }) => {
  
  // Dynamic color mapping based on the "color" prop passed
  let iconColorClass = "text-googleBlue";
  let iconBgClass = "bg-blue-50";

  if (color === 'purple') { iconColorClass = "text-purple-600"; iconBgClass = "bg-purple-50"; }
  else if (color === 'orange') { iconColorClass = "text-orange-600"; iconBgClass = "bg-orange-50"; }
  else if (color === 'green') { iconColorClass = "text-googleGreen"; iconBgClass = "bg-green-50"; }

  return (
    <div className="bg-white rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-transparent">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-textSec uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-normal text-textMain mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${iconBgClass} ${iconColorClass}`}>
          <Icon size={24} strokeWidth={2} />
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center text-sm font-medium">
          <span className={`flex items-center gap-1 ${trendUp ? "text-googleGreen" : "text-googleRed"}`}>
            {trend}
          </span>
          <span className="text-textSec ml-2 text-xs">vs last session</span>
        </div>
      )}
    </div>
  );
};