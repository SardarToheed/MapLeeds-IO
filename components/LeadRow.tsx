import React, { memo } from 'react';
import { Lead } from '../types';
import { CheckSquare, Square, Sparkles, MapPin, MessageCircle, Trash2 } from 'lucide-react';

interface LeadRowProps {
  lead: Lead;
  selected: boolean;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: 'New' | 'Contacted' | 'Converted' | 'Invalid') => void;
  onWhatsApp: (lead: Lead) => void;
  onDelete: (id: string) => void;
  style?: React.CSSProperties;
}

export const LeadRow: React.FC<LeadRowProps> = memo(({ 
  lead, 
  selected, 
  onSelect, 
  onStatusChange, 
  onWhatsApp, 
  onDelete,
  style 
}) => {
  return (
    <div style={style} className={`flex items-center border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${selected ? 'bg-blue-50/20' : ''}`}>
      <div className="px-4 py-3 w-10 flex-shrink-0">
        <button onClick={() => onSelect(lead.id)} className={`mt-1 ${selected ? 'text-googleBlue' : 'text-gray-300 hover:text-gray-400'}`}>
           {selected ? <CheckSquare size={16}/> : <Square size={16}/>}
        </button>
      </div>
      <div className="px-4 py-3 flex-1 min-w-0">
        <div className="font-medium text-textMain truncate">{lead.name}</div>
        <div className="text-xs text-textSec mt-0.5 flex items-center gap-1 truncate">
          <Sparkles size={10} className="text-yellow-500 flex-shrink-0"/> {lead.rating}
          <span className="mx-1">•</span> {lead.category}
        </div>
      </div>
      <div className="px-4 py-3 flex-1 min-w-0 hidden sm:block">
        <div className="space-y-1">
           <div className="flex items-center gap-1.5 text-xs text-textSec truncate">
             <MapPin size={12} className="flex-shrink-0" /> {lead.address}
           </div>
           {lead.phone !== 'N/A' && (
             <div className="flex items-center gap-1.5 text-xs text-textSec truncate">
               <MessageCircle size={12} className="text-waGreen flex-shrink-0"/> {lead.phone}
             </div>
           )}
        </div>
      </div>
      <div className="px-4 py-3 w-32 flex-shrink-0">
         <select 
          value={lead.status}
          onChange={(e) => onStatusChange(lead.id, e.target.value as any)}
          className={`text-xs font-medium px-2 py-1 rounded-full border-none outline-none cursor-pointer w-full
            ${lead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}
            ${lead.status === 'Contacted' ? 'bg-green-100 text-green-700' : ''}
          `}
         >
           <option value="New">New</option>
           <option value="Contacted">Contacted</option>
           <option value="Converted">Converted</option>
           <option value="Invalid">Invalid</option>
         </select>
      </div>
      <div className="px-4 py-3 w-24 flex-shrink-0 flex justify-end">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWhatsApp(lead)}
            className="p-1.5 text-waGreen hover:bg-green-50 rounded-lg transition-colors"
            title="Send Message using Template"
          >
             <MessageCircle size={18} />
          </button>
          <button
             onClick={() => onDelete(lead.id)}
             className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});
