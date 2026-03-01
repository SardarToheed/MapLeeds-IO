import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder,
  className = "",
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${compact ? 'w-auto' : 'w-full'}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between transition-all outline-none
          ${compact ? 'px-2 py-1 rounded-full text-xs font-medium' : 'w-full p-3 bg-gray-50 border border-gray-200 rounded-lg'}
          ${isOpen && !compact ? 'bg-white border-googleBlue ring-1 ring-googleBlue' : ''}
          ${!isOpen && !compact ? 'hover:bg-white focus:bg-white' : ''}
          ${className}
        `}
      >
        <span className={`${compact ? '' : value ? 'text-textMain' : 'text-textSec'} truncate mr-1`}>
          {value || placeholder || 'Select'}
        </span>
        <ChevronDown size={compact ? 12 : 16} className={`text-current opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100 origin-top
          ${compact ? 'min-w-[120px] right-0' : 'w-full left-0'}
        `}>
          <ul className="py-1">
            {options.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between group transition-colors"
                >
                  <span className={option === value ? 'font-medium text-googleBlue' : 'text-textMain'}>
                    {option}
                  </span>
                  {option === value && <Check size={14} className="text-googleBlue" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};