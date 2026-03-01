import React, { useState } from 'react';
import { X, Search, MessageCircle, Check, Sparkles, MapPin } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to MapLeads IO",
      description: "The intelligent tool to find local businesses on Google Maps and connect via WhatsApp instantly.",
      icon: <img 
        src="/api/attachments/42071665-2747-4934-8c86-664448557342" 
        alt="MapLeads Logo" 
        className="w-16 h-16 rounded-2xl shadow-lg shadow-blue-500/20 object-cover"
        referrerPolicy="no-referrer"
      />,
      bg: "bg-red-50",
    },
    {
      title: "Find Leads",
      description: "Use the 'Floating Search Bar' to scan any location. Our AI digs deep to find phone numbers and emails.",
      icon: <Search size={40} className="text-googleBlue" />,
      bg: "bg-blue-50",
    },
    {
      title: "WhatsApp Bridge",
      description: "No API required. Send messages directly through your WhatsApp Mobile or Web app with one click.",
      icon: <MessageCircle size={40} className="text-waGreen" />,
      bg: "bg-green-50",
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* Header Image Area */}
        <div className={`h-48 ${steps[step].bg} transition-colors duration-500 flex items-center justify-center relative`}>
          <div className="bg-white p-6 rounded-full shadow-lg transform transition-all hover:scale-110 duration-300">
             {steps[step].icon}
          </div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-black/5 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 text-center">
          <h2 className="text-2xl font-normal text-textMain mb-3">
            {steps[step].title}
          </h2>
          <p className="text-textSec text-sm leading-relaxed">
            {steps[step].description}
          </p>

          <div className="flex justify-center gap-2 mt-8 mb-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300
                  ${i === step ? 'w-8 bg-googleBlue' : 'w-2 bg-gray-200'}
                `}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <button 
            onClick={handleNext}
            className="w-full py-3 rounded-full bg-googleBlue text-white font-medium shadow-md hover:shadow-lg hover:bg-blue-600 transition active:scale-[0.98]"
          >
            {step === steps.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>

      </div>
    </div>
  );
};