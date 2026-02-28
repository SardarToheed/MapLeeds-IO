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
      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      bg: 'bg-white',
      border: 'border-emerald-500',
      title: 'Success'
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      bg: 'bg-white',
      border: 'border-red-500',
      title: 'Error'
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      bg: 'bg-white',
      border: 'border-amber-500',
      title: 'Warning'
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-500" />,
      bg: 'bg-white',
      border: 'border-blue-500',
      title: 'Info'
    }
  };

  const style = config[type];

  return (
    <div className={`
      flex items-start gap-3 w-full max-w-sm p-4 rounded-xl shadow-lg 
      transform transition-all duration-300 animate-slide-in
      bg-white border border-gray-100 ring-1 ring-black/5
      relative overflow-hidden group
    `}>
      <div className="flex-shrink-0 pt-0.5">
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 mb-0.5">{style.title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
      <button 
        onClick={() => onClose(id)} 
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
      >
        <X size={14} />
      </button>
    </div>
  );
};