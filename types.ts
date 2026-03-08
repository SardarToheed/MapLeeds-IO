declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export interface Lead {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  socialProfiles?: string[];
  rating: number;
  status: 'New' | 'Contacted' | 'Converted' | 'Invalid' | 'Skipped';
  source: string;
  latitude?: number;
  longitude?: number;
}

export interface ScrapeParams {
  category: string;
  location: string;
  depth: number;
}

export interface Campaign {
  id: string;
  name: string;
  platform: 'Email' | 'WhatsApp';
  subject: string;
  content: string; // HTML for Email, Markdown for WhatsApp
  status: 'Draft' | 'In Progress' | 'Completed';
  createdAt: Date;
  leads: Lead[]; // Snapshot of leads targeted
  progress: {
    sent: number;
    total: number;
  };
}

export interface SearchHistoryItem {
  id: string;
  category: string;
  location: string;
  resultsCount: number;
  timestamp: Date;
  leads?: Lead[];
}

export interface UserProfile {
  name: string;
  email: string;
  dailyLimit: number;
  generatedToday: number;
  lastResetDate: string; // ISO date string (YYYY-MM-DD)
}

export type ViewState = 'dashboard' | 'scraper' | 'leads' | 'campaigns' | 'whatsapp' | 'profile' | 'blog';