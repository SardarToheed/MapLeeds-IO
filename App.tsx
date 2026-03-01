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
  Settings2
} from 'lucide-react';
import { StatsCard } from './components/StatsCard';
import { OnboardingModal } from './components/OnboardingModal';
import { Toast, ToastType } from './components/Toast';
import { ConfirmationModal } from './components/ConfirmationModal';
import { CustomSelect } from './components/CustomSelect';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { searchBusinesses, generateEmailContent, hasApiKey, validateWhatsAppNumber, lookupLocation } from './services/geminiService';
import { generateWhatsAppLink, openWhatsAppTab, isMobileDevice, shareContent, copyImageToClipboard } from './services/whatsappService';
import { Lead, Campaign, ViewState, SearchHistoryItem } from './types';
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
  const [isScraping, setIsScraping] = useState(false);
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

  // WhatsApp Tools State
  const [waDirectPhone, setWaDirectPhone] = useState('');
  const [waDirectMsg, setWaDirectMsg] = useState('');
  
  // WhatsApp Template & Bulk Sender State
  const [messageTemplate, setMessageTemplate] = useState("Hello {name}, I found your business on Google Maps and would like to inquire about your services.");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<Lead[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);

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


  // --- HELPERS ---

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
    if (!hasApiKey()) {
      addToast("API Key missing. Please configure environment.", 'error');
      return;
    }
    if (!scrapeCategory || !scrapeLocation) {
      addToast("Please enter both category and location.", 'warning');
      return;
    }

    setIsScraping(true);
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
        if (iterations > 1 && i > 0) {
          addToast(`Batch ${i + 1}/${iterations}: Digging deeper...`, 'info');
        }

        const newBatch = await searchBusinesses(
          scrapeCategory, 
          scrapeLocation, 
          scrapeMode, 
          scrapeLocationHints, 
          currentKnownNames
        );

        if (newBatch.length === 0) {
          if (i === 0) addToast("No businesses found.", 'info');
          break;
        }

        gatheredLeads = [...gatheredLeads, ...newBatch];
        currentKnownNames = [...currentKnownNames, ...newBatch.map(l => l.name)];

        if (!isLoadMore) {
           setLeads(prev => i === 0 ? newBatch : [...prev, ...newBatch]);
        } else {
           setLeads(prev => [...prev, ...newBatch]);
        }

        if (i < iterations - 1) await new Promise(r => setTimeout(r, 1500));
      }

      clearInterval(progressInterval);
      setScrapeProgress(100);

      if (gatheredLeads.length > 0) {
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
      setScrapeError("Failed to fetch leads. AI service might be busy.");
      addToast("Scraping failed. Please try again.", 'error');
    } finally {
      setIsScraping(false);
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
    setIsBulkSending(true);
  };
  
  const handleBulkSendNext = () => {
     if (bulkQueue.length === 0) {
       setIsBulkSending(false);
       addToast("Bulk sending completed!", 'success');
       return;
     }
     const [current, ...rest] = bulkQueue;
     handleWhatsAppAction(current);
     setBulkQueue(rest);
  };
  
  const handleBulkSkip = () => {
    if (bulkQueue.length === 0) return;
    const [_, ...rest] = bulkQueue;
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
        <div id="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Leads" value={totalLeads} icon={Users} color="blue" />
          <StatsCard title="Contacted" value={contacted} icon={MessageCircle} color="orange" />
          <StatsCard title="Converted" value={converted} icon={CheckCircle} color="green" />
          <StatsCard title="Campaigns" value={campaigns.length} icon={Mail} color="purple" />
        </div>

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

        <div className="mt-8 pb-8 text-center animate-fade-in">
          <p className="text-sm font-medium text-textSec/60 flex items-center justify-center gap-1.5">
            Made with <Heart size={14} className="text-red-500 fill-red-500 animate-pulse" /> by <span className="text-textMain font-semibold">Sardar Toheed</span>
          </p>
        </div>
      </div>
    );
  };

  const renderScraper = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
      <div className="text-center space-y-4 mb-12 pt-8">
        <h2 className="text-4xl md:text-5xl font-bold text-textMain tracking-tight">Find Your Next Customer</h2>
        <p className="text-lg text-textSec max-w-lg mx-auto">AI-powered lead generation from Google Maps. Enter a niche and location to get started.</p>
      </div>

      <div id="scraper-card" className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 space-y-8 relative overflow-hidden">
        {isScraping && (
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
                  <h3 className="text-2xl font-bold text-textMain">Finding Best Leads...</h3>
                  <p className="text-textSec">Scanning Google Maps for <span className="font-medium text-googleBlue">{scrapeCategory}</span> in <span className="font-medium text-textMain">{scrapeLocation}</span></p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-textMain ml-1">Business Category</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-googleBlue transition-colors" size={20} />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-googleBlue focus:bg-white transition-all outline-none font-medium text-textMain placeholder-gray-400"
                  placeholder="e.g. Gyms, Dentists..."
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
              <label className="block text-sm font-semibold text-textMain ml-1">Location</label>
              <div className="relative flex gap-2 group">
                <div className="relative flex-1">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-googleRed transition-colors" size={20} />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-googleRed focus:bg-white transition-all outline-none font-medium text-textMain placeholder-gray-400"
                    placeholder="e.g. New York, Dubai"
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
            disabled={isScraping}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-googleBlue bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
           >
             {isScraping ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />} More
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
                     <select 
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as any)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-none outline-none cursor-pointer
                        ${lead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}
                        ${lead.status === 'Contacted' ? 'bg-green-100 text-green-700' : ''}
                      `}
                     >
                       <option value="New">New</option>
                       <option value="Contacted">Contacted</option>
                       <option value="Converted">Converted</option>
                       <option value="Invalid">Invalid</option>
                     </select>
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
                   <select 
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as any)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border-none outline-none
                        ${lead.status === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                        ${lead.status === 'Contacted' ? 'bg-green-100 text-green-700' : ''}
                      `}
                   >
                     <option value="New">New</option>
                     <option value="Contacted">Contacted</option>
                     <option value="Converted">Converted</option>
                     <option value="Invalid">Invalid</option>
                   </select>
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
            <p className="text-textSec mb-6 max-w-md">
              Send messages one-by-one to avoid browser blocking.
            </p>
            
            <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-6 w-full max-w-sm mb-6">
              <div className="text-xs text-textSec uppercase tracking-wide mb-1">Next Recipient</div>
              <div className="text-lg font-medium text-textMain truncate">{bulkQueue[0].name}</div>
              <div className="text-sm text-textSec mb-4">{bulkQueue[0].phone}</div>
              
              <div className="bg-gray-50 p-3 rounded-lg text-left text-xs text-gray-600 mb-4 max-h-24 overflow-auto border border-gray-100">
                {processTemplate(messageTemplate, bulkQueue[0])}
              </div>

              <div className="flex gap-2">
                 <button 
                   onClick={handleBulkSendNext}
                   className="flex-1 py-3 bg-waGreen text-white rounded-lg font-medium hover:bg-green-600 transition-colors shadow-lg shadow-green-200"
                 >
                   Send Now
                 </button>
                 <button 
                   onClick={handleBulkSkip}
                   className="px-4 py-3 text-textSec hover:bg-gray-100 rounded-lg font-medium transition-colors"
                 >
                   Skip
                 </button>
              </div>
            </div>
            
            <div className="text-sm text-textSec mb-4">
               {bulkQueue.length} leads remaining in queue
            </div>
            
            <button onClick={() => setIsBulkSending(false)} className="text-sm text-red-500 hover:underline">
              Stop Bulk Sending
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
         <h2 className="text-3xl font-bold text-textMain tracking-tight">WhatsApp Tools</h2>
         <p className="text-textSec text-lg mt-2">Utilities for quick messaging without saving contacts.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Direct Sender */}
          <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100 space-y-5 hover:shadow-lg transition-shadow">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-50 rounded-xl text-waGreen">
                   <Send size={24} />
                </div>
                <div>
                   <h3 className="font-semibold text-textMain">Direct Chat</h3>
                   <p className="text-xs text-textSec">Open chat without saving</p>
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
                   <h3 className="font-semibold text-textMain">Link Generator</h3>
                   <p className="text-xs text-textSec">Create shareable deep links</p>
                </div>
             </div>
             
             <div className="p-4 bg-gray-50 rounded-xl text-xs font-mono break-all text-gray-600 border border-gray-200 h-[132px] overflow-y-auto flex items-center justify-center text-center">
               {waDirectPhone 
                 ? `https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}` 
                 : <span className="text-gray-400 italic">Enter phone & message in the Direct Chat box to generate a link...</span>}
             </div>
             
             <button 
               onClick={() => {
                  const link = `https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}`;
                  navigator.clipboard.writeText(link);
                  addToast("Link copied to clipboard", 'success');
               }}
               className="w-full py-3 bg-white border border-gray-200 text-textMain rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
             >
               <Copy size={18}/> Copy Link
             </button>
          </div>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex md:flex-col md:w-72 bg-white border-r border-gray-200 shadow-none z-40">
        <div className="h-full flex flex-col">
          <div className="h-20 flex items-center px-8 border-b border-gray-50">
             <div className="flex items-center gap-3 text-googleBlue">
               <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                 <MapPin className="fill-current" size={24} />
               </div>
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
                <p className="text-xs font-bold text-blue-200 mb-3 uppercase tracking-wider">Pro Plan Active</p>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3 overflow-hidden">
                   <div className="bg-blue-400 h-full w-3/4 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">750 / 1000 Credits Used</p>
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
               <div className="p-1.5 bg-blue-600 rounded-lg text-white shadow-md shadow-blue-500/30">
                 <MapPin className="fill-current" size={18} />
               </div>
               <span className="text-lg font-bold tracking-tight text-gray-900">Map<span className="text-blue-600">Leads</span></span>
             </div>

             <h1 className="text-xl font-bold text-gray-900 capitalize hidden md:block">
               {view === 'scraper' ? 'Find Leads' : view}
             </h1>
           </div>
           
           <div className="flex items-center gap-4 md:gap-6">
              <button 
                 onClick={() => addToast("You have no new notifications", 'info')}
                 className="p-2 md:p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full relative transition-colors group"
                 title="Notifications"
               >
                 <Bell size={20} className="md:w-[22px] md:h-[22px]" />
                 <span className="absolute top-2 right-2 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
              </button>
              <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-gray-100">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-gray-900">John Doe</div>
                  <div className="text-xs text-gray-500">Premium User</div>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg shadow-blue-500/20 ring-2 ring-white">
                  JD
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