import React, { useState } from 'react';
import { X, ChevronRight, MapPin, Search, MessageCircle, ArrowRight, Check, Sparkles } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to MapLeads IO",
      description: "The ultimate AI-powered tool to find local businesses, extract contacts, and automate your marketing outreach in seconds.",
      icon: <Sparkles size={40} className="text-white" />,
      bgClass: "bg-gradient-to-br from-indigo-600 to-purple-700",
      accentColor: "bg-indigo-600"
    },
    {
      title: "Find Your Target",
      description: "Use the Map Scraper to find leads. Just enter a category (e.g., 'Real Estate') and a location. Choose 'Extreme Scan' for maximum results.",
      icon: <Search size={40} className="text-white" />,
      bgClass: "bg-gradient-to-br from-blue-600 to-cyan-600",
      accentColor: "bg-blue-600"
    },
    {
      title: "Generate Content",
      description: "Use our AI generator to create professional email campaigns or WhatsApp messages tailored to your leads automatically.",
      icon: <MessageCircle size={40} className="text-white" />,
      bgClass: "bg-gradient-to-br from-emerald-600 to-teal-600",
      accentColor: "bg-emerald-600"
    },
    {
      title: "Connect & Convert",
      description: "Send WhatsApp messages directly from the dashboard or export your valid leads to CSV. Start growing your business today!",
      icon: <Check size={40} className="text-white" />,
      bgClass: "bg-gradient-to-br from-orange-500 to-red-600",
      accentColor: "bg-orange-500"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        
        {/* Top Decorative Section */}
        <div className={`relative h-56 ${steps[step].bgClass} transition-colors duration-500 ease-in-out flex items-center justify-center overflow-hidden`}>
          {/* Abstract circles for decoration */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-10 -translate-y-10 blur-xl"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-black/10 rounded-full translate-x-10 translate-y-10 blur-xl"></div>
          
          <div className="relative z-10 transform transition-transform duration-500 hover:scale-110 p-5 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
             {steps[step].icon}
          </div>

          <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition z-20"
            title="Skip Tutorial"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-8 flex-1 flex flex-col text-center">
          <div className="flex-1 flex flex-col justify-center min-h-[140px]">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 transition-all duration-300">
              {steps[step].title}
            </h2>
            <p className="text-gray-500 leading-relaxed text-sm md:text-base transition-all duration-300">
              {steps[step].description}
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="mt-8 space-y-6">
            
            {/* Dots */}
            <div className="flex justify-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-2 rounded-full transition-all duration-500 ease-out
                    ${i === step ? `w-8 ${steps[step].accentColor}` : 'w-2 bg-gray-200 hover:bg-gray-300'}
                  `}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {step > 0 && (
                 <button 
                   onClick={() => setStep(step - 1)}
                   className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition active:scale-95"
                 >
                   Back
                 </button>
              )}
              <button 
                onClick={handleNext}
                className={`flex-1 py-3.5 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 active:scale-95
                  ${steps[step].bgClass}
                `}
              >
                {step === steps.length - 1 ? "Get Started" : "Next"}
                {step < steps.length - 1 && <ArrowRight size={18} />}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};