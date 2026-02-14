import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder }) => {
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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg transition-all
          ${isOpen ? 'bg-white border-googleBlue ring-1 ring-googleBlue' : 'hover:bg-white focus:bg-white'}
        `}
      >
        <span className={`text-sm ${value ? 'text-textMain' : 'text-textSec'}`}>
          {value || placeholder || 'Select an option'}
        </span>
        <ChevronDown size={16} className={`text-textSec transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100 origin-top">
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