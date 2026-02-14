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
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ExternalLink,
  Play,
  StopCircle,
  SkipForward,
  Check,
  Paperclip,
  Image as ImageIcon,
  XCircle,
  Copy,
  XSquare,
  Share2,
  History,
  Clock,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  Map,
  Locate,
  Crosshair
} from 'lucide-react';
import { StatsCard } from './components/StatsCard';
import { OnboardingModal } from './components/OnboardingModal';
import { searchBusinesses, generateEmailContent, hasApiKey, validateWhatsAppNumber, lookupLocation, reverseGeocode } from './services/geminiService';
import { generateWhatsAppLink, openWhatsAppTab, isMobileDevice, copyImageToClipboard, canNativeShare, shareContent } from './services/whatsappService';
import { Lead, Campaign, ViewState, SearchHistoryItem } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type SortKey = 'name' | 'rating' | 'status' | 'address';
type SortDirection = 'asc' | 'desc';

// Cache Constants
const CACHE_PREFIX = 'mapleads_cache_';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days in Milliseconds

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCacheExpiryModal, setShowCacheExpiryModal] = useState(false);
  
  // Scraper State
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [scrapeLocationHints, setScrapeLocationHints] = useState('');
  const [scrapeMode, setScrapeMode] = useState<'fast' | 'deep' | 'extreme'>('fast');
  const [isScraping, setIsScraping] = useState(false);
  const [isLocating, setIsLocating] = useState(false); // State for geolocation/lookup
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  
  // New States for History and Load More
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [sessionStats, setSessionStats] = useState({ totalGenerated: 0, totalContacted: 0 });
  const [lastScrapeParams, setLastScrapeParams] = useState<{category: string, location: string, locationHints: string} | null>(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{key: SortKey, direction: SortDirection}>({ key: 'name', direction: 'asc' });

  // Campaign State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [emailTopic, setEmailTopic] = useState('');
  const [emailTone, setEmailTone] = useState('Professional');
  const [generatedEmail, setGeneratedEmail] = useState<{subject: string, body: string} | null>(null);

  // WhatsApp State
  const [waMessage, setWaMessage] = useState('');
  const [waImage, setWaImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bulk Session State
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<Lead[]>([]);
  const [currentBulkIndex, setCurrentBulkIndex] = useState(0);

  // Persistence State
  const [isHydrated, setIsHydrated] = useState(false);

  // Stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'New').length;
  const contactedLeads = leads.filter(l => l.status === 'Contacted').length;
  const whatsappReady = leads.filter(l => validateWhatsAppNumber(l.phone)).length;

  // --- EFFECTS ---

  // 1. Hydration & Cache Expiry Check (Runs Once on Mount)
  useEffect(() => {
    const initializeData = () => {
      try {
        console.log("Initializing data...");
        // 1. Always load stored data first (Optimistic Hydration)
        const storedLeads = localStorage.getItem(`${CACHE_PREFIX}leads`);
        if (storedLeads) setLeads(JSON.parse(storedLeads));

        const storedStats = localStorage.getItem(`${CACHE_PREFIX}stats`);
        if (storedStats) setSessionStats(JSON.parse(storedStats));

        const storedHistory = localStorage.getItem(`${CACHE_PREFIX}history`);
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory).map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp) // Rehydrate Date object
          }));
          setSearchHistory(parsedHistory);
        }

        const storedCampaigns = localStorage.getItem(`${CACHE_PREFIX}campaigns`);
        if (storedCampaigns) {
          const parsedCampaigns = JSON.parse(storedCampaigns).map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt) // Rehydrate Date object
          }));
          setCampaigns(parsedCampaigns);
        }

        // 2. Check Onboarding
        const hasSeenOnboarding = localStorage.getItem('mapleads_onboarding_seen');
        if (!hasSeenOnboarding) setShowOnboarding(true);

        // 3. Check Cache Expiry
        const cacheStartStr = localStorage.getItem(`${CACHE_PREFIX}timestamp`);
        const now = Date.now();
        const cacheStart = cacheStartStr ? parseInt(cacheStartStr, 10) : null;

        if (!cacheStart) {
          // First run or cleaned - set timestamp
          localStorage.setItem(`${CACHE_PREFIX}timestamp`, now.toString());
        } else if (now - cacheStart > CACHE_DURATION_MS) {
          // Expired
          const hasData = storedLeads || storedHistory || storedCampaigns;
          
          if (hasData) {
            // Ask user what to do
            setShowCacheExpiryModal(true);
          } else {
            // No data to save, just reset timestamp
            localStorage.setItem(`${CACHE_PREFIX}timestamp`, now.toString());
          }
        }

      } catch (e) {
        console.error("Failed to hydrate cache:", e);
        // Fallback to fresh start if corruption occurs
        localStorage.setItem(`${CACHE_PREFIX}timestamp`, Date.now().toString());
      } finally {
        setIsHydrated(true);
      }
    };

    initializeData();
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('mapleads_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const handleKeepData = () => {
    localStorage.setItem(`${CACHE_PREFIX}timestamp`, Date.now().toString());
    setShowCacheExpiryModal(false);
  };

  const handleClearData = () => {
    // Clear State
    setLeads([]);
    setSearchHistory([]);
    setCampaigns([]);
    setSessionStats({ totalGenerated: 0, totalContacted: 0 });
    setLastScrapeParams(null);
    
    // Clear Storage explicitly (Persistence effects will sync empty state, but good to be sure)
    localStorage.removeItem(`${CACHE_PREFIX}leads`);
    localStorage.removeItem(`${CACHE_PREFIX}history`);
    localStorage.removeItem(`${CACHE_PREFIX}campaigns`);
    localStorage.removeItem(`${CACHE_PREFIX}stats`);
    
    // Reset Timestamp
    localStorage.setItem(`${CACHE_PREFIX}timestamp`, Date.now().toString());
    
    setShowCacheExpiryModal(false);
  };

  // 2. Persistence Effects (Run when data changes, only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(`${CACHE_PREFIX}leads`, JSON.stringify(leads));
    }
  }, [leads, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(`${CACHE_PREFIX}history`, JSON.stringify(searchHistory));
    }
  }, [searchHistory, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(`${CACHE_PREFIX}campaigns`, JSON.stringify(campaigns));
    }
  }, [campaigns, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(`${CACHE_PREFIX}stats`, JSON.stringify(sessionStats));
    }
  }, [sessionStats, isHydrated]);


  // --- ACTIONS ---

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        // Use Gemini to reverse geocode
        if (!hasApiKey()) {
          setScrapeLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } else {
          const address = await reverseGeocode(latitude, longitude);
          setScrapeLocation(address);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to retrieve location details.");
      } finally {
        setIsLocating(false);
      }
    }, (error) => {
      console.error(error);
      alert("Unable to retrieve your location. Please check browser permissions.");
      setIsLocating(false);
    });
  };

  const handleLookupLocation = async () => {
    if (!scrapeLocation.trim()) return;
    if (!hasApiKey()) {
      alert("API Key required for location lookup.");
      return;
    }
    
    setIsLocating(true);
    try {
      const refined = await lookupLocation(scrapeLocation);
      setScrapeLocation(refined);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLocating(false);
    }
  };

  const performScrape = async (append: boolean) => {
    if (!hasApiKey()) {
      setScrapeError("API Key missing. Please configure process.env.API_KEY.");
      return;
    }
    
    setIsScraping(true);
    setScrapeError(null);
    try {
      // If we are appending (loading more), find names of existing businesses with same category/location
      // to exclude them from results.
      let excludedNames: string[] = [];
      if (append) {
        excludedNames = leads
          .filter(l => l.category.toLowerCase().includes(scrapeCategory.toLowerCase()) || l.address.toLowerCase().includes(scrapeLocation.toLowerCase()))
          .map(l => l.name);
      }

      const results = await searchBusinesses(scrapeCategory, scrapeLocation, scrapeMode, scrapeLocationHints, excludedNames);
      
      // Filter out client-side duplicates just in case
      const existingIds = new Set(leads.map(l => l.name.toLowerCase() + l.address.toLowerCase()));
      const uniqueResults = results.filter(r => !existingIds.has(r.name.toLowerCase() + r.address.toLowerCase()));

      setLeads(prev => [...uniqueResults, ...prev]); 
      
      // Update Stats
      setSessionStats(prev => ({
        ...prev,
        totalGenerated: prev.totalGenerated + uniqueResults.length
      }));

      // Update History
      const historyItem: SearchHistoryItem = {
        id: Date.now().toString(),
        category: scrapeCategory,
        location: scrapeLocation,
        resultsCount: uniqueResults.length,
        timestamp: new Date()
      };
      setSearchHistory(prev => [historyItem, ...prev]);
      setLastScrapeParams({ category: scrapeCategory, location: scrapeLocation, locationHints: scrapeLocationHints });

      if (uniqueResults.length === 0) {
        setScrapeError("No new unique results found.");
      } else {
        if (!append) setView('leads'); // Redirect to leads view on fresh search
      }
    } catch (err: any) {
      setScrapeError("Failed to scrape. Please try again later. " + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  const handleScrape = (e: React.FormEvent) => {
    e.preventDefault();
    performScrape(false);
  };

  const handleLoadMore = (e: React.FormEvent) => {
    e.preventDefault();
    performScrape(true);
  };

  const handleGenerateEmail = async () => {
    if (!hasApiKey()) return;
    setIsGeneratingEmail(true);
    try {
      const content = await generateEmailContent(emailTopic, emailTone);
      setGeneratedEmail(content);
    } catch (err) {
      console.error(err);
      alert("Failed to generate email content");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleCopyToWhatsApp = () => {
    if (!generatedEmail) return;
    
    // Strip HTML for WhatsApp
    const bodyText = generatedEmail.body
      .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newlines
      .replace(/<\/p>/gi, '\n\n')    // Replace </p> with double newlines
      .replace(/<[^>]+>/g, '')       // Remove remaining tags
      .trim();
      
    const fullMessage = `${generatedEmail.subject}\n\n${bodyText}`;
    
    setWaMessage(fullMessage);
    setView('whatsapp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveCampaign = () => {
    if (!generatedEmail) return;
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: `Campaign: ${emailTopic.substring(0, 20)}...`,
      subject: generatedEmail.subject,
      content: generatedEmail.body,
      status: 'Draft',
      sentCount: 0,
      openRate: 0,
      createdAt: new Date()
    };
    setCampaigns([newCampaign, ...campaigns]);
    setGeneratedEmail(null);
    setEmailTopic('');
    alert("Campaign saved to drafts!");
  };

  // --- WHATSAPP ACTIONS ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file.");
        return;
      }
      setWaImage(file);
    }
  };

  const performSend = async (phone: string, text: string, file: File | null) => {
    // 1. Priority: Native Share (Mobile)
    if (file && canNativeShare(file)) {
      const shared = await shareContent(file, text);
      if (shared) return; 
    }

     // 2. Fallback
     let imageCopied = false;
     if (file) {
       imageCopied = await copyImageToClipboard(file);
     }

     openWhatsAppTab(phone, text);

     if (file && !imageCopied) {
       alert("Could not auto-copy image. Please attach manually in WhatsApp.");
     }
  };

  const handleSendSingleWhatsApp = async (lead: Lead) => {
    if (!waMessage.trim()) {
      alert("Please enter a message first.");
      return;
    }
    
    await performSend(lead.phone, waMessage, waImage);
    
    // Optimistically mark as contacted & update stats
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'Contacted' } : l));
    if (lead.status !== 'Contacted') {
       setSessionStats(prev => ({...prev, totalContacted: prev.totalContacted + 1}));
    }
  };

  const startBulkSession = () => {
    const validLeads = leads.filter(l => validateWhatsAppNumber(l.phone));
    if (validLeads.length === 0) {
      alert("No valid WhatsApp numbers found.");
      return;
    }
    if (!waMessage.trim()) {
      alert("Please enter a message first.");
      return;
    }

    setBulkQueue(validLeads);
    setCurrentBulkIndex(0);
    setIsBulkSending(true);
  };

  const handleBulkNext = (status: Lead['status'] | 'Skip') => {
    const currentLead = bulkQueue[currentBulkIndex];
    
    if (status !== 'Skip') {
      // Only increment contact stats if it wasn't already contacted and we are marking it as contacted
      if (status === 'Contacted' && currentLead.status !== 'Contacted') {
         setSessionStats(prev => ({...prev, totalContacted: prev.totalContacted + 1}));
      }
      setLeads(prev => prev.map(l => l.id === currentLead.id ? { ...l, status: status } : l));
    }
    
    if (currentBulkIndex < bulkQueue.length - 1) {
      setCurrentBulkIndex(currentBulkIndex + 1);
    } else {
      alert("Session Complete!");
      setIsBulkSending(false);
      setBulkQueue([]);
      setCurrentBulkIndex(0);
    }
  };

  const handleBulkOpenWhatsApp = async () => {
    const currentLead = bulkQueue[currentBulkIndex];
    await performSend(currentLead.phone, waMessage, waImage);
  };

  const exportWhatsAppList = () => {
    const validLeads = leads.filter(l => validateWhatsAppNumber(l.phone));
    if (validLeads.length === 0) {
      alert("No valid WhatsApp numbers found.");
      return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Phone,Status\n"
      + validLeads.map(l => `${l.name},${l.phone},${l.status}`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "whatsapp_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- BULK ACTIONS ---

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === leads.length && leads.length > 0) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelectLead = (id: string) => {
    const newSet = new Set(selectedLeadIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLeadIds(newSet);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedLeadIds.size} leads?`)) {
      setLeads(prev => prev.filter(l => !selectedLeadIds.has(l.id)));
      setSelectedLeadIds(new Set());
    }
  };

  const handleBulkStatusChange = (status: Lead['status']) => {
    // Determine how many *new* contacts are being marked as Contacted
    if (status === 'Contacted') {
       const previouslyNotContacted = leads.filter(l => selectedLeadIds.has(l.id) && l.status !== 'Contacted').length;
       setSessionStats(prev => ({...prev, totalContacted: prev.totalContacted + previouslyNotContacted}));
    }

    setLeads(prev => prev.map(l => selectedLeadIds.has(l.id) ? { ...l, status } : l));
    setSelectedLeadIds(new Set());
  };

  const handleBulkExport = () => {
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    if (selectedLeads.length === 0) return;

    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Category,Phone,Email,Address,Status,Rating\n"
      + selectedLeads.map(l => `"${l.name}","${l.category}","${l.phone}","${l.email}","${l.address}","${l.status}","${l.rating}"`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "selected_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- SORTING ---
  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedLeads = [...leads].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-primary" />
      : <ArrowDown size={14} className="ml-1 text-primary" />;
  };


  // --- COMPONENT RENDERERS ---

  const renderDashboard = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Leads (Session)" value={sessionStats.totalGenerated} icon={Users} color="blue" />
        <StatsCard title="New Leads" value={newLeads} icon={MapPin} color="purple" />
        <StatsCard title="Contacted (Session)" value={sessionStats.totalContacted} icon={Mail} color="orange" />
        <StatsCard title="WhatsApp Ready" value={whatsappReady} icon={MessageCircle} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-[24px] p-6 shadow-elevation-1 border border-outline/10">
            <h3 className="text-lg font-normal text-[#1C1B1F] mb-4">Lead Acquisition Source</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Extreme', value: leads.filter(l => l.source === 'Extreme Scrape').length },
                  { name: 'Deep', value: leads.filter(l => l.source === 'Deep Scrape').length },
                  { name: 'Fast', value: leads.filter(l => l.source === 'Fast Scrape').length },
                  { name: 'Manual', value: leads.filter(l => !l.source.includes('Scrape')).length },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E0E0" />
                  <XAxis dataKey="name" tick={{fill: '#666', fontSize: 12}} />
                  <YAxis tick={{fill: '#666', fontSize: 12}} />
                  <RechartsTooltip cursor={{ fill: '#F5F5F5' }} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="value" fill="#6750A4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Recent History Table */}
          <div className="bg-surface rounded-[24px] p-6 shadow-elevation-1 border border-outline/10">
             <div className="flex items-center gap-2 mb-6">
               <div className="bg-secondaryContainer p-2 rounded-xl text-onPrimaryContainer">
                 <History size={20} />
               </div>
               <h3 className="text-lg font-normal text-[#1C1B1F]">Recent Searches</h3>
             </div>
             {searchHistory.length > 0 ? (
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-surfaceVariant/50 text-gray-600 font-medium text-xs uppercase">
                     <tr>
                       <th className="px-4 py-4 rounded-l-xl">Category</th>
                       <th className="px-4 py-4">Location</th>
                       <th className="px-4 py-4">Results</th>
                       <th className="px-4 py-4 rounded-r-xl">Time</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {searchHistory.map((item) => (
                       <tr key={item.id} className="hover:bg-surfaceVariant/30 transition-colors">
                         <td className="px-4 py-4 font-medium text-[#1C1B1F]">{item.category}</td>
                         <td className="px-4 py-4 text-gray-600">{item.location}</td>
                         <td className="px-4 py-4 text-primary font-bold">+{item.resultsCount}</td>
                         <td className="px-4 py-4 text-gray-400 text-xs">
                           <div className="flex items-center gap-1">
                             <Clock size={12} />
                             {item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             ) : (
               <div className="text-center py-8 text-gray-400 text-sm">
                 No searches performed yet.
               </div>
             )}
          </div>
        </div>

        <div className="bg-surface rounded-[24px] p-6 shadow-elevation-1 border border-outline/10 h-fit">
          <h3 className="text-lg font-normal text-[#1C1B1F] mb-4">Lead Status</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'New', value: newLeads },
                    { name: 'Contacted', value: contactedLeads },
                    { name: 'Converted', value: leads.filter(l => l.status === 'Converted').length },
                    { name: 'Skipped', value: leads.filter(l => l.status === 'Skipped').length },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#6750A4" />
                  <Cell fill="#9C27B0" />
                  <Cell fill="#FFB74D" />
                  <Cell fill="#E0E0E0" />
                </Pie>
                <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-sm text-gray-500 mt-2 flex-wrap">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#6750A4]"></div> New</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#9C27B0]"></div> Contacted</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#FFB74D]"></div> Won</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#E0E0E0]"></div> Skipped</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScraper = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-surface p-8 rounded-[32px] shadow-elevation-1 border border-outline/10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primaryContainer rounded-[24px] mb-6 text-onPrimaryContainer">
            <MapPin size={40} />
          </div>
          <h2 className="text-3xl font-normal text-[#1C1B1F] tracking-tight">Google Maps Scraper</h2>
          <p className="text-gray-500 mt-2 text-lg">Find business leads instantly using AI-powered extraction.</p>
        </div>

        <form onSubmit={handleScrape} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2 group">
              <label className="text-xs font-medium text-primary tracking-wider uppercase ml-1">Business Category</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. Dentists" 
                  className="w-full p-4 bg-transparent border border-gray-400 rounded-xl focus:border-2 focus:border-primary outline-none transition-all placeholder-gray-400 hover:border-gray-600"
                  value={scrapeCategory}
                  onChange={(e) => setScrapeCategory(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-gray-400 ml-1">Type of business you are looking for.</p>
            </div>
            <div className="space-y-2 group relative">
              <label className="text-xs font-medium text-primary tracking-wider uppercase ml-1">Location</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. New York, NY" 
                  className="w-full p-4 pr-24 bg-transparent border border-gray-400 rounded-xl focus:border-2 focus:border-primary outline-none transition-all placeholder-gray-400 hover:border-gray-600"
                  value={scrapeLocation}
                  onChange={(e) => setScrapeLocation(e.target.value)}
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                   {isLocating ? (
                     <div className="p-2 text-primary"><Loader2 className="animate-spin" size={24} /></div>
                   ) : (
                     <>
                        <button 
                          type="button" 
                          onClick={handleUseCurrentLocation}
                          className="p-3 text-gray-500 hover:text-primary hover:bg-primaryContainer rounded-full transition"
                          title="Use Current Location"
                        >
                          <Locate size={20} />
                        </button>
                        <button 
                          type="button" 
                          onClick={handleLookupLocation}
                          className="p-3 text-gray-500 hover:text-primary hover:bg-primaryContainer rounded-full transition"
                          title="Verify Location"
                        >
                          <Search size={20} />
                        </button>
                     </>
                   )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-primary tracking-wider uppercase ml-1 flex items-center gap-2">
              <Map size={14} /> Location Hints
            </label>
            <input 
              type="text" 
              placeholder="e.g. Near the station, Downtown area" 
              className="w-full p-4 bg-transparent border border-gray-400 rounded-xl focus:border-2 focus:border-primary outline-none transition-all placeholder-gray-400 hover:border-gray-600"
              value={scrapeLocationHints}
              onChange={(e) => setScrapeLocationHints(e.target.value)}
            />
          </div>
          
          <div className="bg-surfaceVariant/30 p-6 rounded-[24px]">
            <label className="text-sm font-medium text-gray-700 mb-4 block ml-1">Scan Intensity</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* FAST */}
              <label className={`relative flex flex-col items-center p-5 rounded-[20px] cursor-pointer transition-all duration-200 overflow-hidden group
                ${scrapeMode === 'fast' ? 'bg-secondaryContainer shadow-none border-2 border-primary' : 'bg-surface border border-gray-300 hover:bg-surfaceVariant'}
              `}>
                <input type="radio" name="mode" value="fast" className="hidden" checked={scrapeMode === 'fast'} onChange={() => setScrapeMode('fast')} />
                {scrapeMode === 'fast' && <div className="absolute top-3 right-3 text-primary"><CheckCircle size={18} fill="currentColor" className="text-white"/></div>}
                
                <div className={`p-3 rounded-full mb-3 ${scrapeMode === 'fast' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <Zap size={24} />
                </div>
                <div className="font-medium text-[#1C1B1F]">Fast Scan</div>
                <div className="text-xs text-gray-500 mt-1">~10 Results</div>
              </label>
              
              {/* DEEP */}
              <label className={`relative flex flex-col items-center p-5 rounded-[20px] cursor-pointer transition-all duration-200 overflow-hidden group
                ${scrapeMode === 'deep' ? 'bg-[#F3E5F5] shadow-none border-2 border-purple-700' : 'bg-surface border border-gray-300 hover:bg-surfaceVariant'}
              `}>
                <input type="radio" name="mode" value="deep" className="hidden" checked={scrapeMode === 'deep'} onChange={() => setScrapeMode('deep')} />
                 {scrapeMode === 'deep' && <div className="absolute top-3 right-3 text-purple-700"><CheckCircle size={18} fill="currentColor" className="text-white"/></div>}

                 <div className={`p-3 rounded-full mb-3 ${scrapeMode === 'deep' ? 'bg-purple-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <Layers size={24} />
                </div>
                <div className="font-medium text-[#1C1B1F]">Deep Scan</div>
                <div className="text-xs text-gray-500 mt-1">~100 Results</div>
              </label>

              {/* EXTREME */}
              <label className={`relative flex flex-col items-center p-5 rounded-[20px] cursor-pointer transition-all duration-200 overflow-hidden group
                ${scrapeMode === 'extreme' ? 'bg-[#FFEBEE] shadow-none border-2 border-red-600' : 'bg-surface border border-gray-300 hover:bg-surfaceVariant'}
              `}>
                <input type="radio" name="mode" value="extreme" className="hidden" checked={scrapeMode === 'extreme'} onChange={() => setScrapeMode('extreme')} />
                {scrapeMode === 'extreme' && <div className="absolute top-3 right-3 text-red-600"><CheckCircle size={18} fill="currentColor" className="text-white"/></div>}
                 
                 <div className={`p-3 rounded-full mb-3 ${scrapeMode === 'extreme' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <Flame size={24} />
                </div>
                <div className="font-medium text-[#1C1B1F]">Extreme Scan</div>
                <div className="text-xs text-gray-500 mt-1">~500 Results</div>
              </label>

            </div>
          </div>

          {scrapeError && (
            <div className="p-4 bg-red-50 text-error rounded-xl flex items-center gap-3 border border-red-100">
              <AlertCircle size={24} />
              <span className="text-sm font-medium">{scrapeError}</span>
            </div>
          )}

          <div className="flex flex-col gap-4 pt-4">
             <button 
                type="submit" 
                disabled={isScraping}
                className={`w-full py-4 rounded-full text-white font-medium text-lg shadow-elevation-2 transition-all flex items-center justify-center gap-3 hover:shadow-elevation-3 active:scale-[0.99]
                  ${isScraping ? 'bg-gray-400 cursor-not-allowed' : 
                    scrapeMode === 'extreme' ? 'bg-red-600 hover:bg-red-700' :
                    scrapeMode === 'deep' ? 'bg-purple-700 hover:bg-purple-800' :
                    'bg-primary hover:bg-[#523E8E]'
                  }
                `}
              >
                {isScraping ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Search size={24} />
                    Start Scan
                  </>
                )}
              </button>

              {/* Load More Button */}
              {lastScrapeParams && 
               lastScrapeParams.category === scrapeCategory && 
               lastScrapeParams.location === scrapeLocation && 
               !isScraping && (
                <button 
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full py-4 bg-transparent border-2 border-primary text-primary font-medium rounded-full hover:bg-primaryContainer transition flex items-center justify-center gap-2"
                >
                  <Plus size={20} /> Load More Results
                </button>
              )}
          </div>
        </form>
      </div>
    </div>
  );

  const renderLeads = () => {
    const isAllSelected = leads.length > 0 && selectedLeadIds.size === leads.length;
    const isIndeterminate = selectedLeadIds.size > 0 && selectedLeadIds.size < leads.length;

    return (
      <div className="bg-surface rounded-[24px] shadow-elevation-1 border border-outline/10 overflow-hidden">
        {selectedLeadIds.size > 0 ? (
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-secondaryContainer/50 transition-colors animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="bg-onPrimaryContainer text-primaryContainer px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
                {selectedLeadIds.size} Selected
              </div>
              <button onClick={() => setSelectedLeadIds(new Set())} className="text-sm text-primary hover:text-[#523E8E] font-medium underline-offset-4 hover:underline">
                Clear Selection
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleBulkStatusChange('Contacted')} className="px-4 py-2 text-sm font-medium bg-white text-primary border border-gray-200 rounded-full hover:bg-surfaceVariant transition">
                Mark Contacted
              </button>
              <button onClick={() => handleBulkStatusChange('New')} className="px-4 py-2 text-sm font-medium bg-white text-primary border border-gray-200 rounded-full hover:bg-surfaceVariant transition">
                Mark New
              </button>
              <button onClick={() => handleBulkStatusChange('Skipped')} className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-full hover:bg-surfaceVariant transition">
                Mark Skipped
              </button>
              <div className="h-8 w-px bg-gray-300 mx-2"></div>
              <button onClick={handleBulkExport} className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-full hover:bg-[#523E8E] transition shadow-sm flex items-center gap-2">
                <Download size={16} /> Export
              </button>
              <button onClick={handleBulkDelete} className="p-2 text-error hover:bg-red-50 rounded-full transition" title="Delete Selected">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-normal text-[#1C1B1F]">Leads <span className="text-gray-400 text-lg ml-1">({leads.length})</span></h2>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-surfaceVariant/50 hover:bg-surfaceVariant rounded-full transition">
                Filter
              </button>
              <button className="px-5 py-2.5 text-sm font-medium text-onPrimary bg-primary hover:bg-[#523E8E] rounded-full shadow-elevation-1 transition flex items-center gap-2">
                <Download size={18} /> Export CSV
              </button>
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1C1B1F]">
            <thead className="bg-surfaceVariant/30 text-xs font-medium text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 w-4">
                  <input 
                    type="checkbox" 
                    className="rounded-sm border-gray-400 text-primary focus:ring-primary w-4 h-4 cursor-pointer accent-primary"
                    checked={isAllSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-black/5 transition select-none" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Business Name {renderSortIcon('name')}</div>
                </th>
                <th className="px-6 py-4">Contact Details</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-black/5 transition select-none" onClick={() => handleSort('address')}>
                  <div className="flex items-center">Location {renderSortIcon('address')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-black/5 transition select-none" onClick={() => handleSort('rating')}>
                  <div className="flex items-center">Rating {renderSortIcon('rating')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-black/5 transition select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status {renderSortIcon('status')}</div>
                </th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedLeads.length > 0 ? sortedLeads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-surfaceVariant/30 transition duration-150 ${selectedLeadIds.has(lead.id) ? 'bg-secondaryContainer/20' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded-sm border-gray-400 text-primary focus:ring-primary w-4 h-4 cursor-pointer accent-primary"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleSelectLead(lead.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-base text-[#1C1B1F]">{lead.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 bg-gray-100 inline-block px-1.5 py-0.5 rounded">{lead.category}</div>
                  </td>
                  <td className="px-6 py-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Mail size={14} className="text-gray-400" /> 
                      {lead.email || <span className="text-gray-300 italic">No Email</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <MessageCircle size={14} className="text-gray-400" /> 
                      {lead.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 truncate max-w-xs text-gray-600">{lead.address}</td>
                  <td className="px-6 py-4">
                    <span className="bg-[#FFF8E1] text-[#FBC02D] px-2.5 py-1 rounded-md text-xs font-bold border border-[#FFECB3]">
                      {lead.rating} ★
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border
                      ${lead.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                        lead.status === 'Contacted' ? 'bg-green-50 text-green-700 border-green-100' : 
                        lead.status === 'Skipped' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                        'bg-gray-50 text-gray-600 border-gray-100'}
                    `}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <button 
                      onClick={() => handleSendSingleWhatsApp(lead)}
                      className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-full transition shadow-sm hover:shadow-md"
                      title="Open WhatsApp"
                    >
                      <ExternalLink size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400 bg-gray-50/50">
                    No leads found. Go to Scraper to find new businesses.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCampaigns = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Compose Section */}
      <div className="bg-surface p-8 rounded-[32px] shadow-elevation-1 border border-outline/10">
        <h2 className="text-2xl font-normal text-[#1C1B1F] mb-8 flex items-center gap-3">
          <div className="bg-primaryContainer p-2 rounded-xl text-onPrimaryContainer">
            <Sparkles size={24} />
          </div>
          AI Campaign Generator
        </h2>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-primary tracking-wider uppercase ml-1">Campaign Topic</label>
            <input 
              type="text" 
              className="w-full p-4 bg-transparent border border-gray-400 rounded-xl focus:border-2 focus:border-primary outline-none transition-all placeholder-gray-400"
              placeholder="e.g. Special offer for dental implants"
              value={emailTopic}
              onChange={(e) => setEmailTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-primary tracking-wider uppercase ml-1">Tone of Voice</label>
            <div className="relative">
              <select 
                className="w-full p-4 bg-transparent border border-gray-400 rounded-xl focus:border-2 focus:border-primary outline-none transition-all appearance-none"
                value={emailTone}
                onChange={(e) => setEmailTone(e.target.value)}
              >
                <option>Professional</option>
                <option>Friendly</option>
                <option>Urgent</option>
                <option>Persuasive</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronRight size={20} className="rotate-90" />
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleGenerateEmail}
            disabled={isGeneratingEmail || !emailTopic}
            className="w-full py-4 bg-primaryContainer text-onPrimaryContainer font-medium rounded-full hover:bg-[#D0BCFF] transition flex items-center justify-center gap-2 mt-4"
          >
            {isGeneratingEmail ? <Loader2 className="animate-spin" size={20} /> : <span className="flex items-center gap-2"><Sparkles size={18} /> Generate Content</span>}
          </button>
        </div>

        {generatedEmail && (
          <div className="mt-8 animate-fade-in">
            <div className="border border-outline/20 rounded-[20px] overflow-hidden bg-white shadow-sm">
              <div className="bg-surfaceVariant px-6 py-3 border-b border-outline/10 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">AI Suggestion</span>
                <span className="text-xs text-gray-400">Editable</span>
              </div>
              <div className="p-6 space-y-4">
                <input 
                  value={generatedEmail.subject} 
                  onChange={(e) => setGeneratedEmail({...generatedEmail, subject: e.target.value})}
                  className="w-full font-bold text-xl text-[#1C1B1F] border-none focus:ring-0 p-0 placeholder-gray-300"
                  placeholder="Subject Line"
                />
                <div className="h-px bg-gray-100 w-full"></div>
                <textarea 
                  value={generatedEmail.body.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, "")}
                  onChange={(e) => setGeneratedEmail({...generatedEmail, body: e.target.value})}
                  className="w-full h-48 text-gray-600 text-base leading-relaxed resize-none border-none focus:ring-0 p-0 placeholder-gray-300"
                  placeholder="Email Body..."
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
               <button 
                 onClick={() => setGeneratedEmail(null)}
                 className="px-6 py-2.5 text-gray-600 hover:bg-black/5 rounded-full text-sm font-medium transition"
               >
                 Discard
               </button>
               <button 
                onClick={handleCopyToWhatsApp}
                className="px-6 py-2.5 bg-green-100 text-green-800 hover:bg-green-200 rounded-full text-sm font-medium transition flex items-center gap-2"
               >
                 <MessageCircle size={18} /> Use in WhatsApp
               </button>
               <button 
                onClick={saveCampaign}
                className="px-6 py-2.5 bg-primary text-onPrimary rounded-full hover:bg-[#523E8E] text-sm font-medium shadow-elevation-1 transition"
               >
                 Save to History
               </button>
            </div>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="space-y-6">
        <div className="bg-surface p-8 rounded-[32px] shadow-elevation-1 border border-outline/10 h-full">
           <h2 className="text-2xl font-normal text-[#1C1B1F] mb-8">Campaign History</h2>
           <div className="space-y-4">
             {campaigns.length > 0 ? campaigns.map(c => (
               <div key={c.id} className="p-5 border border-outline/10 bg-white rounded-[20px] hover:shadow-md transition-all group cursor-default">
                 <div className="flex justify-between items-start">
                   <div>
                     <h3 className="font-medium text-[#1C1B1F] group-hover:text-primary transition-colors">{c.name}</h3>
                     <p className="text-xs text-gray-400 mt-1">Created: {c.createdAt.toLocaleDateString()}</p>
                   </div>
                   <span className="bg-surfaceVariant text-gray-600 text-xs px-2.5 py-1 rounded-md font-medium">{c.status}</span>
                 </div>
               </div>
             )) : (
               <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Mail size={24} className="opacity-40" />
                 </div>
                 <p>No campaigns saved yet.</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );

  const renderWhatsApp = () => (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="bg-[#E8DEF8] rounded-[32px] p-10 text-[#1D192B] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <div className="relative z-10 flex justify-between items-start">
            <div>
            <h2 className="text-4xl font-normal mb-4 flex items-center gap-4">
                <div className="bg-green-600 text-white p-3 rounded-2xl shadow-lg">
                    <MessageCircle size={32} />
                </div>
                WhatsApp Bridge
            </h2>
            <p className="opacity-80 max-w-xl text-lg leading-relaxed">
                Connect directly to WhatsApp Web or App without official API keys. Use our intelligent bridge for seamless communication.
            </p>
            </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* Left: Composer */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface p-6 rounded-[28px] border border-outline/10 shadow-elevation-1 h-full flex flex-col">
              <h3 className="font-medium text-lg text-[#1C1B1F] mb-6">Composer</h3>
              
              <div className="space-y-4 flex-1">
                <div className="relative">
                    <textarea 
                    className="w-full h-48 p-4 bg-gray-50 border border-gray-300 rounded-2xl text-base resize-none focus:border-2 focus:border-green-600 focus:bg-white outline-none transition-all"
                    placeholder="Type your message..."
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {waMessage.length} chars
                    </div>
                </div>
                
                {/* Image Attachment UI */}
                <div>
                   <input 
                     type="file" 
                     accept="image/*" 
                     className="hidden" 
                     ref={fileInputRef}
                     onChange={handleImageSelect}
                   />
                   
                   {!waImage ? (
                     <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="w-full py-3 border border-dashed border-gray-400 rounded-xl text-sm font-medium text-gray-500 hover:text-green-700 hover:border-green-600 hover:bg-green-50 flex items-center justify-center gap-2 transition"
                     >
                       <Paperclip size={18} /> Attach Image
                     </button>
                   ) : (
                     <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden shadow-sm">
                           <ImageIcon size={24} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium text-gray-800 truncate">{waImage.name}</p>
                           <p className="text-[10px] text-gray-500">{(waImage.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => setWaImage(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-full transition">
                           <XCircle size={20} />
                        </button>
                     </div>
                   )}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={startBulkSession}
                  disabled={!waMessage || whatsappReady === 0}
                  className={`w-full py-4 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.98]
                    ${!waMessage || whatsappReady === 0 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 text-white hover:bg-green-700'}
                  `}
                >
                  <Play size={20} fill="currentColor" /> Start Bulk Session
                </button>
                <div className="text-center text-xs text-gray-400 my-1 font-medium">OR</div>
                <button 
                  onClick={exportWhatsAppList}
                  disabled={whatsappReady === 0}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Export Valid Numbers
                </button>
              </div>
            </div>
         </div>

         {/* Right: List */}
         <div className="lg:col-span-2">
            <div className="bg-surface rounded-[28px] border border-outline/10 shadow-elevation-1 overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-6 border-b border-gray-100 bg-surfaceVariant/30 flex justify-between items-center">
                <h3 className="font-medium text-lg text-[#1C1B1F]">Ready Queue ({whatsappReady})</h3>
                <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">Valid Numbers Only</span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {leads.filter(l => validateWhatsAppNumber(l.phone)).length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Phone</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leads.filter(l => validateWhatsAppNumber(l.phone)).map(l => (
                        <tr key={l.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 font-medium text-gray-900">{l.name}</td>
                          <td className="px-6 py-4 font-mono text-gray-600 bg-gray-50 inline-block my-3 mx-6 rounded px-2 py-0.5">{l.phone}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              l.status === 'Contacted' ? 'bg-green-100 text-green-700' :
                              l.status === 'Skipped' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {l.status === 'Contacted' ? 'Sent' : l.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => handleSendSingleWhatsApp(l)}
                              className="p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-full transition"
                              title="Open WhatsApp"
                            >
                              <ExternalLink size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                   <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                     <AlertCircle size={32} className="mb-4 opacity-30"/>
                     <p>No valid WhatsApp numbers found yet.</p>
                   </div>
                )}
              </div>
            </div>
         </div>

      </div>
    </div>
  );

  // --- BULK SESSION MODAL ---
  const renderBulkSessionModal = () => {
    if (!isBulkSending || bulkQueue.length === 0) return null;

    const currentLead = bulkQueue[currentBulkIndex];
    const prevLead = currentBulkIndex > 0 ? bulkQueue[currentBulkIndex - 1] : null;
    const nextLead = currentBulkIndex < bulkQueue.length - 1 ? bulkQueue[currentBulkIndex + 1] : null;
    
    const progress = ((currentBulkIndex) / bulkQueue.length) * 100;
    
    // Check if we can use native share (Mobile mostly) or fallback (Desktop)
    const canUseNativeShare = waImage && canNativeShare(waImage);

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1C1B1F]/90 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-[#FEF7FF] rounded-[32px] shadow-elevation-3 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="bg-[#2B2930] p-6 flex justify-between items-center text-[#E6E0E9] shrink-0">
             <div>
               <h3 className="font-normal text-xl flex items-center gap-3">
                 <div className="bg-primaryContainer text-onPrimaryContainer p-1.5 rounded-lg">
                    <Zap size={20} fill="currentColor" />
                 </div>
                 Bulk Session
               </h3>
               <p className="text-[#CAC4D0] text-xs mt-1 ml-11">Do not close this window</p>
             </div>
             <button 
               type="button"
               onClick={() => {
                 if(window.confirm("End sending session? Progress will be lost.")) {
                   setIsBulkSending(false);
                   setBulkQueue([]);
                   setCurrentBulkIndex(0);
                 }
               }} 
               className="p-3 hover:bg-white/10 rounded-full transition cursor-pointer text-[#CAC4D0] hover:text-white"
             >
               <X size={24} />
             </button>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="bg-surfaceVariant w-full">
            <div className="h-1.5 w-full bg-surfaceVariant">
              <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${Math.max(5, progress)}%` }}></div>
            </div>
            <div className="flex justify-between px-8 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
               <span>{Math.round(progress)}% Complete</span>
               <span>{currentBulkIndex + 1} / {bulkQueue.length}</span>
            </div>
          </div>

          {/* Queue Strip */}
          <div className="bg-surface p-4 border-b border-outline/10 flex items-center justify-between text-xs shrink-0">
             <div className="flex-1 min-w-0 pr-2 opacity-50">
                <span className="block uppercase text-[10px] font-bold text-gray-400 mb-0.5">Previous</span>
                <div className="truncate font-medium text-gray-800">
                  {prevLead ? (
                    <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-600"/> {prevLead.name}</span>
                  ) : "Start"}
                </div>
             </div>

             <div className="text-gray-300 mx-2">
               <ChevronRight size={20} />
             </div>

             <div className="flex-1 min-w-0 pl-2 text-right">
                <span className="block uppercase text-[10px] font-bold text-gray-400 mb-0.5">Up Next</span>
                <div className="truncate font-medium text-gray-800">
                  {nextLead ? nextLead.name : "Finish"}
                </div>
             </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center flex-1 overflow-y-auto">
             
             {/* Main Card */}
             <div className="mb-8 relative py-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondaryContainer text-onSecondaryContainer rounded-full text-xs font-bold mb-6">
                  <Loader2 size={12} className="animate-spin" /> Ready to Send
                </div>
                
                <h2 className="text-4xl font-normal text-[#1C1B1F] tracking-tight mb-2">{currentLead.name}</h2>
                <div className="text-xl text-gray-500 font-roboto">
                  {currentLead.phone}
                </div>
             </div>

             {waImage && (
               <div className={`mb-8 text-xs p-4 rounded-xl flex items-center justify-center gap-4 text-left mx-auto max-w-sm
                 ${canUseNativeShare 
                   ? 'bg-blue-50 text-blue-900 border border-blue-100' 
                   : 'bg-amber-50 text-amber-900 border border-amber-100'}
               `}>
                 {canUseNativeShare ? <Share2 size={24} className="shrink-0" /> : <Copy size={24} className="shrink-0" />}
                 <div>
                   <p className="font-bold text-sm mb-0.5">{canUseNativeShare ? "Image Sharing Active" : "Image Auto-Copy Active"}</p>
                   <p className="opacity-80">
                     {canUseNativeShare 
                       ? "Click Open → Select WhatsApp."
                       : "Image copied. Paste (Ctrl+V) in chat."}
                   </p>
                 </div>
               </div>
             )}

             <div className="grid grid-cols-1 gap-4 max-w-xs mx-auto w-full">
                <button 
                  onClick={handleBulkOpenWhatsApp}
                  className="group w-full py-5 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-[20px] shadow-elevation-2 hover:shadow-elevation-3 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <ExternalLink size={24} />
                  <span>1. Open WhatsApp</span>
                </button>

                <div className="flex gap-4">
                   <button 
                     onClick={() => handleBulkNext('Contacted')}
                     className="flex-1 py-4 bg-primaryContainer text-onPrimaryContainer hover:bg-[#D0BCFF] font-bold rounded-[20px] transition flex items-center justify-center gap-2 active:scale-[0.98]"
                   >
                     <Check size={20} /> 2. Next
                   </button>
                   <button 
                     onClick={() => handleBulkNext('Skipped')}
                     className="px-6 py-4 border border-outline/30 text-gray-500 hover:text-error hover:bg-red-50 hover:border-red-100 font-medium rounded-[20px] transition flex items-center justify-center active:scale-[0.98]"
                     title="Skip this contact"
                   >
                     <XSquare size={24} />
                   </button>
                </div>
             </div>
          </div>

        </div>
      </div>
    );
  };

  const renderCacheExpiryModal = () => {
    if (!showCacheExpiryModal) return null;
    
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#FEF7FF] rounded-[28px] shadow-elevation-3 w-full max-w-md p-8 text-center animate-in zoom-in-95 border border-outline/10">
              <div className="w-20 h-20 bg-secondaryContainer rounded-full flex items-center justify-center mx-auto mb-6 text-onSecondaryContainer">
                  <History size={40} />
              </div>
              <h3 className="text-2xl font-normal text-[#1C1B1F] mb-4">Weekly Cleanup</h3>
              <p className="text-gray-600 mb-8 text-base leading-relaxed">
                  It's been 7 days since your last cleanup. To keep the app fast, we recommend clearing old data. 
                  <br/><br/>
                  <strong className="text-[#1C1B1F]">Do you want to keep your current leads and history?</strong>
              </p>
              
              <div className="flex flex-col gap-4">
                  <button 
                      onClick={handleKeepData}
                      className="w-full py-3.5 bg-primary text-onPrimary font-medium rounded-full hover:bg-[#523E8E] transition flex items-center justify-center gap-2 shadow-elevation-1"
                  >
                      <CheckCircle size={20} /> Keep Data (Extend 7 Days)
                  </button>
                  <button 
                      onClick={handleClearData}
                      className="w-full py-3.5 bg-transparent border border-outline/50 text-gray-700 font-medium rounded-full hover:bg-surfaceVariant hover:text-error transition flex items-center justify-center gap-2"
                  >
                      <Trash2 size={20} /> Clear Data & Start Fresh
                  </button>
              </div>
          </div>
      </div>
    );
  }

  // --- NAVIGATION HELPER ---
  const getNextStep = () => {
    switch (view) {
      case 'dashboard': return { id: 'scraper', label: 'Find Leads', icon: Search };
      case 'scraper': return { id: 'leads', label: 'View Leads', icon: Users };
      case 'leads': return { id: 'campaigns', label: 'Create Campaign', icon: Sparkles };
      case 'campaigns': return { id: 'whatsapp', label: 'Send Messages', icon: MessageCircle };
      case 'whatsapp': return { id: 'dashboard', label: 'Back Home', icon: LayoutDashboard };
      default: return null;
    }
  };
  
  const nextStep = getNextStep();
  
  const handleNextStep = () => {
    if (nextStep) {
      setView(nextStep.id as ViewState);
      // Close sidebar on mobile if navigating
      setIsSidebarOpen(false);
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- MAIN RENDER ---
  return (
    <div className="flex min-h-screen bg-[#FDFDFD] relative font-sans text-[#1C1B1F]">
      
      {/* Watermark - Fixed Bottom Left */}
      <div className="fixed bottom-4 left-4 z-50 pointer-events-none opacity-60 hover:opacity-100 transition-opacity select-none">
        <span className="text-[10px] font-medium text-gray-500 bg-surfaceVariant/80 backdrop-blur-[2px] px-3 py-1.5 rounded-full border border-white/20 shadow-sm">
          Made with ❤️ by Sardar Toheed
        </span>
      </div>

      {/* FAB (Floating Action Button) for Next Step */}
      {nextStep && (
        <div className="fixed bottom-8 right-8 z-40 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <button
            onClick={handleNextStep}
            className="bg-primaryContainer hover:bg-[#D0BCFF] text-onPrimaryContainer pl-6 pr-5 py-4 rounded-[20px] shadow-elevation-2 hover:shadow-elevation-3 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 font-medium text-base group"
          >
            <span>{nextStep.label}</span>
            <div className="bg-onPrimaryContainer/10 p-1 rounded-full">
               <ArrowRight size={20} />
            </div>
          </button>
        </div>
      )}

      {/* Modals */}
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}
      {showCacheExpiryModal && renderCacheExpiryModal()}
      {renderBulkSessionModal()}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Material Navigation Drawer) */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-[300px] bg-[#F3F3FA] transform transition-transform duration-300 ease-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0 shadow-elevation-2' : '-translate-x-full'}
        lg:m-4 lg:rounded-[28px] lg:h-[calc(100vh-32px)] overflow-hidden flex flex-col
      `}>
        <div className="p-8 pb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-primaryContainer rounded-xl flex items-center justify-center text-onPrimaryContainer font-bold text-2xl shadow-sm">
            M
          </div>
          <span className="text-2xl font-medium tracking-tight text-[#1C1B1F]">MapLeads</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} />
          <NavItem icon={Search} label="Map Scraper" active={view === 'scraper'} onClick={() => { setView('scraper'); setIsSidebarOpen(false); }} />
          <NavItem icon={Users} label="Leads" active={view === 'leads'} onClick={() => { setView('leads'); setIsSidebarOpen(false); }} />
          <NavItem icon={Mail} label="Campaigns" active={view === 'campaigns'} onClick={() => { setView('campaigns'); setIsSidebarOpen(false); }} />
          <NavItem icon={MessageCircle} label="WhatsApp" active={view === 'whatsapp'} onClick={() => { setView('whatsapp'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="p-6">
           <div className="bg-surfaceVariant p-4 rounded-[20px] flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-onPrimary text-sm font-bold">
               JS
             </div>
             <div className="flex-1">
                <p className="text-sm font-medium text-[#1C1B1F]">Free Tier</p>
                <p className="text-xs text-gray-500">Gemini 2.5 Enabled</p>
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top App Bar */}
        <header className="h-20 flex items-center justify-between px-8 flex-shrink-0 bg-[#FDFDFD]">
          <div className="flex items-center gap-4 lg:hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-[#1C1B1F] hover:bg-gray-100 rounded-full transition"
            >
              <Menu size={24} />
            </button>
            <span className="font-medium text-xl">MapLeads</span>
          </div>
          
          {/* Desktop Title shown in header instead of sidebar breadcrumb style */}
          <div className="hidden lg:block">
              {/* Spacer */}
          </div>
          
          <div className="ml-auto flex items-center gap-4">
            <button className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition">
               <Settings size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-surfaceVariant flex items-center justify-center cursor-pointer hover:bg-gray-200 transition">
               <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white absolute top-6 right-8"></div> 
               <span className="text-sm font-bold text-gray-600">JS</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 pb-24">
          <div className="max-w-7xl mx-auto pt-4">
             <div className="mb-8">
               <h1 className="text-4xl font-normal text-[#1C1B1F] capitalize tracking-tight">
                 {view === 'scraper' ? 'Find Leads' : view === 'campaigns' ? 'Campaign Studio' : view.replace('-', ' ')}
               </h1>
             </div>

             {view === 'dashboard' && renderDashboard()}
             {view === 'scraper' && renderScraper()}
             {view === 'leads' && renderLeads()}
             {view === 'campaigns' && renderCampaigns()}
             {view === 'whatsapp' && renderWhatsApp()}
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper Component for Navigation (Material Navigation Drawer Item)
const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-full text-sm font-medium transition-all duration-200 group
      ${active 
        ? 'bg-secondaryContainer text-[#1D192B]' 
        : 'text-[#49454F] hover:bg-black/5'
      }
    `}
  >
    <Icon size={24} className={active ? 'text-[#1D192B]' : 'text-[#49454F]'} strokeWidth={active ? 2.5 : 2} />
    <span className="tracking-wide">{label}</span>
  </button>
);

export default App;