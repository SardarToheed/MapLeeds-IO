import React, { memo } from 'react';
import { Lead } from '../types';
import { CheckSquare, Square, Sparkles, MapPin, MessageCircle, Trash2 } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  selected: boolean;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: 'New' | 'Contacted' | 'Converted' | 'Invalid') => void;
  onWhatsApp: (lead: Lead) => void;
  onDelete: (id: string) => void;
  style?: React.CSSProperties;
}

export const LeadCard: React.FC<LeadCardProps> = memo(({ 
  lead, 
  selected, 
  onSelect, 
  onStatusChange, 
  onWhatsApp, 
  onDelete,
  style 
}) => {
  return (
    <div style={style} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative ${selected ? 'ring-2 ring-googleBlue' : ''}`}>
      <div className="flex justify-between items-start mb-2">
         <div className="flex items-start gap-3">
            <button onClick={() => onSelect(lead.id)} className={`mt-1 ${selected ? 'text-googleBlue' : 'text-gray-300'}`}>
               {selected ? <CheckSquare size={20}/> : <Square size={20}/>}
            </button>
            <div>
              <h4 className="font-medium text-textMain truncate">{lead.name}</h4>
              <div className="text-xs text-textSec flex items-center gap-1 mt-1 truncate">
                <Sparkles size={10} className="text-yellow-500 flex-shrink-0"/> {lead.rating} • {lead.category}
              </div>
            </div>
         </div>
         <select 
            value={lead.status}
            onChange={(e) => onStatusChange(lead.id, e.target.value as any)}
            className={`text-[10px] font-bold px-2 py-1 rounded-full border-none outline-none
              ${lead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
              ${lead.status === 'Contacted' ? 'bg-green-100 text-green-700' : ''}
            `}
         >
           <option value="New">New</option>
           <option value="Contacted">Contacted</option>
           <option value="Converted">Converted</option>
           <option value="Invalid">Invalid</option>
         </select>
      </div>
      
      <div className="space-y-2 mt-3 pl-8 border-l-2 border-gray-100 ml-2">
         <div className="flex items-center gap-2 text-xs text-textSec truncate">
           <MapPin size={12} className="text-gray-400 flex-shrink-0"/> {lead.address}
         </div>
         {lead.phone !== 'N/A' && (
           <div className="flex items-center gap-2 text-xs text-textSec truncate">
             <MessageCircle size={12} className="text-waGreen flex-shrink-0"/> {lead.phone}
           </div>
         )}
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-50">
         <button
           onClick={() => onWhatsApp(lead)}
           className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-waGreen rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
         >
            <MessageCircle size={14} /> Message
         </button>
         <button
            onClick={() => onDelete(lead.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
         >
           <Trash2 size={14} /> Delete
         </button>
      </div>
    </div>
  );
});
