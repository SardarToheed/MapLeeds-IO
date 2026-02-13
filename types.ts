export interface Lead {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  website: string;
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
  subject: string;
  content: string;
  status: 'Draft' | 'Sent' | 'Scheduled';
  sentCount: number;
  openRate: number;
  createdAt: Date;
}

export interface SearchHistoryItem {
  id: string;
  category: string;
  location: string;
  resultsCount: number;
  timestamp: Date;
}

export type ViewState = 'dashboard' | 'scraper' | 'leads' | 'campaigns' | 'whatsapp';