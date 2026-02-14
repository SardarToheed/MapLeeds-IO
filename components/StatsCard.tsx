import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: string; // Kept for API compatibility, but mapped to Material tones
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, trendUp }) => {
  return (
    <div className="bg-surfaceVariant/30 rounded-[24px] p-6 hover:shadow-elevation-2 transition-shadow duration-300 border border-white/50 relative overflow-hidden group">
      {/* Decorative background blob */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-primaryContainer rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out"></div>
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-sm font-medium text-gray-600 tracking-wide">{title}</p>
          <p className="text-4xl font-normal text-[#1C1B1F] mt-2 font-sans">{value}</p>
        </div>
        <div className="bg-primaryContainer text-onPrimaryContainer p-4 rounded-2xl">
          <Icon size={24} strokeWidth={1.5} />
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center text-sm font-medium relative z-10">
          <span className={`px-2 py-0.5 rounded-full text-xs ${trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {trend}
          </span>
          <span className="text-gray-500 ml-2 text-xs">vs last session</span>
        </div>
      )}
    </div>
  );
};