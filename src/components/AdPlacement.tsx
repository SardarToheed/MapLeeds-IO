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

  // Exact HTML snippets as provided by the user, untouched
  const adSnippets = {
    'skyscraper': `<div data-placement-id="revbid-skyscraper" id='revbid-skyscraper-2731' style='min-width: 120px; min-height: 600px;text-align:center'></div>`,
    'mobile': `<div data-placement-id="revbid-mobile" id='revbid-mobile-3156' style='min-width: 300px; min-height: 100px;text-align:center'></div>`,
    'square': `<div data-placement-id="revbid-square" id='revbid-square-13340' style='min-width: 300px; min-height: 250px;text-align:center'></div>`,
    'big-skyscraper': `<div data-placement-id="revbid-big-skyscraper" id='revbid-big-skyscraper-4600' style='min-width: 120px; min-height: 600px;text-align:center'></div>`,
    'leaderboard': `<div data-placement-id="revbid-leaderboard" id='revbid-leaderboard-8606' style='min-width: 468px; min-height: 60px;text-align:center'></div>`,
    'big-leaderboard': `<div data-placement-id="revbid-big-leaderboard" id='revbid-big-leaderboard-5160' style='min-width: 468px; min-height: 60px;text-align:center'></div>`
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Direct injection of the exact raw HTML snippet to avoid React virtual DOM attribute transformations
    containerRef.current.innerHTML = adSnippets[type];

    // Dynamically load the revbid script next to the newly injected container so it discovers the element immediately
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://prebid.revbid.net/15171/revbid.js';
    script.async = true;

    script.onerror = (err) => {
      console.warn('Ad script loading failed for format:', type, err);
    };

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [type]);

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

