import React from 'react';
import { Zap, Download, MessageCircle, Search } from 'lucide-react';

export const AboutMapleads: React.FC = () => {
  return (
    <div className="mt-6 bg-gray-50/50 rounded-xl p-6 border border-gray-100 animate-in fade-in slide-in-from-top-2">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* SEO Content */}
        <div>
          <h3 className="text-xl font-bold text-textMain mb-4 text-center">Why MapLeads is the Best Google Maps Lead Extractor?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-textSec leading-relaxed">
            <div className="space-y-3">
              <p>
                <strong>MapLeads</strong> is a specialized <strong>B2B Lead Generation</strong> tool designed for agencies, sales teams, and local businesses. 
                Our <strong>Google Maps Scraper</strong> uses advanced AI to extract verified business data, including phone numbers, ratings, and categories.
              </p>
              <p>
                Whether you are looking for <em>Restaurants in New York</em> or <em>Real Estate Agents in Dubai</em>, our <strong>Lead Finder</strong> 
                provides high-quality prospects to fuel your sales pipeline.
              </p>
            </div>
            <div className="space-y-3">
              <p>
                Beyond extraction, we offer integrated <strong>WhatsApp Marketing</strong> tools. Generate <strong>WhatsApp Links</strong>, 
                create <strong>WhatsApp QR Codes</strong>, and use our <strong>Bulk WhatsApp Sender</strong> to reach out to your leads instantly.
              </p>
              <p>
                Stop manual searching and start automating your outreach with the most powerful <strong>Google Maps Data Extractor</strong> on the market.
              </p>
            </div>
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="pt-8 border-t border-gray-200">
          <h3 className="text-xl font-bold text-textMain mb-6 text-center">Frequently Asked Questions</h3>
          <div className="space-y-6 text-sm text-textSec">
            <div>
              <h4 className="font-bold text-gray-900 mb-1">What is the best tool to scrape Google Maps for B2B leads?</h4>
              <p>MapLeads is widely considered the best tool to scrape Google Maps for B2B leads because it combines high-speed data extraction with integrated AI email writing and WhatsApp marketing tools.</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">How can I extract verified phone numbers from Google Maps?</h4>
              <p>You can extract verified phone numbers from Google Maps using MapLeads. By entering a business category and location into the MapLeads scraper, the software automatically mines public listings and filters for valid, dialable phone numbers.</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">What is the best alternative to manual B2B lead generation?</h4>
              <p>The best alternative to manual B2B lead generation is automated scraping software like MapLeads. It automates the extraction of hundreds of local business profiles in minutes.</p>
            </div>
          </div>
        </div>

        {/* How it Works Section */}
        <div className="pt-8 border-t border-gray-200">
          <h3 className="text-xl font-bold text-textMain mb-8 text-center">How to Use the Google Maps Lead Extractor?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-googleBlue/10 text-googleBlue rounded-full flex items-center justify-center font-bold mb-4">1</div>
              <h4 className="font-semibold text-textMain mb-2">Enter Keyword</h4>
              <p className="text-xs text-textSec">Type your target niche like "Restaurants" or "Plumbers".</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-googleGreen/10 text-googleGreen rounded-full flex items-center justify-center font-bold mb-4">2</div>
              <h4 className="font-semibold text-textMain mb-2">Set Location</h4>
              <p className="text-xs text-textSec">Choose a city or region to extract leads from.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-googleYellow/10 text-googleYellow rounded-full flex items-center justify-center font-bold mb-4">3</div>
              <h4 className="font-semibold text-textMain mb-2">Export Leads</h4>
              <p className="text-xs text-textSec">Download your verified B2B lead list in CSV format.</p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="pt-8 border-t border-gray-200">
          <h3 className="text-xl font-bold text-textMain mb-8 text-center">Powerful Features for B2B Growth</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-50 text-googleBlue rounded-lg flex items-center justify-center">
                <Zap size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-textMain">AI-Powered Extraction</h4>
                <p className="text-xs text-textSec mt-1">Our intelligent scraper identifies the most relevant business data from Google Maps.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-green-50 text-googleGreen rounded-lg flex items-center justify-center">
                <Download size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-textMain">Easy Export</h4>
                <p className="text-xs text-textSec mt-1">Download your leads in CSV format for easy integration with your CRM.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
