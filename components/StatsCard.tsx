import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, trendUp, color = 'blue' }) => {
  
  const colorStyles = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-100' },
    purple: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', ring: 'ring-yellow-100' },
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="text-2xl font-semibold text-gray-900 mt-2">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-lg ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`flex items-center font-medium ${trendUp ? "text-emerald-600" : "text-red-600"}`}>
            {trendUp ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
            {trend}
          </span>
          <span className="text-gray-400 ml-2 text-xs">vs last month</span>
        </div>
      )}
    </div>
  );
};