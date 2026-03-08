import React, { useEffect, useRef } from 'react';

interface AdSenseProps {
  client?: string;
  slot?: string;
  format?: string;
  responsive?: string;
  className?: string;
  style?: React.CSSProperties;
}

const AdSense: React.FC<AdSenseProps> = ({
  client = 'ca-pub-8933246834149901',
  slot = '1234567890', // Placeholder slot ID
  format = 'auto',
  responsive = 'true',
  className = '',
  style = { display: 'block' }
}) => {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Small timeout to ensure DOM is ready and avoid race conditions
    const timer = setTimeout(() => {
      try {
        if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
          // @ts-ignore
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {
        console.error('AdSense error:', e);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`adsense-container w-full overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={style}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};

export default AdSense;
