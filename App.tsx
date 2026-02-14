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
  Crosshair,
  Filter
} from 'lucide-react';
import { StatsCard } from './components/StatsCard';
import { OnboardingModal } from './components/OnboardingModal';
import { Toast, ToastType } from './components/Toast';
import { ConfirmationModal } from './components/ConfirmationModal';
import { CustomSelect } from './components/CustomSelect';
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
  
  // Toast State
  const [toasts, setToasts] = useState<Array<{id: string, message: string, type: ToastType}>>([]);
  
  // Confirmation Modal State
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
  const [waImagePreview, setWaImagePreview] = useState<string | null>(null);
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

  // --- ACTIONS: TOAST ---
  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2,5);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- ACTIONS: MODAL ---
  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

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
    showToast("Data retention extended for 7 days.", "success");
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
    showToast("All data has been cleared.", "info");
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

  // Image Preview Effect
  useEffect(() => {
    if (waImage) {
      const url = URL.createObjectURL(waImage);
      setWaImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setWaImagePreview(null);
    }
  }, [waImage]);


  // --- ACTIONS ---

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
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
        showToast("Location updated!", "success");
      } catch (error) {
        console.error(error);
        showToast("Failed to retrieve location details.", "error");
      } finally {
        setIsLocating(false);
      }
    }, (error) => {
      console.error(error);
      showToast("Unable to retrieve your location. Check permissions.", "error");
      setIsLocating(false);
    });
  };

  const handleLookupLocation = async () => {
    if (!scrapeLocation.trim()) return;
    if (!hasApiKey()) {
      showToast("API Key required for location lookup.", "warning");
      return;
    }
    
    setIsLocating(true);
    try {
      const refined = await lookupLocation(scrapeLocation);
      setScrapeLocation(refined);
      showToast("Location verified and refined.", "success");
    } catch (e) {
      console.error(e);
      showToast("Could not verify location.", "warning");
    } finally {
      setIsLocating(false);
    }
  };

  const performScrape = async (append: boolean) => {
    if (!hasApiKey()) {
      setScrapeError("API Key missing. Please configure process.env.API_KEY.");
      showToast("API Key missing", "error");
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
        showToast("No new results found.", "info");
      } else {
        showToast(`Found ${uniqueResults.length} new leads!`, "success");
        if (!append) setView('leads'); // Redirect to leads view on fresh search
      }
    } catch (err: any) {
      setScrapeError("Failed to scrape. Please try again later. " + err.message);
      showToast("Scraping failed. See error details.", "error");
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
      showToast("Campaign draft generated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate content.", "error");
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
    showToast("Content copied to WhatsApp composer.", "info");
  };

  const saveCampaign = () => {
    if (!generatedEmail) return;
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: `Campaign: ${emailTopic.substring(0, 20) || 'Untitled'}...`,
      subject: generatedEmail.subject,
      content: generatedEmail.body,
      status: 'Draft',
      sentCount: 0,
      openRate: 0,
      createdAt: new Date()
    };
    setCampaigns([newCampaign, ...campaigns]);
    showToast("Campaign saved to drafts!", "success");
  };

  const deleteCampaign = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Campaign',
      message: 'Are you sure you want to delete this campaign? This action cannot be undone.',
      isDanger: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        showToast("Campaign deleted.", "info");
        closeConfirmModal();
      }
    });
  };

  const loadCampaign = (campaign: Campaign) => {
    setGeneratedEmail({
      subject: campaign.subject,
      body: campaign.content
    });
    // Try to extract topic from name if possible, or just set generic
    const topicMatch = campaign.name.match(/Campaign: (.*)\.\.\./);
    if (topicMatch) {
       setEmailTopic(topicMatch[1]);
    }
    
    showToast("Campaign loaded!", "success");
    // Scroll to editor on mobile
    if (window.innerWidth < 1024) {
        const editor = document.getElementById('campaign-editor');
        if (editor) editor.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // --- WHATSAPP ACTIONS ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        showToast("Please select a valid image file.", "warning");
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
       showToast("Image not auto-copied. Attach manually.", "warning");
     }
  };

  const handleSendSingleWhatsApp = async (lead: Lead) => {
    if (!waMessage.trim()) {
      showToast("Please enter a message first.", "warning");
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
      showToast("No valid WhatsApp numbers found.", "error");
      return;
    }
    if (!waMessage.trim()) {
      showToast("Please enter a message first.", "warning");
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
      setIsBulkSending(false);
      setBulkQueue([]);
      setCurrentBulkIndex(0);
      showToast("Session Complete!", "success");
    }
  };

  const handleBulkOpenWhatsApp = async () => {
    const currentLead = bulkQueue[currentBulkIndex];
    await performSend(currentLead.phone, waMessage, waImage);
  };

  const exportWhatsAppList = () => {
    const validLeads = leads.filter(l => validateWhatsAppNumber(l.phone));
    if (validLeads.length === 0) {
      showToast("No valid WhatsApp numbers found.", "warning");
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
    showToast("Export started!", "success");
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
    setConfirmModal({
      isOpen: true,
      title: 'Delete Leads',
      message: `Are you sure you want to delete ${selectedLeadIds.size} leads? This action cannot be undone.`,
      isDanger: true,
      confirmLabel: 'Delete All',
      onConfirm: () => {
        setLeads(prev => prev.filter(l => !selectedLeadIds.has(l.id)));
        setSelectedLeadIds(new Set());
        showToast("Leads deleted successfully.", "success");
        closeConfirmModal();
      }
    });
  };

  const handleBulkStatusChange = (status: Lead['status']) => {
    // Determine how many *new* contacts are being marked as Contacted
    if (status === 'Contacted') {
       const previouslyNotContacted = leads.filter(l => selectedLeadIds.has(l.id) && l.status !== 'Contacted').length;
       setSessionStats(prev => ({...prev, totalContacted: prev.totalContacted + previouslyNotContacted}));
    }

    setLeads(prev => prev.map(l => selectedLeadIds.has(l.id) ? { ...l, status } : l));
    setSelectedLeadIds(new Set());
    showToast(`Status updated to ${status}`, "success");
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
    showToast("Export downloaded!", "success");
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
      ? <ArrowUp size={14} className="ml-1 text-googleBlue" />
      : <ArrowDown size={14} className="ml-1 text-googleBlue" />;
  };


  // --- COMPONENT RENDERERS ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards Grid - Responsive columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatsCard title="Total Leads" value={sessionStats.totalGenerated} icon={Users} color="blue" />
        <StatsCard title="New Leads" value={newLeads} icon={MapPin} color="purple" />
        <StatsCard title="Contacted" value={sessionStats.totalContacted} icon={Mail} color="orange" />
        <StatsCard title="WhatsApp Ready" value={whatsappReady} icon={MessageCircle} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-card border border-transparent">
            <h3 className="text-lg font-normal text-textMain mb-4">Lead Source</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Extreme', value: leads.filter(l => l.source === 'Extreme Scrape').length },
                  { name: 'Deep', value: leads.filter(l => l.source === 'Deep Scrape').length },
                  { name: 'Fast', value: leads.filter(l => l.source === 'Fast Scrape').length },
                  { name: 'Manual', value: leads.filter(l => !l.source.includes('Scrape')).length },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
                  <XAxis dataKey="name" tick={{fill: '#5f6368', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill: '#5f6368', fontSize: 12}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{ fill: '#f8f9fa' }} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="value" fill="#1a73e8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Recent History Table */}
          <div className="bg-white rounded-xl p-6 shadow-card border border-transparent">
             <div className="flex items-center gap-2 mb-4">
               <History size={20} className="text-googleBlue" />
               <h3 className="text-lg font-normal text-textMain">Recent Searches</h3>
             </div>
             {searchHistory.length > 0 ? (
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead className="text-textSec font-medium text-xs uppercase border-b border-gray-100">
                     <tr>
                       <th className="px-4 py-3 font-medium">Category</th>
                       <th className="px-4 py-3 font-medium">Location</th>
                       <th className="px-4 py-3 font-medium">Results</th>
                       <th className="px-4 py-3 font-medium">Time</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {searchHistory.map((item) => (
                       <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-4 py-3 font-medium text-textMain">{item.category}</td>
                         <td className="px-4 py-3 text-textSec">{item.location}</td>
                         <td className="px-4 py-3 text-googleBlue font-bold">+{item.resultsCount}</td>
                         <td className="px-4 py-3 text-gray-400 text-xs">
                           {item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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

        <div className="bg-white rounded-xl p-6 shadow-card h-fit border border-transparent">
          <h3 className="text-lg font-normal text-textMain mb-4">Lead Status</h3>
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
                  <Cell fill="#1a73e8" /> 
                  <Cell fill="#34a853" /> 
                  <Cell fill="#fbbc04" /> 
                  <Cell fill="#dadce0" /> 
                </Pie>
                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs text-textSec mt-4 flex-wrap">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-googleBlue"></div> New</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-googleGreen"></div> Contacted</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-googleYellow"></div> Won</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-300"></div> Skipped</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScraper = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Search Header - Google Maps Style */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-normal text-textMain mb-2">Find Leads on Maps</h2>
        <p className="text-textSec">Extract business contact info directly from Google Maps results.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-transparent">
        <form onSubmit={handleScrape} className="space-y-6">
          
          {/* Floating Search Bar Input Group */}
          <div className="space-y-4">
             <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={20} className="text-textSec group-focus-within:text-googleBlue transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="What are you looking for? (e.g. Pizza, Plumbers)" 
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-full focus:shadow-floating focus:border-transparent focus:ring-0 outline-none transition-all text-textMain placeholder-gray-400"
                  value={scrapeCategory}
                  onChange={(e) => setScrapeCategory(e.target.value)}
                  required
                />
             </div>
             
             <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin size={20} className="text-textSec group-focus-within:text-googleRed transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="Where? (e.g. Downtown Dubai)" 
                  className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-full focus:shadow-floating focus:border-transparent focus:ring-0 outline-none transition-all text-textMain placeholder-gray-400"
                  value={scrapeLocation}
                  onChange={(e) => setScrapeLocation(e.target.value)}
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                   {isLocating ? (
                     <div className="p-2 text-googleBlue"><Loader2 className="animate-spin" size={20} /></div>
                   ) : (
                     <button 
                       type="button" 
                       onClick={handleUseCurrentLocation}
                       className="p-2 text-gray-400 hover:text-googleBlue hover:bg-blue-50 rounded-full transition"
                       title="Use Current Location"
                     >
                       <Locate size={20} />
                     </button>
                   )}
                </div>
             </div>
          </div>

          {/* Scan Depth - Visible Default */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-textSec uppercase flex items-center gap-1">
               <Layers size={14} /> Scan Depth
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['fast', 'deep', 'extreme'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setScrapeMode(m as any)}
                  className={`py-3 rounded-lg text-sm font-medium capitalize border transition-all duration-200
                    ${scrapeMode === m 
                      ? 'bg-blue-50 border-googleBlue text-googleBlue shadow-sm' 
                      : 'bg-white border-gray-200 text-textSec hover:bg-gray-50'}
                  `}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="button"
              className="text-sm text-googleBlue hover:underline flex items-center gap-1 mb-2 font-medium"
              onClick={() => {
                 const el = document.getElementById('advanced-options');
                 if(el) el.classList.toggle('hidden');
              }}
            >
              <Settings size={14} /> Advanced Search Options
            </button>
            <div id="advanced-options" className="hidden space-y-4 bg-gray-50 p-4 rounded-xl animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-textSec uppercase">Location Hints</label>
                  <input 
                    type="text" 
                    placeholder="Near central station, etc." 
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-googleBlue outline-none text-sm"
                    value={scrapeLocationHints}
                    onChange={(e) => setScrapeLocationHints(e.target.value)}
                  />
                </div>
            </div>
          </div>

          {scrapeError && (
            <div className="p-4 bg-red-50 text-googleRed rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle size={20} />
              <span>{scrapeError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
             <button 
                type="submit" 
                disabled={isScraping}
                className={`w-full py-3.5 rounded-full text-white font-medium shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]
                  ${isScraping ? 'bg-gray-400 cursor-not-allowed' : 'bg-googleBlue hover:bg-blue-600 hover:shadow-lg'}
                `}
              >
                {isScraping ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                {isScraping ? 'Scanning Maps...' : 'Search Maps'}
              </button>
              
              {lastScrapeParams && !isScraping && (
                <button 
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full py-3.5 bg-white border border-gray-200 text-googleBlue font-medium rounded-full hover:bg-blue-50 transition flex items-center justify-center gap-2"
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

    return (
      <div className="bg-white rounded-xl shadow-card border border-transparent overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
             {selectedLeadIds.size > 0 ? (
               <>
                 <span className="bg-blue-50 text-googleBlue px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                   {selectedLeadIds.size} selected
                 </span>
                 <button onClick={() => handleBulkStatusChange('Contacted')} className="p-2 text-googleGreen hover:bg-green-50 rounded-full transition" title="Mark Contacted"><CheckCircle size={18}/></button>
                 <button onClick={handleBulkDelete} className="p-2 text-googleRed hover:bg-red-50 rounded-full transition" title="Delete"><Trash2 size={18}/></button>
               </>
             ) : (
               <h2 className="text-xl font-normal text-textMain">Leads <span className="text-gray-400 text-sm ml-1">({leads.length})</span></h2>
             )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleBulkExport} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-googleBlue bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center justify-center gap-2">
              <Download size={16} /> Export
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-textMain whitespace-nowrap">
            <thead className="bg-gray-50 text-xs font-medium text-textSec uppercase border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-googleBlue focus:ring-googleBlue"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 cursor-pointer hover:text-googleBlue transition" onClick={() => handleSort('name')}>Name</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3 cursor-pointer hover:text-googleBlue transition" onClick={() => handleSort('address')}>Address</th>
                <th className="px-6 py-3 cursor-pointer hover:text-googleBlue transition" onClick={() => handleSort('rating')}>Rating</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedLeads.length > 0 ? sortedLeads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-blue-50/50 transition ${selectedLeadIds.has(lead.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-googleBlue focus:ring-googleBlue"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleSelectLead(lead.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-textMain">{lead.name}</div>
                    <div className="text-xs text-textSec truncate max-w-[150px]">{lead.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-textMain font-mono text-xs">{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-textSec truncate max-w-[200px]">{lead.address}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-xs">
                      <span className="text-orange-500 mr-1">★</span> {lead.rating}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide
                      ${lead.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                        lead.status === 'Contacted' ? 'bg-green-50 text-green-700 border-green-100' : 
                        'bg-gray-50 text-gray-600 border-gray-200'}
                    `}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <button 
                      onClick={() => handleSendSingleWhatsApp(lead)}
                      className="text-waGreen hover:text-green-700 transition p-2 bg-green-50 rounded-full"
                      title="WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-textSec">
                    No leads found. Start a search.
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="campaign-editor">
      {/* Compose Section */}
      <div className="bg-white p-8 rounded-xl shadow-card border border-transparent flex flex-col">
        <h2 className="text-2xl font-normal text-textMain mb-6 flex items-center gap-2">
          <Sparkles size={24} className="text-googleBlue" /> 
          AI Campaign Writer
        </h2>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-textSec uppercase tracking-wide">Topic</label>
            <input 
              type="text" 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-googleBlue outline-none transition"
              placeholder="e.g. Summer Sale 50% Off"
              value={emailTopic}
              onChange={(e) => setEmailTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-textSec uppercase tracking-wide">Tone</label>
            <CustomSelect 
              value={emailTone}
              onChange={setEmailTone}
              options={['Professional', 'Friendly', 'Urgent', 'Persuasive']}
              placeholder="Select Tone"
            />
          </div>
          
          <button 
            onClick={handleGenerateEmail}
            disabled={isGeneratingEmail || !emailTopic}
            className="w-full py-3 bg-blue-50 text-googleBlue font-medium rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2"
          >
            {isGeneratingEmail ? <Loader2 className="animate-spin" size={18} /> : <span>Generate Draft</span>}
          </button>
        </div>

        {generatedEmail && (
          <div className="mt-8 animate-fade-in" id="campaign-result">
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-textSec uppercase">Preview</span>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setGeneratedEmail(null)}
                     className="text-gray-400 hover:text-googleRed transition"
                     title="Discard"
                   >
                     <X size={16} />
                   </button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <input 
                  value={generatedEmail.subject} 
                  onChange={(e) => setGeneratedEmail({...generatedEmail, subject: e.target.value})}
                  className="w-full font-bold text-lg text-textMain border-none focus:ring-0 p-0 placeholder-gray-300"
                  placeholder="Subject Line"
                />
                <textarea 
                  value={generatedEmail.body.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, "")}
                  onChange={(e) => setGeneratedEmail({...generatedEmail, body: e.target.value})}
                  className="w-full h-40 text-textSec text-sm resize-none border-none focus:ring-0 p-0 placeholder-gray-300"
                  placeholder="Email Body..."
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
               <button 
                onClick={saveCampaign}
                className="px-4 py-2 bg-white border border-gray-200 text-textMain hover:bg-gray-50 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
               >
                 <Check size={16} /> Save to History
               </button>
               <button 
                onClick={handleCopyToWhatsApp}
                className="px-4 py-2 bg-waGreen text-white hover:bg-green-600 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
               >
                 <MessageCircle size={16} /> Use in WhatsApp
               </button>
            </div>
          </div>
        )}
      </div>

      {/* History List */}
      <div className="bg-white p-6 rounded-xl shadow-card h-full border border-transparent flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-normal text-textMain">Saved Campaigns</h2>
              <span className="bg-blue-50 text-googleBlue text-xs px-2 py-1 rounded-full">{campaigns.length}</span>
           </div>
           
           <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
             {campaigns.length > 0 ? campaigns.map(c => (
               <div key={c.id} className="group p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition relative bg-white">
                 <div className="pr-8 cursor-pointer" onClick={() => loadCampaign(c)}>
                    <h3 className="font-medium text-textMain truncate">{c.name}</h3>
                    <p className="text-xs text-textSec mt-1 line-clamp-2">{c.subject}</p>
                 </div>
                 
                 <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                    <span className="text-[10px] text-gray-400">{c.createdAt.toLocaleDateString()}</span>
                    <button 
                      onClick={() => loadCampaign(c)}
                      className="text-xs bg-blue-50 text-googleBlue hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition"
                    >
                      Reuse
                    </button>
                 </div>

                 <button 
                   onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }}
                   className="absolute top-4 right-4 text-gray-300 hover:text-googleRed transition opacity-0 group-hover:opacity-100 p-1"
                   title="Delete Campaign"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             )) : (
               <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                 No campaigns saved yet.
               </div>
             )}
           </div>
      </div>
    </div>
  );

  const renderWhatsApp = () => (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Header Banner - WhatsApp Style */}
      <div className="bg-waTeal rounded-xl p-8 text-white shadow-card relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-medium mb-2 flex items-center gap-3">
            <MessageCircle size={32} />
            WhatsApp Bridge
          </h2>
          <p className="opacity-90 max-w-xl text-lg font-light">
            Seamlessly connect to WhatsApp Web or App without API keys.
          </p>
        </div>
        {/* Decorative Circles */}
        <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* Left: Composer (WhatsApp Web Style) */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-waBackground p-4 rounded-xl shadow-card border border-gray-200 h-full flex flex-col" style={{backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: 'overlay'}}>
              <div className="bg-white p-4 rounded-lg shadow-sm flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-waTeal mb-4 uppercase tracking-wide">Compose Message</h3>
                
                <textarea 
                  className="w-full flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:bg-white focus:border-waTeal outline-none transition mb-4"
                  placeholder="Type your message..."
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                />

                {/* Image Preview */}
                {waImagePreview && (
                  <div className="mb-4 relative bg-gray-50 rounded-lg border border-gray-100 overflow-hidden group">
                    <img src={waImagePreview} alt="Attachment" className="w-full h-40 object-cover bg-gray-50" />
                    <button 
                      onClick={() => {
                        setWaImage(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-1 bg-white text-gray-500 rounded-full shadow-md hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] p-1 truncate px-2">
                        {waImage?.name}
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImageSelect}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-500 hover:text-waTeal hover:bg-gray-50 rounded-full transition"
                            title="Attach Image"
                        >
                            <Paperclip size={20} />
                        </button>
                        
                        {!waImagePreview && waImage && (
                            <span className="text-xs text-textSec bg-gray-100 px-2 py-1 rounded truncate max-w-[150px]">
                                {waImage.name}
                            </span>
                        )}
                        {!waImage && <span className="text-xs text-gray-400 italic ml-1">No image attached</span>}
                    </div>

                    <button 
                        onClick={startBulkSession}
                        disabled={!waMessage || whatsappReady === 0}
                        className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm
                        ${!waMessage || whatsappReady === 0 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-waGreen text-white hover:bg-[#1DA851]'}
                        `}
                    >
                        <Send size={18} /> Start Bulk Send
                    </button>
                </div>
              </div>
            </div>
         </div>

         {/* Right: List */}
         <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-transparent shadow-card overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 bg-waTeal text-white flex justify-between items-center">
                <h3 className="font-medium">Contacts Queue ({whatsappReady})</h3>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {leads.filter(l => validateWhatsAppNumber(l.phone)).length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 font-medium text-textSec">Name</th>
                        <th className="px-6 py-3 font-medium text-textSec">Phone</th>
                        <th className="px-6 py-3 font-medium text-textSec">Status</th>
                        <th className="px-6 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leads.filter(l => validateWhatsAppNumber(l.phone)).map(l => (
                        <tr key={l.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 font-medium text-textMain">{l.name}</td>
                          <td className="px-6 py-4 font-mono text-textSec">{l.phone}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              l.status === 'Contacted' ? 'text-waGreen bg-green-50' : 'text-blue-600 bg-blue-50'
                            }`}>
                              {l.status === 'Contacted' ? 'Sent' : l.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleSendSingleWhatsApp(l)}
                              className="text-waTeal hover:bg-green-50 p-2 rounded-full transition"
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
                     <p>No valid numbers found.</p>
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
    const progress = ((currentBulkIndex) / bulkQueue.length) * 100;
    const canUseNativeShare = waImage && canNativeShare(waImage);

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
          
          {/* Header */}
          <div className="bg-waTeal p-4 flex justify-between items-center text-white">
             <h3 className="font-medium flex items-center gap-2">
                 <Zap size={18} className="text-yellow-300" /> Bulk Sender
             </h3>
             <button onClick={() => setIsBulkSending(false)} className="text-white/80 hover:text-white"><X size={20}/></button>
          </div>

          {/* Progress */}
          <div className="bg-gray-100 h-1.5 w-full">
             <div className="h-full bg-waGreen transition-all duration-300" style={{ width: `${Math.max(5, progress)}%` }}></div>
          </div>

          <div className="p-8 text-center">
             <div className="w-16 h-16 bg-blue-50 text-googleBlue rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                 {currentLead.name.charAt(0)}
             </div>
             <h2 className="text-2xl font-medium text-textMain truncate">{currentLead.name}</h2>
             <p className="text-lg text-textSec font-mono mt-1 mb-6">{currentLead.phone}</p>

             <div className="space-y-3">
                <button 
                  onClick={handleBulkOpenWhatsApp}
                  className="w-full py-4 bg-waGreen text-white font-bold rounded-lg shadow hover:bg-[#1DA851] transition flex items-center justify-center gap-2"
                >
                  <ExternalLink size={20} /> Open Chat
                </button>
                <div className="flex gap-3">
                   <button onClick={() => handleBulkNext('Contacted')} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-textMain font-medium rounded-lg">Mark Sent</button>
                   <button onClick={() => handleBulkNext('Skipped')} className="flex-1 py-3 bg-white border border-gray-200 hover:bg-red-50 text-googleRed font-medium rounded-lg">Skip</button>
                </div>
             </div>
             
             <p className="mt-6 text-xs text-textSec">
                {currentBulkIndex + 1} of {bulkQueue.length} contacts
             </p>
          </div>

        </div>
      </div>
    );
  };

  const renderCacheExpiryModal = () => {
    if (!showCacheExpiryModal) return null;
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm p-6 text-center">
              <History size={48} className="text-orange-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-textMain mb-2">Weekly Cleanup</h3>
              <p className="text-textSec mb-6 text-sm">Keep your saved leads for another 7 days or start fresh?</p>
              <div className="flex flex-col gap-3">
                  <button onClick={handleKeepData} className="w-full py-3 bg-googleBlue text-white font-medium rounded-lg">Keep Data</button>
                  <button onClick={handleClearData} className="w-full py-3 text-textSec hover:bg-gray-50 rounded-lg">Clear Data</button>
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
      setIsSidebarOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- MAIN RENDER ---
  return (
    <div className="flex min-h-screen bg-background relative font-sans text-textMain overflow-x-hidden">
      
      {/* Watermark - Fixed Bottom Left */}
      <div className="fixed bottom-3 left-3 z-50 pointer-events-none opacity-50 hover:opacity-100 transition-opacity select-none hidden md:block">
        <span className="text-[10px] font-medium text-textSec bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-200">
          Made with ❤️ by Sardar Toheed
        </span>
      </div>

      {/* Toast Container - Fixed Top Right */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast {...t} onClose={removeToast} />
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isDanger={confirmModal.isDanger}
        confirmLabel={confirmModal.confirmLabel}
      />

      {/* FAB Next Step */}
      {nextStep && (
        <div className="fixed bottom-6 right-6 z-40 animate-fade-in">
          <button
            onClick={handleNextStep}
            className="bg-googleBlue hover:bg-blue-700 text-white pl-5 pr-4 py-3 rounded-full shadow-floating hover:shadow-lg transition-all duration-300 flex items-center gap-2 font-medium"
          >
            <span>{nextStep.label}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Modals */}
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}
      {showCacheExpiryModal && renderCacheExpiryModal()}
      {renderBulkSessionModal()}

      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Google Style */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-googleBlue rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            M
          </div>
          <span className="text-xl font-medium text-textMain tracking-tight">MapLeads</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} />
          <NavItem icon={Search} label="Maps Scraper" active={view === 'scraper'} onClick={() => { setView('scraper'); setIsSidebarOpen(false); }} />
          <NavItem icon={Users} label="Leads" active={view === 'leads'} onClick={() => { setView('leads'); setIsSidebarOpen(false); }} />
          <NavItem icon={Mail} label="Campaigns" active={view === 'campaigns'} onClick={() => { setView('campaigns'); setIsSidebarOpen(false); }} />
          <NavItem icon={MessageCircle} label="WhatsApp" active={view === 'whatsapp'} onClick={() => { setView('whatsapp'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="p-4 border-t border-gray-100">
           <div className="bg-blue-50 rounded-lg p-4">
             <div className="flex items-center gap-2 mb-1">
               <div className="w-2 h-2 rounded-full bg-green-500"></div>
               <span className="text-xs font-bold text-googleBlue uppercase">System Ready</span>
             </div>
             <p className="text-xs text-textSec">Gemini 2.5 Flash Connected</p>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0 z-20 sticky top-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-textSec hover:bg-gray-100 rounded-full"
            >
              <Menu size={24} />
            </button>
            <span className="font-medium text-lg ml-2">MapLeads</span>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto min-h-full pb-20">
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

// Nav Item Component
const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3 rounded-r-full text-sm font-medium transition-all duration-200 relative overflow-hidden
      ${active 
        ? 'bg-blue-50 text-googleBlue' 
        : 'text-textSec hover:bg-gray-100 hover:text-textMain'
      }
    `}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-googleBlue rounded-r"></div>}
    <Icon size={20} className={active ? 'text-googleBlue' : 'text-gray-500'} />
    <span>{label}</span>
  </button>
);

export default App;