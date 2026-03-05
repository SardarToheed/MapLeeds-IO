import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  MapPin, 
  Users, 
  Mail, 
  MessageCircle, 
  Settings, 
  Bell,
  X,
  Plus,
  Heart,
  Search,
  Download,
  Send,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Zap,
  Layers,
  Flame,
  ArrowUpDown,
  ArrowRight,
  ExternalLink,
  Play,
  Copy,
  Share2,
  History,
  RotateCcw,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  Map,
  Filter,
  Crosshair,
  Link,
  Smartphone,
  Edit3,
  Save,
  Rocket,
  CheckSquare,
  Square,
  Settings2,
  QrCode,
  Star
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { StatsCard } from './components/StatsCard';
import { OnboardingModal } from './components/OnboardingModal';
import { Toast, ToastType } from './components/Toast';
import { ConfirmationModal } from './components/ConfirmationModal';
import { CustomSelect } from './components/CustomSelect';
import { ProfileModal } from './components/ProfileModal';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { searchBusinesses, generateEmailContent, hasApiKey, validateWhatsAppNumber, lookupLocation } from './services/geminiService';
import { generateWhatsAppLink, openWhatsAppTab, isMobileDevice, shareContent, copyImageToClipboard } from './services/whatsappService';
import { Lead, Campaign, ViewState, SearchHistoryItem, UserProfile } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

type SortKey = 'name' | 'rating' | 'status' | 'address';
type SortDirection = 'asc' | 'desc';

// Cache Constants
const CACHE_PREFIX = 'mapleads_cache_';

