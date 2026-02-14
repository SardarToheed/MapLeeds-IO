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
      icon: <Sparkles size={32} className="text-primary" />,
      imageBg: "bg-primaryContainer",
    },
    {
      title: "Find Your Target",
      description: "Use the Map Scraper to find leads. Just enter a category (e.g., 'Real Estate') and a location. Choose 'Extreme Scan' for maximum results.",
      icon: <Search size={32} className="text-blue-700" />,
      imageBg: "bg-blue-100",
    },
    {
      title: "Generate Content",
      description: "Use our AI generator to create professional email campaigns or WhatsApp messages tailored to your leads automatically.",
      icon: <MessageCircle size={32} className="text-green-700" />,
      imageBg: "bg-green-100",
    },
    {
      title: "Connect & Convert",
      description: "Send WhatsApp messages directly from the dashboard or export your valid leads to CSV. Start growing your business today!",
      icon: <Check size={32} className="text-orange-700" />,
      imageBg: "bg-orange-100",
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300">
      <div className="bg-[#FEF7FF] rounded-[28px] shadow-elevation-3 max-w-sm w-full relative overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* Header Icon Area */}
        <div className={`h-48 ${steps[step].imageBg} transition-colors duration-500 flex items-center justify-center relative`}>
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm transform transition-all hover:scale-105 duration-300">
             {steps[step].icon}
          </div>
          <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-gray-600 hover:bg-black/5 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Section */}
        <div className="px-6 py-6 text-center">
          <h2 className="text-2xl text-[#1C1B1F] mb-3 font-normal transition-all duration-300">
            {steps[step].title}
          </h2>
          <p className="text-gray-600 text-sm leading-6 tracking-wide transition-all duration-300">
            {steps[step].description}
          </p>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-8 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300
                  ${i === step ? 'w-6 bg-primary' : 'w-2 bg-gray-300'}
                `}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6 flex justify-between items-center gap-4">
          <button 
             onClick={step > 0 ? () => setStep(step - 1) : handleSkip}
             className="px-6 py-2.5 rounded-full text-primary font-medium hover:bg-primaryContainer/30 transition text-sm"
          >
            {step > 0 ? 'Back' : 'Skip'}
          </button>
          
          <button 
            onClick={handleNext}
            className="px-6 py-2.5 rounded-full bg-primary text-onPrimary font-medium shadow-elevation-1 hover:shadow-elevation-2 active:shadow-none transition flex items-center gap-2 text-sm"
          >
            {step === steps.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>

      </div>
    </div>
  );
};