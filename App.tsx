import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  MapPin, 
  Users, 
  Mail, 
  MessageCircle, 
  Settings, 
  Menu, 
  X,
  Plus,
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
import { searchBusinesses, generateEmailContent, hasApiKey, validateWhatsAppNumber, lookupLocation } from './services/geminiService';
import { generateWhatsAppLink, openWhatsAppTab, isMobileDevice, shareContent, copyImageToClipboard } from './services/whatsappService';
import { Lead, Campaign, ViewState, SearchHistoryItem } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type SortKey = 'name' | 'rating' | 'status' | 'address';
type SortDirection = 'asc' | 'desc';

// Cache Constants
const CACHE_PREFIX = 'mapleads_cache_';

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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

  // Scraper State
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [scrapeLocationHints, setScrapeLocationHints] = useState('');
  const [scrapeMode, setScrapeMode] = useState<'fast' | 'deep' | 'extreme'>('fast');
  const [isScraping, setIsScraping] = useState(false);
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
    setScrapeError(null);

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

      if (gatheredLeads.length > 0) {
        if (!isLoadMore) {
           addToHistory(scrapeCategory, scrapeLocation, gatheredLeads);
           addToast(`Search Complete! Found ${gatheredLeads.length} total businesses.`, 'success');
           setView('leads');
        } else {
           addToast(`Added ${gatheredLeads.length} more leads`, 'success');
        }
      }

    } catch (error: any) {
      console.error(error);
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
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Leads" value={totalLeads} icon={Users} color="blue" />
          <StatsCard title="Contacted" value={contacted} icon={MessageCircle} color="orange" />
          <StatsCard title="Converted" value={converted} icon={CheckCircle} color="green" />
          <StatsCard title="Campaigns" value={campaigns.length} icon={Mail} color="purple" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-textMain">Recent Searches</h3>
              <History className="text-textSec" size={20} />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-textSec uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Query</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Results</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 rounded-r-lg text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searchHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-textSec">No search history yet.</td>
                    </tr>
                  ) : (
                    searchHistory.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-textMain">{item.category}</td>
                        <td className="px-4 py-3 text-textSec">{item.location}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.resultsCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-textSec">{new Date(item.timestamp).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => restoreSession(item)}
                            title="Restore Session"
                            className="text-googleBlue hover:bg-blue-50 p-1.5 rounded-full transition-colors"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-card p-6 flex flex-col items-center justify-center">
            <h3 className="text-lg font-medium text-textMain mb-4 w-full text-left">Lead Status</h3>
            <div className="h-64 w-full">
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
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScraper = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-light text-textMain">Find New Businesses</h2>
        <p className="text-textSec">Enter a category and location to start scraping Google Maps.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-card space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-blue-50 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-textSec mb-1">Business Category</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-googleBlue focus:border-transparent transition-all outline-none"
                placeholder="e.g. Gyms, Dentists, Real Estate Agents"
                value={scrapeCategory}
                onChange={(e) => setScrapeCategory(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-textSec mb-1">Location</label>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-googleBlue focus:border-transparent transition-all outline-none"
                  placeholder="e.g. New York, Downtown Dubai"
                  value={scrapeLocation}
                  onChange={(e) => setScrapeLocation(e.target.value)}
                />
              </div>
              <button 
                onClick={handleLocateMe}
                disabled={isLocating}
                className="px-4 py-2 bg-blue-50 text-googleBlue rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center"
              >
                {isLocating ? <Loader2 className="animate-spin" size={20} /> : <Crosshair size={20} />}
              </button>
            </div>
          </div>
          <div>
             <label className="block text-sm font-medium text-textSec mb-1">Specific Location Hints (Optional)</label>
             <input
                type="text"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-googleBlue focus:border-transparent transition-all outline-none text-sm"
                placeholder="e.g. Near Central Park, Business Bay area"
                value={scrapeLocationHints}
                onChange={(e) => setScrapeLocationHints(e.target.value)}
              />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { id: 'fast', label: 'Fast', icon: Zap, desc: 'Quick scan' },
              { id: 'deep', label: 'Deep', icon: Layers, desc: 'Thorough' },
              { id: 'extreme', label: 'Extreme', icon: Flame, desc: 'Max Volume' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setScrapeMode(mode.id as any)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                  scrapeMode === mode.id
                    ? 'border-googleBlue bg-blue-50 text-googleBlue'
                    : 'border-transparent bg-gray-50 text-textSec hover:bg-gray-100'
                }`}
              >
                <mode.icon size={24} className="mb-2" />
                <span className="font-medium text-sm">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => performScrape(false)}
          disabled={isScraping}
          className="w-full py-4 bg-googleBlue hover:bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {isScraping ? <><Loader2 className="animate-spin" /> Scraping...</> : <><Search size={20} /> Start Search</>}
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

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-card flex flex-col">
        <div className="overflow-auto flex-1">
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

          <div className="flex-1 bg-white rounded-xl shadow-card overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
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
          <div className="bg-white p-6 rounded-xl shadow-card border border-gray-100 space-y-6 animate-slide-in">
             <div className="flex justify-between items-start">
               <h3 className="text-lg font-medium">New Campaign Wizard</h3>
               <button onClick={() => setIsCreatingCampaign(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-textSec mb-1">Campaign Name</label>
                   <input 
                     className="w-full p-2 border rounded-lg bg-gray-50"
                     value={newCampaignData.name}
                     onChange={e => setNewCampaignData({...newCampaignData, name: e.target.value})}
                     placeholder="e.g. Summer Promo"
                   />
                </div>
                <div>
                   <label className="block text-sm font-medium text-textSec mb-1">Platform</label>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => setNewCampaignData({...newCampaignData, platform: 'WhatsApp'})}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${newCampaignData.platform === 'WhatsApp' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-50 text-textSec'}`}
                      >
                        WhatsApp
                      </button>
                      <button 
                        onClick={() => setNewCampaignData({...newCampaignData, platform: 'Email'})}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${newCampaignData.platform === 'Email' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-50 text-textSec'}`}
                      >
                        Email
                      </button>
                   </div>
                </div>
             </div>

             <div>
                <label className="block text-sm font-medium text-textSec mb-1">What is this campaign about?</label>
                <div className="flex gap-2">
                   <input 
                     className="flex-1 p-2 border rounded-lg bg-gray-50"
                     value={newCampaignData.topic}
                     onChange={e => setNewCampaignData({...newCampaignData, topic: e.target.value})}
                     placeholder="e.g. Offering 20% off for new gym members"
                   />
                   <button 
                     onClick={handleGenerateCampaignContent}
                     disabled={isGeneratingContent}
                     className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg font-medium hover:bg-purple-100 transition-colors flex items-center gap-2"
                   >
                     {isGeneratingContent ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 
                     Generate AI
                   </button>
                </div>
             </div>

             {generatedContent.body && (
               <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-textSec mb-1">Subject / Header</label>
                    <input 
                      className="w-full p-2 border rounded-lg"
                      value={generatedContent.subject}
                      onChange={e => setGeneratedContent({...generatedContent, subject: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-textSec mb-1">Message Body</label>
                    <textarea 
                      className="w-full p-2 border rounded-lg h-32 font-mono text-sm"
                      value={generatedContent.body}
                      onChange={e => setGeneratedContent({...generatedContent, body: e.target.value})}
                    />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button 
                      onClick={handleSaveCampaign}
                      className="px-6 py-2 bg-googleBlue text-white rounded-lg font-medium hover:bg-blue-600"
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
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
       <div className="text-center mb-8">
         <h2 className="text-2xl font-light text-textMain">WhatsApp Tools</h2>
         <p className="text-textSec text-sm">Utilities for quick messaging without saving contacts.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Direct Sender */}
          <div className="bg-white p-6 rounded-xl shadow-card space-y-4">
             <div className="flex items-center gap-2 mb-2 text-waGreen">
                <Send size={20} />
                <h3 className="font-medium text-textMain">Direct Chat</h3>
             </div>
             <p className="text-xs text-textSec">Open a chat instantly without saving the number to your phonebook.</p>
             
             <input 
               className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
               placeholder="Phone number (e.g. +1234567890)"
               value={waDirectPhone}
               onChange={e => setWaDirectPhone(e.target.value)}
             />
             <textarea 
               className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24"
               placeholder="Message (Optional)"
               value={waDirectMsg}
               onChange={e => setWaDirectMsg(e.target.value)}
             />
             <button 
               onClick={() => {
                 if(!waDirectPhone) { addToast("Enter a phone number", 'warning'); return; }
                 openWhatsAppTab(waDirectPhone, waDirectMsg);
               }}
               className="w-full py-2 bg-waGreen text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
             >
               Open WhatsApp
             </button>
          </div>

          {/* Link Generator */}
          <div className="bg-white p-6 rounded-xl shadow-card space-y-4">
             <div className="flex items-center gap-2 mb-2 text-googleBlue">
                <Link size={20} />
                <h3 className="font-medium text-textMain">Link Generator</h3>
             </div>
             <p className="text-xs text-textSec">Create a deep link to share on social media or email signatures.</p>
             
             <div className="p-4 bg-gray-50 rounded-xl text-xs font-mono break-all text-gray-600 border border-gray-200">
               {waDirectPhone 
                 ? `https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}` 
                 : 'Enter phone & message to generate link...'}
             </div>
             
             <button 
               onClick={() => {
                  const link = `https://wa.me/${waDirectPhone.replace(/\D/g,'')}${waDirectMsg ? `?text=${encodeURIComponent(waDirectMsg)}` : ''}`;
                  navigator.clipboard.writeText(link);
                  addToast("Link copied to clipboard", 'success');
               }}
               className="w-full py-2 bg-white border border-gray-200 text-textMain rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
             >
               <Copy size={16}/> Copy Link
             </button>
          </div>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
      `}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
             <div className="flex items-center gap-2 text-googleBlue">
               <MapPin className="fill-current" size={24} />
               <span className="text-xl font-bold tracking-tight text-gray-800">Map<span className="text-googleBlue">Leads</span></span>
             </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'scraper', label: 'Find Leads', icon: Search },
              { id: 'leads', label: 'My Leads', icon: Users },
              { id: 'campaigns', label: 'Campaigns', icon: Rocket },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setView(item.id as ViewState); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${view === item.id 
                    ? 'bg-blue-50 text-googleBlue shadow-sm' 
                    : 'text-textSec hover:bg-gray-50 hover:text-textMain'
                  }
                `}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
             <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-googleBlue mb-2">Pro Plan Active</p>
                <div className="w-full bg-white/50 rounded-full h-1.5 mb-2 overflow-hidden">
                   <div className="bg-googleBlue h-full w-3/4 rounded-full"></div>
                </div>
                <p className="text-[10px] text-textSec">750 / 1000 Credits Used</p>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-30">
           <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="md:hidden p-2 text-textSec hover:bg-gray-100 rounded-lg"
           >
             <Menu size={24} />
           </button>
           
           <div className="flex-1 md:flex-none"></div>

           <div className="flex items-center gap-4">
              <button className="p-2 text-textSec hover:bg-gray-100 rounded-full relative">
                 <Mail size={20} />
                 <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-googleRed rounded-full ring-2 ring-white"></span>
              </button>
              <div className="w-8 h-8 bg-googleBlue rounded-full flex items-center justify-center text-white font-medium text-sm">
                JD
              </div>
           </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative">
           {view === 'dashboard' && renderDashboard()}
           {view === 'scraper' && renderScraper()}
           {view === 'leads' && renderLeadsTable()}
           {view === 'campaigns' && renderCampaigns()}
           {view === 'whatsapp' && renderWhatsApp()}
        </div>

        {/* Floating Toasts */}
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
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default App;