const CATEGORIES = [
  'Restaurants', 'Real Estate Agents', 'Dentists', 'Gyms', 'Plumbers', 
  'Marketing Agencies', 'Coffee Shops', 'Lawyers', 'Accountants', 
  'Electricians', 'Hair Salons', 'Car Repair', 'Hotels', 'Bakeries', 
  'Florists', 'Photographers', 'Architects', 'Interior Designers',
  'Software Companies', 'Consultants', 'Insurance Agents', 'Travel Agencies'
];

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<ViewState>('dashboard');
  
  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // UI / Modals
  const [toasts, setToasts] = useState<Array<{id: string, message: string, type: ToastType}>>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runTutorial, setRunTutorial] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // ROI Calculator State
  const [roiLeads, setRoiLeads] = useState<number>(1000);
  const [roiConversion, setRoiConversion] = useState<number>(5);
  const [roiDealValue, setRoiDealValue] = useState<number>(1000);

  // Live Activity State
  const [liveActivities, setLiveActivities] = useState([
    { id: 1, text: '24 Leads for "Dentists in London"', color: 'text-googleBlue' },
    { id: 2, text: '18 Leads for "Real Estate in Dubai"', color: 'text-googleGreen' },
    { id: 3, text: '42 Leads for "Restaurants in New York"', color: 'text-googleYellow' },
    { id: 4, text: '12 Leads for "Gyms in Sydney"', color: 'text-googleRed' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const colors = ['text-googleBlue', 'text-googleGreen', 'text-googleYellow', 'text-googleRed'];
      const cities = ['London', 'Dubai', 'New York', 'Sydney', 'Paris', 'Tokyo', 'Berlin', 'Toronto', 'Singapore', 'Mumbai'];
      const niches = ['Dentists', 'Real Estate', 'Restaurants', 'Gyms', 'Plumbers', 'Lawyers', 'Accountants', 'Cafes', 'Hotels', 'Spas'];
      
      const newActivity = {
        id: Date.now(),
        text: `${Math.floor(Math.random() * 50) + 5} Leads for "${niches[Math.floor(Math.random() * niches.length)]} in ${cities[Math.floor(Math.random() * cities.length)]}"`,
        color: colors[Math.floor(Math.random() * colors.length)]
      };

      setLiveActivities(prev => {
        const updated = [newActivity, ...prev];
        if (updated.length > 8) return updated.slice(0, 8);
        return updated;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const savedProfile = localStorage.getItem('mapleads_user_profile');
    const today = new Date().toISOString().split('T')[0];

    if (savedProfile) {
      try {
        const profile: UserProfile = JSON.parse(savedProfile);
        if (profile.lastResetDate !== today) {
          profile.generatedToday = 0;
          profile.lastResetDate = today;
          localStorage.setItem('mapleads_user_profile', JSON.stringify(profile));
        }
        setUserProfile(profile);
      } catch (e) {
        console.error("Failed to parse profile", e);
      }
    }
  }, []);

  const handleSaveProfile = (name: string, email: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newProfile: UserProfile = {
      name,
      email,
      dailyLimit: 100,
      generatedToday: 0,
      lastResetDate: today
    };
    setUserProfile(newProfile);
    localStorage.setItem('mapleads_user_profile', JSON.stringify(newProfile));
    addToast("Profile saved successfully!", 'success');
  };

  const incrementScrapeCount = (count: number) => {
    if (!userProfile) return;
    
    const updatedProfile = {
      ...userProfile,
      generatedToday: userProfile.generatedToday + count
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('mapleads_user_profile', JSON.stringify(updatedProfile));
  };

  const tutorialSteps: Step[] = useMemo(() => [
    {
      target: 'body',
      content: (
        <div className="text-center space-y-2">
          <h3 className="font-bold text-lg">Welcome to MapLeads! 👋</h3>
          <p className="text-sm">Let's take a quick tour to help you find your first lead.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: window.innerWidth >= 768 ? '#desktop-nav-dashboard' : '#mobile-nav-dashboard',
      content: 'This is your Dashboard. See your stats and recent activity here.',
      data: { view: 'dashboard' }
    },
    {
      target: window.innerWidth >= 768 ? '#desktop-nav-scraper' : '#mobile-nav-scraper',
      content: 'Go here to find new business leads from Google Maps.',
      data: { view: 'scraper' }
    },
    {
      target: '#scraper-card',
      content: 'Enter a business category (e.g., "Dentists") and a location (e.g., "London") here.',
      data: { view: 'scraper' }
    },
    {
      target: window.innerWidth >= 768 ? '#desktop-nav-leads' : '#mobile-nav-leads',
      content: 'Once found, your leads appear here. You can manage, export, or contact them.',
      data: { view: 'leads' }
    },
    {
      target: window.innerWidth >= 768 ? '#desktop-nav-campaigns' : '#mobile-nav-campaigns',
      content: 'Create automated outreach campaigns via Email or WhatsApp.',
      data: { view: 'campaigns' }
    },
    {
      target: window.innerWidth >= 768 ? '#desktop-nav-whatsapp' : '#mobile-nav-whatsapp',
      content: 'Use these tools for quick, direct WhatsApp messaging without saving contacts.',
      data: { view: 'whatsapp' }
    }
  ], []);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTutorial(false);
      localStorage.setItem('mapleads_tutorial_completed', 'true');
    }
    
    // Handle view switching
    if (type === 'step:after') {
      if (action === 'next') {
         const nextStep = tutorialSteps[index + 1];
         if (nextStep?.data?.view) {
           setView(nextStep.data.view as ViewState);
         }
      } else if (action === 'prev') {
         const prevStep = tutorialSteps[index - 1];
         if (prevStep?.data?.view) {
           setView(prevStep.data.view as ViewState);
         }
      }
    }
  }, [tutorialSteps]);

  // Scraper State
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [scrapeLocationHints, setScrapeLocationHints] = useState('');
  const [scrapeMode, setScrapeMode] = useState<'fast' | 'deep' | 'extreme'>('fast');
  const [scrapeSource, setScrapeSource] = useState<'Google Maps' | 'Facebook' | 'Instagram'>('Google Maps');
  const [isScraping, setIsScraping] = useState(false);
  const [isScrapingMore, setIsScrapingMore] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Campaign State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [newCampaignData, setNewCampaignData] = useState({
    name: '',
    platform: 'WhatsApp' as 'Email' | 'WhatsApp',
    topic: '',
    tone: 'Professional'
  });
  const [generatedContent, setGeneratedContent] = useState({ subject: '', body: '' });
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [readingArticle, setReadingArticle] = useState<{title: string, content: React.ReactNode} | null>(null);

  // WhatsApp Tools State
  const [waDirectPhone, setWaDirectPhone] = useState('');
  const [waDirectMsg, setWaDirectMsg] = useState('');
  
  // WhatsApp Template & Bulk Sender State
  const [messageTemplate, setMessageTemplate] = useState("Hello {name}, I found your business on Google Maps and would like to inquire about your services.");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<Lead[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkStats, setBulkStats] = useState({ sent: 0, skipped: 0, total: 0 });
  const [showQrCode, setShowQrCode] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // --- EFFECTS ---

  useEffect(() => {
    // Load History
    const savedHistory = localStorage.getItem('mapleads_history');
    if (savedHistory) {
      try { setSearchHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    
    // Load Campaigns
    const savedCampaigns = localStorage.getItem('mapleads_campaigns');
    if (savedCampaigns) {
       try { setCampaigns(JSON.parse(savedCampaigns)); } catch(e) {}
    }
    
    // Load Template
    const savedTemplate = localStorage.getItem('mapleads_template');
    if (savedTemplate) {
      setMessageTemplate(savedTemplate);
    }

    // Check onboarding
    const hasSeenOnboarding = localStorage.getItem('mapleads_onboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
      localStorage.setItem('mapleads_onboarding', 'true');
    }
  }, []);

  useEffect(() => {
    if (!showOnboarding) {
      const hasSeenTutorial = localStorage.getItem('mapleads_tutorial_completed');
      if (!hasSeenTutorial) {
        const timer = setTimeout(() => setRunTutorial(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [showOnboarding]);

  useEffect(() => {
    try {
      localStorage.setItem('mapleads_history', JSON.stringify(searchHistory));
    } catch (e) {
       const trimmed = searchHistory.slice(0, 20);
       setSearchHistory(trimmed);
       localStorage.setItem('mapleads_history', JSON.stringify(trimmed));
    }
  }, [searchHistory]);

  useEffect(() => {
     localStorage.setItem('mapleads_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);
  
  useEffect(() => {
    localStorage.setItem('mapleads_template', messageTemplate);
  }, [messageTemplate]);

  // Dynamic Title for SEO
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard | MapLeads - Free B2B Lead Gen',
      scraper: 'Google Maps Scraper | Find Business Leads Free',
      leads: 'My Leads | Manage & Export B2B Data',
      campaigns: 'AI Campaigns | Cold Email & WhatsApp Marketing',
      whatsapp: 'WhatsApp Tools | Bulk Sender & Link Generator'
    };
    document.title = titles[view] || 'MapLeads | Free Lead Generation Tool';
  }, [view]);

  // Google Analytics Tracking (using the script in index.html)
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: view
      });
    }
  }, [view]);

  // --- HELPERS ---

  const handleShareApp = async () => {
    const shareData = {
      title: 'MapLeads - Free B2B Lead Extractor',
      text: 'Check out MapLeads! It extracts unlimited leads from Google Maps and automates WhatsApp marketing for free.',
      url: 'https://mapleads.online/'
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        addToast("Thanks for sharing!", 'success');
      } catch (err) {
        // User cancelled or error
      }
    } else {
      copyImageToClipboard('https://mapleads.online/'); // Fallback to copying URL
      navigator.clipboard.writeText(shareData.url);
      addToast("Link copied to clipboard!", 'success');
    }
  };

  const addToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addToHistory = (category: string, location: string, resultLeads: Lead[]) => {
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      category,
      location,
      resultsCount: resultLeads.length,
      timestamp: new Date(),
      leads: resultLeads 
    };
    setSearchHistory(prev => {
      const filtered = prev.filter(p => !(p.category === category && p.location === location));
      return [newItem, ...filtered].slice(0, 50);
    });
  };

  const restoreSession = (item: SearchHistoryItem) => {
    if (item.leads && item.leads.length > 0) {
      setLeads(item.leads);
      setScrapeCategory(item.category);
      setScrapeLocation(item.location);
      setView('leads');
      addToast(`Restored session: ${item.category} in ${item.location}`, 'success');
    } else {
      setScrapeCategory(item.category);
      setScrapeLocation(item.location);
      setView('scraper');
      addToast('Search parameters restored. Ready to scrape.', 'info');
    }
  };

  const clearHistory = () => {
    if (searchHistory.length === 0) return;
    setSearchHistory([]);
    addToast("Search history cleared", 'info');
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => prev.filter(item => item.id !== id));
    addToast("Item removed from history", 'info');
  };

  const processTemplate = (template: string, lead: Lead) => {
    return template
      .replace(/{name}/g, lead.name)
      .replace(/{address}/g, lead.address)
      .replace(/{category}/g, lead.category)
      .replace(/{phone}/g, lead.phone);
  };

  // --- ACTIONS ---

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      addToast("Geolocation is not supported by your browser", 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const text = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
          const refined = await lookupLocation(text); 
          setScrapeLocation(refined);
          addToast("Location detected successfully", 'success');
        } catch (error) {
          addToast("Failed to determine location name", 'error');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        addToast("Location permission denied", 'error');
        setIsLocating(false);
      }
    );
  };

  const performScrape = async (isLoadMore: boolean = false) => {
    if (!userProfile) {
      setShowProfileModal(true);
      addToast("Please complete your profile to start searching.", 'info');
      return;
    }

    if (userProfile.generatedToday >= userProfile.dailyLimit) {
      addToast("Daily limit reached (100 leads). Resets at 00:00 UTC.", 'error');
      return;
    }

    if (!hasApiKey()) {
      addToast("API Key missing. Please configure environment.", 'error');
      return;
    }
    
    const isFacebookGroupUrl = scrapeSource === 'Facebook' && (scrapeCategory.includes('facebook.com/groups/') || scrapeCategory.includes('fb.com/groups/'));
    
    if (!scrapeCategory) {
      addToast("Please enter a category or group link.", 'warning');
      return;
    }
    
    if (!isFacebookGroupUrl && !scrapeLocation) {
      addToast("Please enter a target location.", 'warning');
      return;
    }

    if (isLoadMore) {
      setIsScrapingMore(true);
    } else {
      setIsScraping(true);
    }
    setScrapeProgress(0);
    setScrapeError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setScrapeProgress(prev => {
        if (prev >= 90) return prev;
        // Slower progress as it gets higher
        const increment = Math.max(0.5, (90 - prev) / 20);
        return Math.min(90, prev + increment);
      });
    }, 200);

    try {
      let currentKnownNames = isLoadMore ? leads.map(l => l.name) : [];
      let gatheredLeads: Lead[] = [];
      const iterations = (scrapeMode === 'extreme' && !isLoadMore) ? 3 : 1;
      
      for (let i = 0; i < iterations; i++) {
        // Double check limit inside loop for extreme mode
        if (userProfile.generatedToday + gatheredLeads.length >= userProfile.dailyLimit) {
          addToast("Daily limit reached during search.", 'warning');
          break;
        }

        if (iterations > 1 && i > 0) {
          addToast(`Batch ${i + 1}/${iterations}: Digging deeper...`, 'info');
        }

        const newBatch = await searchBusinesses(
          scrapeCategory, 
          scrapeLocation, 
          scrapeMode, 
          scrapeLocationHints, 
          currentKnownNames,
          scrapeSource
        );

        if (newBatch.length === 0) {
          if (i === 0) addToast("No businesses found.", 'info');
          break;
        }

        // Respect the limit strictly
        const remaining = userProfile.dailyLimit - (userProfile.generatedToday + gatheredLeads.length);
        const limitedBatch = newBatch.slice(0, remaining);

        gatheredLeads = [...gatheredLeads, ...limitedBatch];
        currentKnownNames = [...currentKnownNames, ...limitedBatch.map(l => l.name)];

        if (!isLoadMore) {
           setLeads(prev => i === 0 ? limitedBatch : [...prev, ...limitedBatch]);
        } else {
           setLeads(prev => [...prev, ...limitedBatch]);
        }

        if (limitedBatch.length < newBatch.length) {
          addToast("Daily limit reached. Some results were omitted.", 'warning');
          break;
        }

        if (i < iterations - 1) await new Promise(r => setTimeout(r, 1500));
      }

      clearInterval(progressInterval);
      setScrapeProgress(100);

      if (gatheredLeads.length > 0) {
        incrementScrapeCount(gatheredLeads.length);
        if (!isLoadMore) {
           addToHistory(scrapeCategory, scrapeLocation, gatheredLeads);
           await new Promise(r => setTimeout(r, 600));
           addToast(`Search Complete! Found ${gatheredLeads.length} total businesses.`, 'success');
           setView('leads');
        } else {
           addToast(`Added ${gatheredLeads.length} more leads`, 'success');
        }
      } else {
        setScrapeProgress(0);
      }

    } catch (error: any) {
      console.error(error);
      clearInterval(progressInterval);
      setScrapeProgress(0);
      
      let errorMessage = "Failed to fetch leads. Please try again.";
      let toastMessage = "Scraping failed. Please try again.";

      if (error.message) {
        if (error.message.includes("API key not valid")) {
          errorMessage = "Invalid API Key. Please check your configuration.";
          toastMessage = "Invalid API Key.";
        } else if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
          errorMessage = "Daily AI quota exceeded. Please try again tomorrow.";
          toastMessage = "AI Quota Exceeded.";
        } else if (error.message.includes("NetworkError") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your internet connection.";
          toastMessage = "Network Error.";
        } else if (error.message.includes("safety")) {
           errorMessage = "Search query flagged by safety filters. Try different keywords.";
           toastMessage = "Safety Filter Triggered.";
        }
      }

      setScrapeError(errorMessage);
      addToast(toastMessage, 'error');
    } finally {
      setIsScraping(false);
      setIsScrapingMore(false);
    }
  };

  const handleStatusChange = (id: string, newStatus: Lead['status']) => {
    setLeads(leads.map(lead => 
      lead.id === id ? { ...lead, status: newStatus } : lead
    ));
    
    // Also update campaign progress if active
    if (activeCampaignId) {
      setCampaigns(prev => prev.map(c => {
         if (c.id === activeCampaignId) {
           // update internal lead status for campaign view
           const updatedLeads = c.leads.map(l => l.id === id ? {...l, status: newStatus} : l);
           return { ...c, leads: updatedLeads };
         }
         return c;
      }));
    }
  };

  const handleDeleteLead = (id: string) => {
    setLeads(leads.filter(l => l.id !== id));
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map(l => l.id)));
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Category,Address,Phone,Email,Website,Rating,Status\n"
      + leads.map(l => 
          `"${l.name}","${l.category}","${l.address}","${l.phone}","${l.email}","${l.website}","${l.rating}","${l.status}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mapleads_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Leads exported to CSV", 'success');
  };

  const handleWhatsAppAction = (lead: Lead) => {
    if (!validateWhatsAppNumber(lead.phone)) {
      addToast("Invalid phone number for WhatsApp", 'warning');
      return;
    }
    const text = processTemplate(messageTemplate, lead);
    openWhatsAppTab(lead.phone, text);
    handleStatusChange(lead.id, 'Contacted');
  };

  const startBulkSend = () => {
    const queue = leads.filter(l => selectedLeadIds.has(l.id) && validateWhatsAppNumber(l.phone));
    if (queue.length === 0) {
      addToast("No valid leads selected for WhatsApp", 'warning');
      return;
    }
    setBulkQueue(queue);
    setBulkStats({ sent: 0, skipped: 0, total: queue.length });
    setIsBulkSending(true);
  };
  
  const handleBulkNext = (status: 'Contacted' | 'Skipped') => {
     if (bulkQueue.length === 0) {
       setIsBulkSending(false);
       addToast("Bulk sending completed!", 'success');
       return;
     }
     const [current, ...rest] = bulkQueue;
     
     if (status === 'Contacted') {
       handleWhatsAppAction(current);
       setBulkStats(prev => ({ ...prev, sent: prev.sent + 1 }));
     } else {
       handleStatusChange(current.id, 'Skipped');
       setBulkStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
     }

     if (rest.length === 0) {
       setIsBulkSending(false);
       addToast(`Bulk session finished. Sent: ${bulkStats.sent + (status === 'Contacted' ? 1 : 0)}, Skipped: ${bulkStats.skipped + (status === 'Skipped' ? 1 : 0)}`, 'success');
     }
     
     setBulkQueue(rest);
  };


  // --- CAMPAIGN LOGIC ---

  const handleGenerateCampaignContent = async () => {
    if(!hasApiKey()) { addToast("API Key missing", 'error'); return; }
    if(!newCampaignData.topic) { addToast("Please enter a topic", 'warning'); return; }

    setIsGeneratingContent(true);
    try {
      const content = await generateEmailContent(newCampaignData.topic, newCampaignData.tone, newCampaignData.platform);
      setGeneratedContent(content);
    } catch(e) {
      addToast("AI generation failed", 'error');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleSaveCampaign = () => {
    if(!newCampaignData.name || !generatedContent.body) {
      addToast("Incomplete campaign data", 'warning');
      return;
    }
    
    let targetLeads = leads.filter(l => l.status === 'New');
    if(targetLeads.length === 0) targetLeads = leads;

    if(targetLeads.length === 0) {
       addToast("No leads available to target", 'error');
       return;
    }

    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: newCampaignData.name,
      platform: newCampaignData.platform,
      subject: generatedContent.subject,
      content: generatedContent.body,
      status: 'Draft',
      createdAt: new Date(),
      leads: targetLeads,
      progress: {
        sent: 0,
        total: targetLeads.length
      }
    };
    
    setCampaigns([newCampaign, ...campaigns]);
    setIsCreatingCampaign(false);
    setNewCampaignData({ name: '', platform: 'WhatsApp', topic: '', tone: 'Professional' });
    setGeneratedContent({ subject: '', body: '' });
    addToast(`Campaign "${newCampaign.name}" created with ${targetLeads.length} leads`, 'success');
  };

  const handleExecuteCampaign = (campaign: Campaign) => {
    setActiveCampaignId(campaign.id);
  };

  const handleCampaignAction = (campaignId: string, lead: Lead, action: 'send') => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    // Process placeholders (e.g. {name}) before sending
    const processedBody = processTemplate(campaign.content, lead);
    const processedSubject = processTemplate(campaign.subject, lead);

    if (action === 'send') {
      if (campaign.platform === 'WhatsApp') {
         openWhatsAppTab(lead.phone, processedBody);
      } else {
         window.open(`mailto:${lead.email}?subject=${encodeURIComponent(processedSubject)}&body=${encodeURIComponent(processedBody)}`);
      }

      // Update progress
      setCampaigns(prev => prev.map(c => {
         if (c.id === campaignId) {
            // Check if already sent to avoid double counting
            const leadIndex = c.leads.findIndex(l => l.id === lead.id);
            if (leadIndex === -1 || c.leads[leadIndex].status === 'Contacted') return c;
            
            const updatedLeads = [...c.leads];
            updatedLeads[leadIndex] = { ...updatedLeads[leadIndex], status: 'Contacted' };
            
            return {
               ...c,
               leads: updatedLeads,
               progress: { ...c.progress, sent: c.progress.sent + 1 },
               status: (c.progress.sent + 1) >= c.progress.total ? 'Completed' : 'In Progress'
            };
         }
         return c;
      }));
      
      // Update main leads list too
      handleStatusChange(lead.id, 'Contacted');
    }
  };


  // --- RENDERERS ---

  const openArticle = (id: string) => {
    const articles: Record<string, {title: string, content: React.ReactNode}> = {
      'local-seo': {
        title: 'How to Use a Google Maps Scraper for Local SEO',
        content: (
          <div className="space-y-4">
            <p>Local SEO is all about visibility. When you use a Google Maps Scraper, you're not just finding leads; you're analyzing the market.</p>
            <h3 className="text-xl font-bold text-gray-900 mt-4">1. Identify Competitors</h3>
            <p>By scraping businesses in your niche, you can see who is ranking and why. Look at their review counts, ratings, and categories.</p>
            <h3 className="text-xl font-bold text-gray-900 mt-4">2. Find Partnership Opportunities</h3>
            <p>Don't just look for customers. Look for partners. A web design agency can partner with an SEO agency found on Maps.</p>
            <h3 className="text-xl font-bold text-gray-900 mt-4">3. Build a Targeted List</h3>
            <p>Quality over quantity. Use the scraper to filter by rating. Businesses with 3.5 to 4.5 stars often know they need help but aren't a lost cause.</p>
          </div>
        )
      },
      'whatsapp-marketing': {
        title: 'Mastering WhatsApp Marketing for Small Businesses',
        content: (
          <div className="space-y-4">
            <p>WhatsApp has a 98% open rate. It's the most powerful channel for B2B outreach if used correctly.</p>
            <h3 className="text-xl font-bold text-gray-900 mt-4">The Golden Rule: Permission</h3>
            <p>Always ensure you have a reason to contact. "I saw your business on Google Maps and noticed..." is a great opener.</p>
            <h3 className="text-xl font-bold text-gray-900 mt-4">Personalization is Key</h3>
            <p>Use our AI writer to craft messages that mention the business name and specific details. Generic spam gets blocked.</p>
          </div>
        )
      },
      'ai-prospecting': {
        title: 'The Power of AI in Sales Prospecting',
        content: (
          <div className="space-y-4">
            <p>AI isn't replacing sales people; it's giving them superpowers. Gemini 3.1 Pro can analyze a business category and suggest the perfect pitch.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Tone Matching:</strong> AI can adjust your email tone from professional to casual based on the industry.</li>
              <li><strong>Pain Point Prediction:</strong> AI knows that a "Dentist" cares about "Patient Retention" while a "Plumber" cares about "Emergency Calls".</li>
            </ul>
          </div>
        )
      },
      'real-estate': {
        title: 'Real Estate Lead Generation Strategies for 2026',
        content: (
          <div className="space-y-4">
            <p>The real estate market is shifting. Commercial real estate agents need to find business owners directly.</p>
            <p>Use MapLeads to find "Law Firms", "Tech Startups", or "Medical Clinics" that might be looking for new office space.</p>
            <p>Directly contacting the business owner via the extracted phone number bypasses the gatekeepers.</p>
          </div>
        )
      }
    };
    setReadingArticle(articles[id] || null);
  };

  const renderDashboard = () => {
    const totalLeads = leads.length;
    const contacted = leads.filter(l => l.status === 'Contacted').length;
    const converted = leads.filter(l => l.status === 'Converted').length;

    const data = [
      { name: 'New', value: leads.filter(l => l.status === 'New').length, color: '#1a73e8' },
      { name: 'Contacted', value: contacted, color: '#fbbc04' },
      { name: 'Converted', value: converted, color: '#34a853' },
      { name: 'Skipped', value: leads.filter(l => l.status === 'Skipped').length, color: '#ea4335' },
    ];

    return (
      <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-4">Ready to Grow Your Business?</h1>
            <p className="text-blue-100 mb-6 max-w-xl text-lg">
              Start extracting high-quality B2B leads from Google Maps, Facebook, and Instagram instantly. 
              Automate your outreach and close more deals today.
            </p>
            <button 
              onClick={() => setView('scraper')}
              className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-3 px-8 rounded-xl shadow-md transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <Search size={20} />
              Start Generating Leads
            </button>
          </div>
        </div>

        {/* Mobile Daily Limit Card */}
        <div className="md:hidden bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-xl shadow-gray-900/10 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
           <div className="flex justify-between items-center mb-3 relative z-10">
             <div className="flex items-center gap-2">
               <Zap size={18} className="text-blue-400 fill-blue-400" />
               <span className="text-sm font-bold">Daily Generation Limit</span>
             </div>
             <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded-lg border border-white/10">
               {userProfile?.generatedToday || 0} / {userProfile?.dailyLimit || 100}
             </span>
           </div>
           <div className="w-full bg-gray-700 rounded-full h-2 mb-1 overflow-hidden relative z-10">
              <div 
                className="bg-blue-400 h-full rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)] transition-all duration-500"
                style={{ width: `${Math.min(100, ((userProfile?.generatedToday || 0) / (userProfile?.dailyLimit || 100)) * 100)}%` }}
              ></div>
           </div>
           <p className="text-[10px] text-gray-400 font-medium relative z-10">Resets at 00:00 UTC</p>
        </div>

        <div id="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Leads" value={totalLeads} icon={Users} color="blue" />
          <StatsCard title="Contacted" value={contacted} icon={MessageCircle} color="orange" />
          <StatsCard title="Converted" value={converted} icon={CheckCircle} color="green" />
          <StatsCard title="Campaigns" value={campaigns.length} icon={Mail} color="purple" />
        </div>

        {/* Tools Overview Section for SEO */}
      <section className="mt-16 bg-white rounded-2xl p-8 border border-gray-100 shadow-sm" aria-labelledby="tools-overview-title">
        <h2 id="tools-overview-title" className="text-2xl font-bold text-textMain mb-8 text-center">Our Specialized B2B Growth Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <article className="space-y-4">
            <div className="w-12 h-12 bg-blue-50 text-googleBlue rounded-xl flex items-center justify-center" aria-hidden="true">
              <Search size={24} />
            </div>
            <h3 className="text-lg font-bold text-textMain">Google Maps Scraper</h3>
            <p className="text-sm text-textSec leading-relaxed">
              Our <strong>Google Maps Lead Extractor</strong> is designed for high-speed data mining. Extract business names, verified phone numbers, physical addresses, and customer ratings. Perfect for building a <strong>B2B lead list</strong> in minutes.
            </p>
          </article>
          <article className="space-y-4">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center" aria-hidden="true">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-bold text-textMain">AI Campaign Writer</h3>
            <p className="text-sm text-textSec leading-relaxed">
              Leverage the power of <strong>Gemini AI</strong> to write high-converting outreach content. Whether it's for cold email or <strong>WhatsApp marketing</strong>, our AI ensures your message is personalized and professional.
            </p>
          </article>
          <article className="space-y-4">
            <div className="w-12 h-12 bg-green-50 text-waGreen rounded-xl flex items-center justify-center" aria-hidden="true">
              <MessageCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-textMain">WhatsApp Marketing</h3>
            <p className="text-sm text-textSec leading-relaxed">
              The ultimate <strong>WhatsApp Marketing Tool</strong>. Send bulk messages, generate deep links for your profile, and create high-resolution <strong>WhatsApp QR codes</strong> to bridge the gap between offline and online.
            </p>
          </article>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-card border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-googleBlue">
                  <History size={20} />
                </div>
                <h3 className="text-lg font-medium text-textMain">Recent Searches</h3>
              </div>
              {searchHistory.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-textSec uppercase bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg font-medium">Query</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Results</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 rounded-r-lg text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {searchHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-textSec">
                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                        No search history yet.
                      </td>
                    </tr>
                  ) : (
                    searchHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-4 py-3 font-medium text-textMain">{item.category}</td>
                        <td className="px-4 py-3 text-textSec">{item.location}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {item.resultsCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-textSec">{new Date(item.timestamp).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => restoreSession(item)}
                              title="Restore Session"
                              className="text-googleBlue hover:bg-blue-50 p-2 rounded-lg transition-colors"
                            >
                              <RotateCcw size={16} />
                            </button>
                            <button 
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              title="Delete Item"
                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {searchHistory.length === 0 ? (
                <div className="text-center py-8 text-textSec">
                   <Search size={24} className="mx-auto mb-2 opacity-20" />
                   <p>No search history yet.</p>
                </div>
              ) : (
                searchHistory.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <h4 className="font-medium text-textMain">{item.category}</h4>
                         <p className="text-xs text-textSec flex items-center gap-1 mt-1">
                           <MapPin size={10}/> {item.location}
                         </p>
                       </div>
                       <span className="bg-white text-blue-600 text-xs font-bold px-2 py-1 rounded-lg shadow-sm border border-gray-100">
                         {item.resultsCount}
                       </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200/50">
                       <span className="text-xs text-textSec">{new Date(item.timestamp).toLocaleDateString()}</span>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => restoreSession(item)}
                            className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"
                          >
                            <RotateCcw size={14}/>
                          </button>
                          <button 
                            onClick={(e) => deleteHistoryItem(item.id, e)}
                            className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-red-500 rounded-lg"
                          >
                            <Trash2 size={14}/>
                          </button>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6 flex flex-col">
            <h3 className="text-lg font-medium text-textMain mb-6">Lead Status</h3>
            <div className="h-64 w-full relative min-w-0 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-textMain">{totalLeads}</span>
                <span className="text-xs text-textSec uppercase tracking-wider">Total</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
               {data.map((d) => (
                 <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-textSec">{d.name}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* SEO Content Section */}
        <div className="mt-16 bg-gray-50/50 rounded-3xl p-8 border border-gray-100">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-textMain mb-6 text-center">Why MapLeads is the Best Google Maps Lead Extractor?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-textSec leading-relaxed">
              <div className="space-y-4">
                <p>
                  <strong>MapLeads</strong> is a specialized <strong>B2B Lead Generation</strong> tool designed for agencies, sales teams, and local businesses. 
                  Our <strong>Google Maps Scraper</strong> uses advanced AI to extract verified business data, including phone numbers, ratings, and categories.
                </p>
                <p>
                  Whether you are looking for <em>Restaurants in New York</em> or <em>Real Estate Agents in Dubai</em>, our <strong>Lead Finder</strong> 
                  provides high-quality prospects to fuel your sales pipeline.
                </p>
              </div>
              <div className="space-y-4">
                <p>
                  Beyond extraction, we offer integrated <strong>WhatsApp Marketing</strong> tools. Generate <strong>WhatsApp Links</strong>, 
                  create <strong>WhatsApp QR Codes</strong>, and use our <strong>Bulk WhatsApp Sender</strong> to reach out to your leads instantly.
                </p>
                <p>
                  Stop manual searching and start automating your outreach with the most powerful <strong>Google Maps Data Extractor</strong> on the market.
                </p>
              </div>
            </div>

            {/* AI Optimization (AIO / GEO) FAQ Section */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-xl font-bold text-textMain mb-6 text-center">Frequently Asked Questions (AI & Search Optimized)</h3>
              <div className="space-y-6 text-sm text-textSec">
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">What is the best tool to scrape Google Maps for B2B leads?</h4>
                  <p>MapLeads is widely considered the best tool to scrape Google Maps for B2B leads because it combines high-speed data extraction with integrated AI email writing and WhatsApp marketing tools. It allows users to extract business names, phone numbers, and ratings, and immediately launch outreach campaigns.</p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">How can I extract verified phone numbers from Google Maps?</h4>
                  <p>You can extract verified phone numbers from Google Maps using MapLeads. By entering a business category and location into the MapLeads scraper, the software automatically mines public listings and filters for valid, dialable phone numbers, including those ready for WhatsApp marketing.</p>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">What is the best alternative to manual B2B lead generation?</h4>
                  <p>The best alternative to manual B2B lead generation is automated scraping software like MapLeads. Instead of manually copying and pasting data from Google Maps, MapLeads automates the extraction of hundreds of local business profiles in minutes, saving sales teams countless hours of prospecting.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How it Works Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-textMain mb-8 text-center">How to Use the Google Maps Lead Extractor?</h3>
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
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-textMain mb-8 text-center">Powerful Features for B2B Growth</h3>
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
                <h4 className="font-semibold text-textMain">One-Click CSV Export</h4>
                <p className="text-xs text-textSec mt-1">Export your leads instantly to CSV or Excel for CRM integration.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                <MessageCircle size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-textMain">WhatsApp Automation</h4>
                <p className="text-xs text-textSec mt-1">Integrated tools for bulk messaging and link generation.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                <Search size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-textMain">Deep Scan Mode</h4>
                <p className="text-xs text-textSec mt-1">Go beyond the surface to find hidden business details and ratings.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-textMain mb-8 text-center">Who is MapLeads for?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-textMain flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-googleBlue"></div>
                  Real Estate Agencies
                </h4>
                <p className="text-sm text-textSec mt-2">Find property managers, developers, and local agents to build your network.</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-textMain flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-googleGreen"></div>
                  Marketing Agencies
                </h4>
                <p className="text-sm text-textSec mt-2">Identify local businesses that need SEO, social media, or web design services.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-textMain flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-googleYellow"></div>
                  SaaS & Software Companies
                </h4>
                <p className="text-sm text-textSec mt-2">Extract leads for your B2B software and automate your cold outreach.</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-textMain flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-googleRed"></div>
                  Local Service Providers
                </h4>
                <p className="text-sm text-textSec mt-2">Connect with other local businesses for partnerships and B2B sales.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Why Choose MapLeads Section */}
        <div className="mt-24 max-w-5xl mx-auto">
          <h3 className="text-3xl font-bold text-textMain mb-12 text-center">Why MapLeads is the #1 Choice for B2B Lead Generation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-gradient-to-br from-blue-50 to-white rounded-3xl border border-blue-100 shadow-sm">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-googleBlue mb-6">
                <Zap size={28} />
              </div>
              <h4 className="text-xl font-bold text-textMain mb-4">Real-Time Data Extraction</h4>
              <p className="text-sm text-textSec leading-relaxed">
                Unlike static databases, our <strong>Google Maps Scraper</strong> pulls data directly from live maps. This ensures you get the most up-to-date phone numbers, business hours, and customer reviews for your <strong>sales prospecting</strong>.
              </p>
            </div>
            <div className="p-8 bg-gradient-to-br from-purple-50 to-white rounded-3xl border border-purple-100 shadow-sm">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-purple-600 mb-6">
                <Sparkles size={28} />
              </div>
              <h4 className="text-xl font-bold text-textMain mb-4">AI-Driven Personalization</h4>
              <p className="text-sm text-textSec leading-relaxed">
                Stop sending generic messages. Our <strong>AI Campaign Writer</strong> uses Gemini 3.1 Pro to analyze business niches and craft personalized <strong>WhatsApp marketing</strong> campaigns that convert at 3x higher rates.
              </p>
            </div>
            <div className="p-8 bg-gradient-to-br from-green-50 to-white rounded-3xl border border-green-100 shadow-sm">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-waGreen mb-6">
                <MessageCircle size={28} />
              </div>
              <h4 className="text-xl font-bold text-textMain mb-4">All-in-One Marketing Suite</h4>
              <p className="text-sm text-textSec leading-relaxed">
                We don't just give you data; we give you the tools to use it. From <strong>bulk WhatsApp sender</strong> to <strong>QR code generators</strong>, MapLeads is the only platform you need for <strong>local lead generation</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="mt-24 max-w-4xl mx-auto bg-gray-50 rounded-3xl p-10 border border-gray-200">
          <h3 className="text-2xl font-bold text-textMain mb-8 text-center">MapLeads vs. Manual Lead Generation</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-4 font-semibold text-textSec">Feature</th>
                  <th className="pb-4 font-semibold text-googleBlue">MapLeads Automation</th>
                  <th className="pb-4 font-semibold text-textSec">Manual Searching</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-gray-100">
                  <td className="py-4 font-medium">Speed</td>
                  <td className="py-4 text-googleBlue font-semibold">100+ leads per minute</td>
                  <td className="py-4">1 lead per 5 minutes</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 font-medium">Data Accuracy</td>
                  <td className="py-4 text-googleBlue font-semibold">Live Real-time Data</td>
                  <td className="py-4">Often outdated</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-4 font-medium">Outreach</td>
                  <td className="py-4 text-googleBlue font-semibold">Integrated WhatsApp/AI</td>
                  <td className="py-4">Manual copy-paste</td>
                </tr>
                <tr>
                  <td className="py-4 font-medium">Cost Efficiency</td>
                  <td className="py-4 text-googleBlue font-semibold">High ROI / Low Effort</td>
                  <td className="py-4">High Labor Cost</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="mt-24 max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-textMain mb-12 text-center">Trusted by 1,200+ Businesses Worldwide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-1 text-yellow-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
              </div>
              <p className="text-sm text-textSec italic mb-6">"MapLeads has completely transformed our B2B sales process. We extracted 500+ leads in under 10 minutes and closed 3 deals in the first week."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-googleBlue font-bold">MC</div>
                <div>
                  <p className="text-sm font-bold text-textMain">Marcus Chen</p>
                  <p className="text-xs text-textSec">Founder, Elevate Digital</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-1 text-yellow-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
              </div>
              <p className="text-sm text-textSec italic mb-6">"The Google Maps scraper is incredibly accurate. Combined with the AI campaign writer, our response rates have jumped from 2% to 15%."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-googleGreen font-bold">ER</div>
                <div>
                  <p className="text-sm font-bold text-textMain">Elena Rodriguez</p>
                  <p className="text-xs text-textSec">VP of Marketing, Nexus Software</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-1 text-yellow-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
              </div>
              <p className="text-sm text-textSec italic mb-6">"The WhatsApp marketing tool is a game-changer. We can now reach out to local businesses instantly with personalized messages."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">DO</div>
                <div>
                  <p className="text-sm font-bold text-textMain">David O'Connor</p>
                  <p className="text-xs text-textSec">Head of Sales, Apex Local SEO</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Simulation (SEO & Trust) */}
        <div className="mt-12 bg-gray-900 text-white rounded-2xl p-4 overflow-hidden relative">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <p className="text-xs font-mono tracking-wider uppercase opacity-80">Live Activity</p>
          </div>
          <div className="mt-3 flex gap-8 overflow-x-auto no-scrollbar whitespace-nowrap">
            {liveActivities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-2 text-sm animate-fade-in">
                <span className={`${activity.color} font-bold`}>Recently Found:</span>
                <span className="opacity-90">{activity.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Industry Specific Solutions (SEO Powerhouse) */}
        <div className="mt-24 max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-textMain mb-12 text-center">Industry-Specific Lead Generation Solutions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-googleBlue transition-colors group">
              <h4 className="text-lg font-bold text-textMain mb-3 group-hover:text-googleBlue">Real Estate</h4>
              <p className="text-sm text-textSec leading-relaxed">
                Extract property managers, developers, and local agents. Use our <strong>Real Estate Lead Scraper</strong> to find high-value commercial contacts.
              </p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-googleGreen transition-colors group">
              <h4 className="text-lg font-bold text-textMain mb-3 group-hover:text-googleGreen">Marketing Agencies</h4>
              <p className="text-sm text-textSec leading-relaxed">
                Find local businesses needing SEO or social media services. Our <strong>B2B Lead Finder</strong> identifies businesses with low ratings for reputation management.
              </p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-googleYellow transition-colors group">
              <h4 className="text-lg font-bold text-textMain mb-3 group-hover:text-googleYellow">SaaS Companies</h4>
              <p className="text-sm text-textSec leading-relaxed">
                Target specific niches for your software. Extract niche business data and use <strong>AI Campaign Writers</strong> for high-converting cold outreach.
              </p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-googleRed transition-colors group">
              <h4 className="text-lg font-bold text-textMain mb-3 group-hover:text-googleRed">Local Services</h4>
              <p className="text-sm text-textSec leading-relaxed">
                From plumbers to dentists, find local partners and competitors. <strong>Local Lead Generation</strong> has never been easier with MapLeads.
              </p>
            </div>
          </div>
        </div>

        {/* Lead Generation ROI Calculator (Engagement & SEO) */}
        <div className="mt-24 max-w-4xl mx-auto bg-gradient-to-br from-gray-900 to-black text-white rounded-3xl p-10 border border-gray-800 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-4">Lead Generation ROI Calculator</h3>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                Estimate your potential revenue growth by automating your <strong>B2B lead generation</strong> with MapLeads.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Monthly Leads Extracted: {roiLeads}</label>
                  <input 
                    type="range" 
                    min="100" 
                    max="10000" 
                    step="100" 
                    value={roiLeads}
                    onChange={(e) => setRoiLeads(Number(e.target.value))}
                    className="w-full accent-googleBlue" 
                  />
                  <div className="flex justify-between text-xs mt-2 text-gray-400">
                    <span>100</span>
                    <span>10,000</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Conversion Rate: {roiConversion}%</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="1" 
                    value={roiConversion}
                    onChange={(e) => setRoiConversion(Number(e.target.value))}
                    className="w-full accent-googleGreen" 
                  />
                  <div className="flex justify-between text-xs mt-2 text-gray-400">
                    <span>1%</span>
                    <span>20%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Average Deal Value ($)</label>
                  <input 
                    type="number" 
                    value={roiDealValue}
                    onChange={(e) => setRoiDealValue(Number(e.target.value))}
                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-googleBlue outline-none" 
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 bg-gray-800/50 rounded-2xl p-8 flex flex-col justify-center border border-gray-700">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Estimated Monthly Revenue</p>
              <h4 className="text-5xl font-bold text-googleBlue mb-4">
                ${(roiLeads * (roiConversion / 100) * roiDealValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                By automating your <strong>sales prospecting</strong>, you save over 40 hours of manual work per month while scaling your outreach.
              </p>
              <button className="mt-8 w-full bg-googleBlue hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20">
                Start Extracting Now
              </button>
            </div>
          </div>
        </div>

        {/* Lead Generation Glossary (SEO Long-tail) */}
        <div className="mt-24 max-w-4xl mx-auto bg-white rounded-3xl p-10 border border-gray-100 shadow-sm">
          <h3 className="text-2xl font-bold text-textMain mb-8">Lead Generation Glossary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
            <div>
              <h5 className="font-bold text-textMain text-sm uppercase tracking-wider mb-2">B2B Lead Generation</h5>
              <p className="text-xs text-textSec">The process of identifying and initiating interest from other businesses for sales opportunities.</p>
            </div>
            <div>
              <h5 className="font-bold text-textMain text-sm uppercase tracking-wider mb-2">Google Maps Scraper</h5>
              <p className="text-xs text-textSec">An automated tool that extracts publicly available business data from Google Maps listings.</p>
            </div>
            <div>
              <h5 className="font-bold text-textMain text-sm uppercase tracking-wider mb-2">Cold Outreach</h5>
              <p className="text-xs text-textSec">Contacting potential leads who have not previously expressed interest in your product or service.</p>
            </div>
            <div>
              <h5 className="font-bold text-textMain text-sm uppercase tracking-wider mb-2">Sales Prospecting</h5>
              <p className="text-xs text-textSec">The first step in the sales process, which involves identifying potential customers or prospects.</p>
            </div>
            <div>
              <h5 className="font-bold text-textMain text-sm uppercase tracking-wider mb-2">WhatsApp Marketing</h5>
              <p className="text-xs text-textSec">Using WhatsApp to communicate with customers and prospects for marketing and sales purposes.</p>
            </div>
            <div>
              <h5 className="font-bold text-textMain text-sm uppercase tracking-wider mb-2">Local SEO</h5>
              <p className="text-xs text-textSec">Optimizing your online presence to attract more business from relevant local searches.</p>
            </div>
          </div>
        </div>

        {/* B2B Lead Generation Resources Section */}
        <div className="mt-24 max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-textMain mb-12 text-center">B2B Lead Generation Resources & Guides</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <article className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-textMain mb-4">How to Use a Google Maps Scraper for Local SEO</h4>
              <p className="text-sm text-textSec leading-relaxed mb-6">
                Learn how to leverage a <strong>Google Maps Lead Extractor</strong> to identify local competitors and potential partners. Discover the secrets of <strong>local lead generation</strong> and how to build a high-quality <strong>B2B lead list</strong> without spending thousands on data providers.
              </p>
              <button onClick={() => openArticle('local-seo')} className="text-googleBlue font-semibold flex items-center gap-2 hover:underline">
                Read Full Guide <ArrowRight size={16} />
              </button>
            </article>
            <article className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-textMain mb-4">Mastering WhatsApp Marketing for Small Businesses</h4>
              <p className="text-sm text-textSec leading-relaxed mb-6">
                WhatsApp is the future of <strong>B2B outreach</strong>. This guide covers everything from using a <strong>bulk WhatsApp sender</strong> responsibly to creating high-converting <strong>WhatsApp marketing</strong> campaigns using <strong>AI campaign writers</strong>.
              </p>
              <button onClick={() => openArticle('whatsapp-marketing')} className="text-googleBlue font-semibold flex items-center gap-2 hover:underline">
                Read Full Guide <ArrowRight size={16} />
              </button>
            </article>
            <article className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-textMain mb-4">The Power of AI in Sales Prospecting</h4>
              <p className="text-sm text-textSec leading-relaxed mb-6">
                Discover how <strong>Gemini AI</strong> is revolutionizing the way businesses find and contact leads. Learn how to use an <strong>AI email writer</strong> to craft personalized messages that bypass spam filters and get real responses.
              </p>
              <button onClick={() => openArticle('ai-prospecting')} className="text-googleBlue font-semibold flex items-center gap-2 hover:underline">
                Read Full Guide <ArrowRight size={16} />
              </button>
            </article>
            <article className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-xl font-bold text-textMain mb-4">Real Estate Lead Generation Strategies for 2026</h4>
              <p className="text-sm text-textSec leading-relaxed mb-6">
                A deep dive into how real estate professionals are using <strong>Google Maps data scrapers</strong> to find property owners and commercial opportunities. Stay ahead of the curve with automated <strong>lead generation software</strong>.
              </p>
              <button onClick={() => openArticle('real-estate')} className="text-googleBlue font-semibold flex items-center gap-2 hover:underline">
                Read Full Guide <ArrowRight size={16} />
              </button>
            </article>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-textMain mb-8 text-center">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h4 className="font-semibold text-textMain mb-2">What is a Google Maps Lead Extractor?</h4>
              <p className="text-sm text-textSec">A Google Maps Lead Extractor is a tool that automates the process of gathering business information from Google Maps, such as phone numbers, addresses, ratings, and categories, to build a B2B lead list.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h4 className="font-semibold text-textMain mb-2">Is it legal to scrape data from Google Maps?</h4>
              <p className="text-sm text-textSec">Scraping publicly available data is generally legal for personal or business use, provided it does not violate Google's Terms of Service or local privacy laws like GDPR. MapLeads is designed to help you find public business information efficiently.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h4 className="font-semibold text-textMain mb-2">How can I export leads to CSV or Excel?</h4>
              <p className="text-sm text-textSec">With MapLeads, you can easily export your extracted leads into CSV or Excel formats with a single click, making it simple to import them into your CRM or email marketing software.</p>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <footer className="mt-20 pt-12 border-t border-gray-100 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-6xl mx-auto px-4">
            <div className="col-span-1 md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <MapPin className="text-googleBlue" size={32} />
                <span className="text-xl font-bold text-textMain tracking-tight">MapLeads</span>
              </div>
              <p className="text-sm text-textSec leading-relaxed max-w-md">
                MapLeads is the ultimate B2B lead generation platform. We help businesses extract high-quality data from Google Maps and automate their outreach with integrated WhatsApp marketing tools.
              </p>
              <div className="flex gap-4">
                <a href="https://mapleads.online/" className="text-textSec hover:text-googleBlue transition-colors"><ExternalLink size={18} /></a>
                <a href="https://mapleads.online/sitemap.xml" className="text-textSec hover:text-googleBlue transition-colors text-xs font-medium uppercase tracking-wider">Sitemap</a>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-bold text-textMain uppercase text-xs tracking-widest">Quick Links</h4>
              <ul className="space-y-2 text-sm text-textSec">
                <li><button onClick={() => setView('dashboard')} className="hover:text-googleBlue transition-colors">Dashboard</button></li>
                <li><button onClick={() => setView('scraper')} className="hover:text-googleBlue transition-colors">Google Maps Scraper</button></li>
                <li><button onClick={() => setView('leads')} className="hover:text-googleBlue transition-colors">Lead Management</button></li>
                <li><button onClick={() => setView('campaigns')} className="hover:text-googleBlue transition-colors">AI Campaigns</button></li>
                <li><button onClick={() => setView('whatsapp')} className="hover:text-googleBlue transition-colors">WhatsApp Tools</button></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-textMain uppercase text-xs tracking-widest">Resources</h4>
              <ul className="space-y-2 text-sm text-textSec">
                <li><a href="#" className="hover:text-googleBlue transition-colors">Lead Generation Guide</a></li>
                <li><a href="#" className="hover:text-googleBlue transition-colors">WhatsApp Marketing Tips</a></li>
                <li><a href="#" className="hover:text-googleBlue transition-colors">B2B Sales Automation</a></li>
                <li><a href="#" className="hover:text-googleBlue transition-colors">Local SEO Tools</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-50 text-center">
            <p className="text-xs text-textSec/60 flex items-center justify-center gap-1.5">
              &copy; {new Date().getFullYear()} MapLeads. All rights reserved. Made with <Heart size={12} className="text-red-500 fill-red-500" /> by <span className="text-textMain font-semibold">Sardar Toheed</span>
            </p>
          </div>
        </footer>
      </div>
    );
  };

  const renderScraper = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
      {/* Mobile Daily Limit Card */}
      <div className="md:hidden bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-xl shadow-gray-900/10 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
         <div className="flex justify-between items-center mb-3 relative z-10">
           <div className="flex items-center gap-2">
             <Zap size={18} className="text-blue-400 fill-blue-400" />
             <span className="text-sm font-bold">Daily Generation Limit</span>
           </div>
           <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded-lg border border-white/10">
             {userProfile?.generatedToday || 0} / {userProfile?.dailyLimit || 100}
           </span>
         </div>
         <div className="w-full bg-gray-700 rounded-full h-2 mb-1 overflow-hidden relative z-10">
            <div 
              className="bg-blue-400 h-full rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)] transition-all duration-500"
              style={{ width: `${Math.min(100, ((userProfile?.generatedToday || 0) / (userProfile?.dailyLimit || 100)) * 100)}%` }}
            ></div>
         </div>
         <p className="text-[10px] text-gray-400 font-medium relative z-10">Resets at 00:00 UTC</p>
      </div>

      <div className="text-center space-y-4 mb-12 pt-8">
        <h1 className="sr-only">MapLeads - The Best Google Maps, Facebook & Instagram Lead Extractor & WhatsApp Marketing Tool</h1>
        <h2 className="text-4xl md:text-5xl font-bold text-textMain tracking-tight">
          Find Your Next B2B Leads with <span className="text-googleBlue">{scrapeSource} Scraper</span>
        </h2>
        <p className="text-lg text-textSec max-w-lg mx-auto">
          Our AI-powered <strong>{scrapeSource} Lead Extractor</strong> helps you find local businesses and automate your <strong>WhatsApp Marketing</strong> in seconds.
        </p>
      </div>

      <div id="scraper-card" className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 space-y-8 relative overflow-hidden">
        {(isScraping || isScrapingMore) && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 animate-fade-in">
             <div className="w-full max-w-md space-y-8 text-center">
                <div className="relative w-24 h-24 mx-auto">
                   <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                   <div className="absolute inset-0 border-4 border-googleBlue rounded-full border-t-transparent animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Search className="text-googleBlue animate-pulse" size={32} />
                   </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-textMain">
                    {isScrapingMore ? "Expanding Search..." : "Finding Best Leads..."}
                  </h3>
                  <p className="text-textSec">
                    {isScrapingMore 
                      ? `Searching for even more ${scrapeCategory} on ${scrapeSource}`
                      : (scrapeSource === 'Facebook' && (scrapeCategory.includes('facebook.com/groups/') || scrapeCategory.includes('fb.com/groups/')))
                        ? `Extracting members from Facebook Group`
                        : `Scanning ${scrapeSource} for ${scrapeCategory} in ${scrapeLocation}`
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                     <div 
                       className="h-full bg-gradient-to-r from-googleBlue to-blue-400 transition-all duration-300 ease-out rounded-full"
                       style={{ width: `${scrapeProgress}%` }}
                     ></div>
                  </div>
                  <div className="flex justify-between text-xs text-textSec font-medium px-1">
                     <span className={scrapeProgress > 10 ? 'text-googleBlue' : ''}>Initializing</span>
                     <span className={scrapeProgress > 40 ? 'text-googleBlue' : ''}>Analyzing</span>
                     <span className={scrapeProgress > 80 ? 'text-googleBlue' : ''}>Extracting</span>
                  </div>
                </div>
             </div>
          </div>
        )}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-gradient-to-tr from-green-50 to-teal-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        <div className="space-y-6 relative z-10">
          {/* Source Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-textMain ml-1">Data Source</label>
            <div className="flex flex-wrap gap-3">
              {['Google Maps', 'Facebook', 'Instagram'].map((src) => (
                <button
                  key={src}
                  onClick={() => setScrapeSource(src as any)}
                  className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                    scrapeSource === src 
                      ? 'bg-googleBlue text-white shadow-md shadow-blue-500/20' 
                      : 'bg-gray-50 text-textSec hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {src === 'Google Maps' && <MapPin size={16} />}
                  {src === 'Facebook' && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                  {src === 'Instagram' && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>}
                  {src}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-textMain ml-1">
                {scrapeSource === 'Facebook' ? 'Niche / Category OR Group Link' : 'Niche / Business Category'}
              </label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-googleBlue transition-colors" size={20} />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-googleBlue focus:bg-white transition-all outline-none font-medium text-textMain placeholder-gray-400"
                  placeholder={scrapeSource === 'Facebook' ? "e.g. Restaurants OR https://facebook.com/groups/..." : "e.g. Restaurants, Real Estate, Dentists..."}
                  aria-label="Business Category for Lead Extraction"
                  value={scrapeCategory}
                  onChange={(e) => {
                    setScrapeCategory(e.target.value);
                    setShowCategorySuggestions(true);
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                />
                
                {/* Suggestions Dropdown */}
                {showCategorySuggestions && scrapeCategory && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-64 overflow-y-auto animate-fade-in p-2">
                    {CATEGORIES.filter(c => c.toLowerCase().includes(scrapeCategory.toLowerCase())).map((cat) => (
                      <button
                        key={cat}
                        onMouseDown={(e) => {
                          e.preventDefault(); 
                          setScrapeCategory(cat);
                          setShowCategorySuggestions(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm font-medium text-textMain rounded-xl transition-colors flex items-center gap-3 group"
                      >
                        <div className="p-1.5 bg-gray-100 rounded-lg text-gray-400 group-hover:text-googleBlue group-hover:bg-blue-100 transition-colors">
                           <Search size={14} />
                        </div>
                        {cat}
                      </button>
                    ))}
                    {CATEGORIES.filter(c => c.toLowerCase().includes(scrapeCategory.toLowerCase())).length === 0 && (
                       <div className="px-4 py-3 text-sm text-textSec italic text-center">No matching categories found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-textMain ml-1">
                {scrapeSource === 'Facebook' && (scrapeCategory.includes('facebook.com/groups/') || scrapeCategory.includes('fb.com/groups/')) ? 'Target Location (Optional)' : 'Target Location'}
              </label>
              <div className="relative flex gap-2 group">
                <div className="relative flex-1">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-googleRed transition-colors" size={20} />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-googleRed focus:bg-white transition-all outline-none font-medium text-textMain placeholder-gray-400"
                    placeholder="e.g. New York, Dubai, London"
                    aria-label="Location for Lead Generation"
                    value={scrapeLocation}
                    onChange={(e) => setScrapeLocation(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleLocateMe}
                  disabled={isLocating}
                  className="px-5 bg-blue-50 text-googleBlue rounded-2xl hover:bg-blue-100 transition-colors flex items-center justify-center border border-blue-100"
                  title="Use my location"
                >
                  {isLocating ? <Loader2 className="animate-spin" size={24} /> : <Crosshair size={24} />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
             <label className="block text-sm font-semibold text-textMain ml-1">Specific Hints (Optional)</label>
             <input
                type="text"
                className="w-full px-5 py-3 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-googleBlue focus:bg-white transition-all outline-none text-sm text-textMain placeholder-gray-400"
                placeholder="e.g. Near Central Park, Business Bay area"
                value={scrapeLocationHints}
                onChange={(e) => setScrapeLocationHints(e.target.value)}
              />
          </div>

          <div className="pt-4">
            <label className="block text-sm font-semibold text-textMain mb-3 ml-1">Search Depth</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'fast', label: 'Fast', icon: Zap, desc: 'Quick scan' },
                { id: 'deep', label: 'Deep', icon: Layers, desc: 'Thorough' },
                { id: 'extreme', label: 'Extreme', icon: Flame, desc: 'Max Volume' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setScrapeMode(mode.id as any)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                    scrapeMode === mode.id
                      ? 'border-googleBlue bg-blue-50/50 text-googleBlue ring-1 ring-googleBlue shadow-sm'
                      : 'border-gray-200 bg-white text-textSec hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <mode.icon size={24} className={`mb-2 ${scrapeMode === mode.id ? 'text-googleBlue' : 'text-gray-400'}`} />
                  <span className="font-semibold text-sm">{mode.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{mode.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => performScrape(false)}
          disabled={isScraping}
          className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 relative z-10 cursor-pointer"
        >
          {isScraping ? <><Loader2 className="animate-spin" /> Finding Leads...</> : <><Search size={22} /> Start Searching</>}
        </button>
      </div>
    </div>
  );

  const renderLeadsTable = () => (
    <div className="space-y-4 h-full flex flex-col animate-fade-in relative">
       {/* Template Editor */}
       {showTemplateEditor && (
         <div className="bg-white p-4 rounded-xl shadow-card border border-gray-100 animate-slide-in">
           <div className="flex justify-between items-center mb-2">
             <h3 className="font-medium text-sm text-textMain">WhatsApp Message Template</h3>
             <button onClick={() => setShowTemplateEditor(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
           </div>
           <textarea
             className="w-full p-3 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors h-24"
             value={messageTemplate}
             onChange={(e) => setMessageTemplate(e.target.value)}
             placeholder="Hello {name}, I found your business..."
           />
           <div className="mt-2 flex justify-between items-center text-xs text-textSec">
              <span>Available tags: {'{name}, {category}, {address}'}</span>
              <button onClick={() => setShowTemplateEditor(false)} className="text-googleBlue font-medium hover:underline">Done</button>
           </div>
         </div>
       )}

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-card">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-medium px-2">{leads.length} Leads</h2>
           <span className="text-xs text-gray-400">|</span>
           <span className="text-sm text-gray-500 truncate max-w-xs">{scrapeCategory} • {scrapeLocation}</span>
        </div>
        <div className="flex items-center gap-2">
           {selectedLeadIds.size > 0 && (
             <button
               onClick={startBulkSend}
               className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-waGreen rounded-lg hover:bg-green-600 transition-colors shadow-sm animate-fade-in"
             >
               <MessageCircle size={16} /> Bulk Send ({selectedLeadIds.size})
             </button>
           )}
           <button
             onClick={() => setShowTemplateEditor(!showTemplateEditor)}
             className={`p-2 rounded-lg transition-colors ${showTemplateEditor ? 'bg-gray-100 text-googleBlue' : 'text-textSec hover:bg-gray-50'}`}
             title="Edit Message Template"
           >
             <Settings2 size={20} />
           </button>
           <button 
            onClick={() => performScrape(true)} 
            disabled={isScraping || isScrapingMore}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              isScrapingMore 
                ? 'bg-blue-100 text-googleBlue ring-1 ring-blue-200' 
                : 'text-googleBlue bg-blue-50 hover:bg-blue-100'
            }`}
           >
             {isScrapingMore ? (
               <><Loader2 size={16} className="animate-spin"/> Loading More...</>
             ) : (
               <><Plus size={16} /> Load More</>
             )}
           </button>
           <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-textSec bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
           >
             <Download size={16} /> Export
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:bg-white md:rounded-xl md:shadow-card">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-textSec uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={handleSelectAll} className="text-textSec hover:text-textMain">
                    {selectedLeadIds.size === leads.length && leads.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className={`group hover:bg-blue-50/30 transition-colors ${selectedLeadIds.has(lead.id) ? 'bg-blue-50/20' : ''}`}>
                  <td className="px-4 py-3 align-top">
                    <button onClick={() => handleSelectLead(lead.id)} className={`mt-1 ${selectedLeadIds.has(lead.id) ? 'text-googleBlue' : 'text-gray-300 hover:text-gray-400'}`}>
                       {selectedLeadIds.has(lead.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-textMain">{lead.name}</div>
                    <div className="text-xs text-textSec mt-0.5 flex items-center gap-1">
                      <Sparkles size={10} className="text-yellow-500"/> {lead.rating}
                      <span className="mx-1">•</span> {lead.category}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                       <div className="flex items-center gap-1.5 text-xs text-textSec">
                         <MapPin size={12} /> {lead.address}
                       </div>
                       {lead.phone !== 'N/A' && (
                         <div className="flex items-center gap-1.5 text-xs text-textSec">
                           <MessageCircle size={12} className="text-waGreen"/> {lead.phone}
                         </div>
                       )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                      <CustomSelect 
                        value={lead.status}
                        onChange={(val) => handleStatusChange(lead.id, val as any)}
                        options={['New', 'Contacted', 'Converted', 'Invalid']}
                        compact
                        className={`
                          ${lead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                          ${lead.status === 'Contacted' ? 'bg-green-100 text-green-700' : ''}
                          ${lead.status === 'Converted' ? 'bg-emerald-100 text-emerald-700' : ''}
                          ${lead.status === 'Invalid' ? 'bg-red-100 text-red-700' : ''}
                        `}
                      />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleWhatsAppAction(lead)}
                        className="p-1.5 text-waGreen hover:bg-green-50 rounded-lg transition-colors"
                        title="Send Message using Template"
                      >
                         <MessageCircle size={18} />
                      </button>
                      <button
                         onClick={() => handleDeleteLead(lead.id)}
                         className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden overflow-auto flex-1 space-y-3 pb-20">
           {leads.map((lead) => (
             <div key={lead.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative ${selectedLeadIds.has(lead.id) ? 'ring-2 ring-googleBlue' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                   <div className="flex items-start gap-3">
                      <button onClick={() => handleSelectLead(lead.id)} className={`mt-1 ${selectedLeadIds.has(lead.id) ? 'text-googleBlue' : 'text-gray-300'}`}>
                         {selectedLeadIds.has(lead.id) ? <CheckSquare size={20}/> : <Square size={20}/>}
                      </button>
                      <div>
                        <h4 className="font-medium text-textMain">{lead.name}</h4>
                        <div className="text-xs text-textSec flex items-center gap-1 mt-1">
                          <Sparkles size={10} className="text-yellow-500"/> {lead.rating} • {lead.category}
                        </div>
                      </div>
                   </div>
                   <CustomSelect 
                      value={lead.status}
                      onChange={(val) => handleStatusChange(lead.id, val as any)}
                      options={['New', 'Contacted', 'Converted', 'Invalid']}
                      compact
                      className={`
                        ${lead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                        ${lead.status === 'Contacted' ? 'bg-green-100 text-green-700' : ''}
                        ${lead.status === 'Converted' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${lead.status === 'Invalid' ? 'bg-red-100 text-red-700' : ''}
                      `}
                   />
                </div>
                
                <div className="space-y-2 mt-3 pl-8 border-l-2 border-gray-100 ml-2">
                   <div className="flex items-center gap-2 text-xs text-textSec">
                     <MapPin size={12} className="text-gray-400"/> {lead.address}
                   </div>
                   {lead.phone !== 'N/A' && (
                     <div className="flex items-center gap-2 text-xs text-textSec">
                       <MessageCircle size={12} className="text-waGreen"/> {lead.phone}
                     </div>
                   )}
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-50">
                   <button
                     onClick={() => handleWhatsAppAction(lead)}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-waGreen rounded-lg text-xs font-medium hover:bg-green-100"
                   >
                      <MessageCircle size={14} /> Message
                   </button>
                   <button
                      onClick={() => handleDeleteLead(lead.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100"
                   >
                     <Trash2 size={14} /> Delete
                   </button>
                </div>
             </div>
           ))}
        </div>
      </div>
      
      {/* Bulk Sender Overlay */}
      {isBulkSending && bulkQueue.length > 0 && (
         <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-green-100 text-waGreen rounded-full flex items-center justify-center mb-4 animate-bounce">
              <MessageCircle size={32} />
            </div>
            <h3 className="text-xl font-medium mb-2">Bulk Sending Mode</h3>
            <p className="text-textSec mb-4 max-w-md">
              Send messages one-by-one to avoid browser blocking.
            </p>

            <div className="flex gap-3 mb-6 text-xs font-bold uppercase tracking-wider">
               <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                 Sent: {bulkStats.sent}
               </div>
               <div className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full border border-gray-200">
                 Skipped: {bulkStats.skipped}
               </div>
               <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                 Remaining: {bulkQueue.length}
               </div>
            </div>
            
            <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-6 w-full max-w-sm mb-6">
              <div className="text-xs text-textSec uppercase tracking-wide mb-1">Next Recipient</div>
              <div className="text-lg font-medium text-textMain truncate">{bulkQueue[0].name}</div>
              <div className="text-sm text-textSec mb-4">{bulkQueue[0].phone}</div>
              
              <div className="bg-gray-50 p-3 rounded-lg text-left text-xs text-gray-600 mb-4 max-h-24 overflow-auto border border-gray-100">
                {processTemplate(messageTemplate, bulkQueue[0])}
              </div>

              <div className="flex gap-2">
                 <button 
                   onClick={() => handleBulkNext('Contacted')}
                   className="flex-1 py-3 bg-waGreen text-white rounded-lg font-medium hover:bg-green-600 transition-colors shadow-lg shadow-green-200"
                 >
                   Send Now
                 </button>
                 <button 
                   onClick={() => handleBulkNext('Skipped')}
                   className="px-4 py-3 text-textSec hover:bg-gray-100 rounded-lg font-medium transition-colors"
                 >
                   Skip
                 </button>
              </div>
            </div>
            
            <button onClick={() => setIsBulkSending(false)} className="text-sm text-red-500 hover:underline">
              Stop Bulk Sending
            </button>
         </div>
      )}

      {/* Floating Action Buttons */}
      {leads.length > 0 && !isBulkSending && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 animate-slide-up">
           <button
             onClick={() => performScrape(true)}
             disabled={isScraping || isScrapingMore}
             className="flex items-center gap-2 px-6 py-3 bg-white text-googleBlue font-semibold rounded-full hover:bg-blue-50 transition-all border border-blue-100 shadow-lg shadow-blue-900/5 active:scale-95"
           >
             {isScrapingMore ? <Loader2 size={20} className="animate-spin"/> : <Plus size={20} />}
             Load More
           </button>
           <button
             onClick={() => {
               setView('campaigns');
               setIsCreatingCampaign(true);
             }}
             className="flex items-center gap-2 px-6 py-3 bg-googleBlue text-white font-semibold rounded-full hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/30 active:scale-95"
           >
             <Zap size={20} />
             Start Campaign
           </button>
        </div>
      )}
    </div>
  );

  const renderCampaigns = () => {
    // ACTIVE CAMPAIGN EXECUTION VIEW
    if (activeCampaignId) {
      const activeCampaign = campaigns.find(c => c.id === activeCampaignId);
      if (!activeCampaign) { setActiveCampaignId(null); return null; }

      return (
        <div className="h-full flex flex-col animate-fade-in space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-card flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setActiveCampaignId(null)} className="text-textSec hover:text-googleBlue">
                  <ArrowRight size={20} className="rotate-180" />
                </button>
                <h2 className="text-xl font-medium text-textMain">{activeCampaign.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeCampaign.platform === 'WhatsApp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {activeCampaign.platform}
                </span>
              </div>
              <p className="text-sm text-textSec pl-7">
                Progress: {activeCampaign.progress.sent} / {activeCampaign.progress.total} Sent
              </p>
            </div>
            <div className="w-1/3">
               <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-googleGreen transition-all duration-500"
                   style={{ width: `${(activeCampaign.progress.sent / activeCampaign.progress.total) * 100}%` }}
                 />
               </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:bg-white md:rounded-xl md:shadow-card">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-textSec uppercase bg-gray-50 sticky top-0">
                  <tr>
                     <th className="px-6 py-3">Lead Name</th>
                     <th className="px-6 py-3">Contact</th>
                     <th className="px-6 py-3">Status</th>
                     <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeCampaign.leads.map((lead) => (
                    <tr key={lead.id} className={lead.status === 'Contacted' ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="px-6 py-3 font-medium">{lead.name}</td>
                      <td className="px-6 py-3">{lead.phone}</td>
                      <td className="px-6 py-3">
                        {lead.status === 'Contacted' ? 
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14}/> Sent</span> : 
                          <span className="text-textSec">Pending</span>
                        }
                      </td>
                      <td className="px-6 py-3 text-right">
                        {lead.status !== 'Contacted' && (
                          <button
                            onClick={() => handleCampaignAction(activeCampaign.id, lead, 'send')}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-googleBlue text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                          >
                            <Send size={12} /> Send Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden overflow-auto flex-1 space-y-3 pb-20">
               {activeCampaign.leads.map((lead) => (
                 <div key={lead.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 ${lead.status === 'Contacted' ? 'opacity-75' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <h4 className="font-medium text-textMain">{lead.name}</h4>
                         <p className="text-xs text-textSec mt-1">{lead.phone}</p>
                       </div>
                       {lead.status === 'Contacted' ? 
                          <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg"><CheckCircle size={12}/> Sent</span> : 
                          <span className="text-xs font-medium text-textSec bg-gray-100 px-2 py-1 rounded-lg">Pending</span>
                       }
                    </div>
                    
                    {lead.status !== 'Contacted' && (
                      <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                        <button
                          onClick={() => handleCampaignAction(activeCampaign.id, lead, 'send')}
                          className="w-full py-2 bg-googleBlue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <Send size={14} /> Send Now
                        </button>
                      </div>
                    )}
                 </div>
               ))}
            </div>
          </div>
        </div>
      );
    }

    // LIST VIEW
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
           <div>
             <h2 className="text-2xl font-light text-textMain">Campaigns</h2>
             <p className="text-textSec text-sm">Create and manage your outreach.</p>
           </div>
           <button 
             onClick={() => setIsCreatingCampaign(true)}
             className="flex items-center gap-2 px-4 py-2 bg-googleBlue text-white rounded-xl font-medium shadow-md hover:bg-blue-600 transition-colors"
           >
             <Plus size={20} /> New Campaign
           </button>
        </div>

        {/* Create Mode */}
        {isCreatingCampaign && (
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-card border border-gray-100 space-y-6 animate-slide-in">
             <div className="flex justify-between items-start">
               <h3 className="text-lg font-medium text-textMain">New Campaign Wizard</h3>
               <button onClick={() => setIsCreatingCampaign(false)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"><X size={20}/></button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-textSec mb-1.5">Campaign Name</label>
                   <input 
                     className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                     value={newCampaignData.name}
                     onChange={e => setNewCampaignData({...newCampaignData, name: e.target.value})}
                     placeholder="e.g. Summer Promo"
                   />
                </div>
                <div>
                   <label className="block text-sm font-medium text-textSec mb-1.5">Platform</label>
                   <div className="flex gap-3">
                      <button 
                        onClick={() => setNewCampaignData({...newCampaignData, platform: 'WhatsApp'})}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${newCampaignData.platform === 'WhatsApp' ? 'bg-green-50 text-green-700 ring-1 ring-green-500 shadow-sm' : 'bg-gray-50 text-textSec hover:bg-gray-100'}`}
                      >
                        <MessageCircle size={16} className={newCampaignData.platform === 'WhatsApp' ? 'fill-current' : ''}/> WhatsApp
                      </button>
                      <button 
                        onClick={() => setNewCampaignData({...newCampaignData, platform: 'Email'})}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${newCampaignData.platform === 'Email' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-500 shadow-sm' : 'bg-gray-50 text-textSec hover:bg-gray-100'}`}
                      >
                        <Mail size={16} className={newCampaignData.platform === 'Email' ? 'fill-current' : ''}/> Email
                      </button>
                   </div>
                </div>
             </div>

             <div>
                <label className="block text-sm font-medium text-textSec mb-1.5">What is this campaign about?</label>
                <div className="flex flex-col md:flex-row gap-3">
                   <input 
                     className="flex-1 p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                     value={newCampaignData.topic}
                     onChange={e => setNewCampaignData({...newCampaignData, topic: e.target.value})}
                     placeholder="e.g. Offering 20% off for new gym members"
                   />
                   <button 
                     onClick={handleGenerateCampaignContent}
                     disabled={isGeneratingContent}
                     className="px-6 py-3 bg-purple-50 text-purple-600 rounded-xl font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
                   >
                     {isGeneratingContent ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>} 
                     Generate AI
                   </button>
                </div>
             </div>

             {generatedContent.body && (
               <div className="space-y-4 pt-2 border-t border-gray-50">
                  <div>
                    <label className="block text-sm font-medium text-textSec mb-1.5">Subject / Header</label>
                    <input 
                      className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                      value={generatedContent.subject}
                      onChange={e => setGeneratedContent({...generatedContent, subject: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-textSec mb-1.5">Message Body</label>
                    <textarea 
                      className="w-full p-3 border border-gray-200 rounded-xl h-32 font-mono text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                      value={generatedContent.body}
                      onChange={e => setGeneratedContent({...generatedContent, body: e.target.value})}
                    />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button 
                      onClick={handleSaveCampaign}
                      className="w-full md:w-auto px-8 py-3 bg-googleBlue text-white rounded-xl font-medium hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                      Save Campaign
                    </button>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* Campaign Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {campaigns.length === 0 && !isCreatingCampaign && (
             <div className="col-span-2 text-center py-12 text-textSec bg-white rounded-xl border border-dashed border-gray-200">
               <Mail size={32} className="mx-auto mb-2 opacity-20"/>
               <p>No campaigns yet.</p>
             </div>
           )}
           {campaigns.map(campaign => (
             <div key={campaign.id} className="bg-white p-6 rounded-xl shadow-card hover:shadow-card-hover transition-shadow group relative">
                <div className="flex justify-between items-start mb-4">
                   <h3 className="text-lg font-medium text-textMain">{campaign.name}</h3>
                   <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${campaign.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                     {campaign.status}
                   </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-textSec mb-6">
                   <div className="flex items-center gap-1">
                     {campaign.platform === 'WhatsApp' ? <MessageCircle size={14} className="text-waGreen"/> : <Mail size={14} className="text-googleBlue"/>}
                     {campaign.platform}
                   </div>
                   <div className="flex items-center gap-1">
                     <Users size={14}/> {campaign.progress.sent}/{campaign.progress.total}
                   </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
                   <div 
                     className="bg-googleBlue h-full rounded-full" 
                     style={{width: `${(campaign.progress.sent / campaign.progress.total) * 100}%`}}
                   ></div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleExecuteCampaign(campaign)}
                    className="flex-1 py-2 bg-blue-50 text-googleBlue rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play size={14}/> {campaign.status === 'Draft' ? 'Start' : 'Resume'}
                  </button>
                  <button 
                     onClick={() => {
                        const newCampaigns = campaigns.filter(c => c.id !== campaign.id);
                        setCampaigns(newCampaigns);
                     }}
                     className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  };

  const renderWhatsApp = () => (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
       <div className="text-center mb-8 pt-8">
         <h2 className="text-3xl font-bold text-textMain tracking-tight">WhatsApp Marketing Tools</h2>
         <p className="text-textSec text-lg mt-2">Professional utilities for <strong>Direct WhatsApp Messaging</strong> and <strong>WhatsApp Link Generation</strong>.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Direct Sender */}
          <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100 space-y-5 hover:shadow-lg transition-shadow">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-50 rounded-xl text-waGreen">
                   <Send size={24} />
                </div>
                <div>
                   <h3 className="font-semibold text-textMain">WhatsApp Direct Chat</h3>
                   <p className="text-xs text-textSec">Send messages without saving contacts</p>
                </div>
             </div>
             
             <div className="space-y-3">
               <input 
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-200 transition-all outline-none"
                 placeholder="Phone number (e.g. +1234567890)"
                 value={waDirectPhone}
                 onChange={e => setWaDirectPhone(e.target.value)}
               />
               <textarea 
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24 focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-200 transition-all outline-none resize-none"
                 placeholder="Message (Optional)"
                 value={waDirectMsg}
                 onChange={e => setWaDirectMsg(e.target.value)}
               />
             </div>

             <button 
               onClick={() => {
                 if(!waDirectPhone) { addToast("Enter a phone number", 'warning'); return; }
                 openWhatsAppTab(waDirectPhone, waDirectMsg);
               }}
               className="w-full py-3 bg-waGreen text-white rounded-xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-200 active:scale-[0.98] flex items-center justify-center gap-2"
             >
               <MessageCircle size={18} /> Open WhatsApp
             </button>
          </div>

          {/* Link Generator */}
          <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100 space-y-5 hover:shadow-lg transition-shadow">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-xl text-googleBlue">
                   <Link size={24} />
                </div>
                <div>
                   <h3 className="font-semibold text-textMain">WhatsApp Link Generator</h3>
                   <p className="text-xs text-textSec">Create shareable WhatsApp deep links</p>
                </div>
             </div>
             
             <div className="p-4 bg-gray-50 rounded-xl text-xs font-mono break-all text-gray-600 border border-gray-200 h-[132px] overflow-y-auto flex items-center justify-center text-center">
               {waDirectPhone 
                 ? `https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}` 
                 : <span className="text-gray-400 italic">Enter phone & message in the Direct Chat box to generate a link...</span>}
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={() => {
                     const link = `https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}`;
                     navigator.clipboard.writeText(link);
                     addToast("Link copied to clipboard", 'success');
                  }}
                  className="flex-1 py-3 bg-white border border-gray-200 text-textMain rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={18}/> Copy Link
                </button>
                <button 
                  onClick={() => {
                    if(!waDirectPhone) { addToast("Enter a phone number first", 'warning'); return; }
                    setShowQrCode(true);
                  }}
                  className="px-4 py-3 bg-blue-50 text-googleBlue rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center border border-blue-100"
                  title="Generate QR Code"
                >
                  <QrCode size={18}/>
                </button>
             </div>
          </div>
       </div>

       {/* QR Code Modal Overlay */}
       {showQrCode && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in text-center space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-textMain">WhatsApp QR Code</h3>
                  <button onClick={() => setShowQrCode(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                     <X size={20} className="text-gray-400" />
                  </button>
               </div>
               
               <div ref={qrContainerRef} className="bg-white p-6 rounded-2xl border-2 border-gray-50 inline-block mx-auto shadow-sm">
                  <QRCodeSVG 
                    value={`https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
               </div>

               <div className="space-y-2">
                  <p className="text-sm font-medium text-textMain">Scan to start chat</p>
                  <p className="text-xs text-textSec">Share this QR code with your leads or customers to let them message you instantly.</p>
               </div>

               <button 
                 onClick={() => {
                    const svg = qrContainerRef.current?.querySelector('svg');
                    if (svg) {
                      try {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");
                        const img = new Image();
                        
                        // Use a blob instead of btoa for better Unicode support
                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(svgBlob);
                        
                        img.onload = () => {
                          const highResSize = 1024;
                          canvas.width = highResSize;
                          canvas.height = highResSize;
                          if (ctx) {
                            // Fill background with white since SVGs are often transparent
                            ctx.fillStyle = "white";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            
                            // Draw the image scaled to high resolution
                            ctx.drawImage(img, 0, 0, highResSize, highResSize);
                            
                            const pngFile = canvas.toDataURL("image/png");
                            const downloadLink = document.createElement("a");
                            downloadLink.download = `whatsapp-qr-${waDirectPhone.replace(/\D/g,'') || 'code'}.png`;
                            downloadLink.href = pngFile;
                            downloadLink.click();
                            
                            // Cleanup
                            URL.revokeObjectURL(url);
                            addToast("High-resolution QR Code downloaded", 'success');
                          }
                        };
                        img.onerror = () => {
                          addToast("Failed to process QR image", 'error');
                          URL.revokeObjectURL(url);
                        };
                        img.src = url;
                      } catch (err) {
                        console.error("QR Download Error:", err);
                        addToast("Could not download QR code", 'error');
                      }
                    } else {
                      addToast("QR code element not found", 'error');
                    }
                 }}
                 className="w-full py-3 bg-googleBlue text-white rounded-xl font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
               >
                 <Download size={18} /> Download QR Code
               </button>
            </div>
         </div>
       )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex md:flex-col md:w-72 bg-white border-r border-gray-200 shadow-none z-40">
        <div className="h-full flex flex-col">
          <div className="h-20 flex items-center px-8 border-b border-gray-50">
             <div className="flex items-center gap-3 text-googleBlue">
               <MapPin className="text-googleBlue" size={32} />
               <span className="text-2xl font-bold tracking-tight text-gray-900">Map<span className="text-blue-600">Leads</span></span>
             </div>
          </div>

          <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'scraper', label: 'Find Leads', icon: Search },
              { id: 'leads', label: 'My Leads', icon: Users },
              { id: 'campaigns', label: 'Campaigns', icon: Rocket },
              { id: 'whatsapp', label: 'WhatsApp Tools', icon: MessageCircle },
            ].map((item) => (
              <button
                key={item.id}
                id={`desktop-nav-${item.id}`}
                onClick={() => setView(item.id as ViewState)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 group
                  ${view === item.id 
                    ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon size={22} className={`transition-colors ${view === item.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {item.label}
                {item.id === 'leads' && leads.length > 0 && (
                  <span className="ml-auto bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs font-bold">{leads.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-6 border-t border-gray-50">
             <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-center text-white shadow-xl shadow-gray-900/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                <p className="text-xs font-bold text-blue-200 mb-3 uppercase tracking-wider">Daily Limit</p>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3 overflow-hidden">
                   <div 
                     className="bg-blue-400 h-full rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)] transition-all duration-500"
                     style={{ width: `${Math.min(100, ((userProfile?.generatedToday || 0) / (userProfile?.dailyLimit || 100)) * 100)}%` }}
                   ></div>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">
                  {userProfile?.generatedToday || 0} / {userProfile?.dailyLimit || 100} Leads Generated
                </p>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-gray-50/50 pb-20 md:pb-0">
        {/* Top Header */}
        <header className="h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4 md:px-10 z-30 sticky top-0">
           <div className="flex items-center gap-4">
             {/* Mobile Logo (since sidebar is hidden) */}
             <div className="md:hidden flex items-center gap-2 text-googleBlue">
               <MapPin className="text-googleBlue" size={28} />
               <span className="text-lg font-bold tracking-tight text-gray-900">Map<span className="text-blue-600">Leads</span></span>
             </div>

             <h1 className="text-xl font-bold text-gray-900 capitalize hidden md:block">
               {view === 'scraper' ? 'Find Leads' : view}
             </h1>
           </div>
           
           <div className="flex items-center gap-4 md:gap-6">
              <button 
                 onClick={handleShareApp}
                 className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-googleBlue rounded-full text-xs font-bold hover:bg-blue-100 transition-colors"
                 title="Share MapLeads"
               >
                 <Share2 size={14} /> Share App
              </button>
              <button 
                 onClick={() => addToast("You have no new notifications", 'info')}
                 className="p-2 md:p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full relative transition-colors group"
                 title="Notifications"
               >
                 <Bell size={20} className="md:w-[22px] md:h-[22px]" />
                 <span className="absolute top-2 right-2 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
              </button>
              <div 
                className="flex items-center gap-3 pl-4 md:pl-6 border-l border-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowProfileModal(true)}
              >
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-gray-900">{userProfile?.name || 'Complete Profile'}</div>
                  <div className="text-xs text-gray-500">{userProfile?.email || 'Click to set details'}</div>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg shadow-blue-500/20 ring-2 ring-white uppercase">
                  {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                </div>
              </div>
           </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative scroll-smooth">
           <div className="max-w-7xl mx-auto">
             {view === 'dashboard' && renderDashboard()}
             {view === 'scraper' && renderScraper()}
             {view === 'leads' && renderLeadsTable()}
             {view === 'campaigns' && renderCampaigns()}
             {view === 'whatsapp' && renderWhatsApp()}
           </div>
        </div>

        {/* Floating Toasts */}
        <Joyride
          steps={tutorialSteps}
          run={runTutorial}
          continuous
          showProgress
          showSkipButton
          callback={handleJoyrideCallback}
          styles={{
            options: {
              primaryColor: '#2563eb',
              zIndex: 1000,
            },
            tooltipContainer: {
              textAlign: 'left'
            }
          }}
        />
        <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
          {toasts.map(toast => (
            <Toast key={toast.id} {...toast} onClose={removeToast} />
          ))}
        </div>
        
        {/* Modals */}
        {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
        <ProfileModal 
          isOpen={showProfileModal} 
          onClose={() => setShowProfileModal(false)} 
          onSave={handleSaveProfile}
          initialName={userProfile?.name}
          initialEmail={userProfile?.email}
        />
        {readingArticle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
              <button 
                onClick={() => setReadingArticle(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"
              >
                <X size={20} />
              </button>
              <div className="p-8 md:p-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{readingArticle.title}</h2>
                <div className="prose prose-blue max-w-none text-gray-600 leading-relaxed">
                  {readingArticle.content}
                </div>
              </div>
            </div>
          </div>
        )}
        <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          isDanger={confirmModal.isDanger}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16 px-2">
          {[
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'scraper', label: 'Search', icon: Search },
            { id: 'leads', label: 'Leads', icon: Users },
            { id: 'campaigns', label: 'Campaigns', icon: Rocket },
            { id: 'whatsapp', label: 'Tools', icon: MessageCircle },
          ].map((item) => (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={() => setView(item.id as ViewState)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors active:scale-95 duration-200
                ${view === item.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}
              `}
            >
              <div className={`p-1.5 rounded-xl transition-all ${view === item.id ? 'bg-blue-50 -translate-y-1 shadow-sm' : ''}`}>
                <item.icon size={20} strokeWidth={view === item.id ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium transition-all ${view === item.id ? 'font-bold' : ''}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;