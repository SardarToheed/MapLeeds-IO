import React, { useEffect, useRef } from 'react';

export type AdType = 
  | 'skyscraper' 
  | 'mobile' 
  | 'square' 
  | 'big-skyscraper' 
  | 'leaderboard' 
  | 'big-leaderboard';

interface AdPlacementProps {
  type: AdType;
  className?: string;
}

export const AdPlacement: React.FC<AdPlacementProps> = ({ type, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Map of ad types to their specifications
  const adSpecs = {
    'skyscraper': {
      'data-placement-id': 'revbid-skyscraper',
      'id': 'revbid-skyscraper-2731',
      'style': { minWidth: '120px', minHeight: '600px', textAlign: 'center' as const }
    },
    'mobile': {
      'data-placement-id': 'revbid-mobile',
      'id': 'revbid-mobile-3156',
      'style': { minWidth: '300px', minHeight: '100px', textAlign: 'center' as const }
    },
    'square': {
      'data-placement-id': 'revbid-square',
      'id': 'revbid-square-13340',
      'style': { minWidth: '300px', minHeight: '250px', textAlign: 'center' as const }
    },
    'big-skyscraper': {
      'data-placement-id': 'revbid-big-skyscraper',
      'id': 'revbid-big-skyscraper-4600',
      'style': { minWidth: '120px', minHeight: '600px', textAlign: 'center' as const }
    },
    'leaderboard': {
      'data-placement-id': 'revbid-leaderboard',
      'id': 'revbid-leaderboard-8606',
      'style': { minWidth: '468px', minHeight: '60px', textAlign: 'center' as const }
    },
    'big-leaderboard': {
      'data-placement-id': 'revbid-big-leaderboard',
      'id': 'revbid-big-leaderboard-5160',
      'style': { minWidth: '468px', minHeight: '60px', textAlign: 'center' as const }
    }
  };

  const spec = adSpecs[type];

  useEffect(() => {
    if (!spec || !containerRef.current) return;

    // Clear previous elements inside the container wrapper immediately
    containerRef.current.innerHTML = '';

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      // Ensure it is empty
      containerRef.current.innerHTML = '';

      // Re-create the ad slot div
      const adSlot = document.createElement('div');
      adSlot.setAttribute('data-placement-id', spec['data-placement-id']);
      adSlot.setAttribute('id', spec.id);
      
      // Apply styling
      Object.assign(adSlot.style, spec.style);

      containerRef.current.appendChild(adSlot);

      // Create and append the revbid script dynamically to re-trigger ad delivery within this slot
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = '//prebid.revbid.net/15171/revbid.js';
      script.async = true;

      // Handle script errors gracefully
      script.onerror = (err) => {
        console.warn('Ad script loading failed for format:', type, err);
      };

      // Append script to ensure slot initialization
      adSlot.appendChild(script);
    }, 150);

    return () => {
      clearTimeout(timer);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [type, spec]);

  // Clean, professional ad visual placeholder and wrapper to prevent layout shift
  return (
    <div className={`flex flex-col items-center justify-center p-3 my-4 bg-gray-50/50 rounded-2xl border border-gray-150/60 max-w-full overflow-hidden ${className}`}>
      <span className="text-[9px] font-bold text-gray-450 uppercase tracking-widest mb-2 select-none">
        Advertisement
      </span>
      <div 
        ref={containerRef} 
        className="flex items-center justify-center bg-white/70 rounded-xl overflow-hidden shadow-2xs border border-gray-100 p-1 min-w-[124px]"
      />
    </div>
  );
};
