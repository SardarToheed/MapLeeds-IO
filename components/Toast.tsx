import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000); // Auto close after 5 seconds
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const config = {
    success: {
      icon: <CheckCircle className="w-6 h-6 text-green-500" fill="#E8F5E9" />,
      border: 'border-l-green-500',
      title: 'Success'
    },
    error: {
      icon: <AlertCircle className="w-6 h-6 text-red-500" fill="#FFEBEE" />,
      border: 'border-l-red-500',
      title: 'Error'
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-yellow-500" fill="#FFF8E1" />,
      border: 'border-l-yellow-500',
      title: 'Warning'
    },
    info: {
      icon: <Info className="w-6 h-6 text-blue-500" fill="#E3F2FD" />,
      border: 'border-l-blue-500',
      title: 'Info'
    }
  };

  const style = config[type];

  return (
    <div className={`
      flex items-start gap-3 w-full max-w-sm bg-white p-4 rounded-lg shadow-toast 
      transform transition-all duration-300 animate-slide-in
      border-l-[6px] ${style.border} border-y border-r border-gray-100
      relative overflow-hidden group
    `}>
      <div className="flex-shrink-0 pt-0.5">
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-gray-900 capitalize leading-none mb-1">{style.title}</h4>
        <p className="text-sm text-gray-600 leading-tight">{message}</p>
      </div>
      <button 
        onClick={() => onClose(id)} 
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-2 -mt-2 opacity-0 group-hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
};