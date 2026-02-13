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
  MoreHorizontal
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { StatsCard } from './components/StatsCard';
import { OnboardingModal } from './components/OnboardingModal';
import { searchBusinesses, generateEmailContent, hasApiKey, validateWhatsAppNumber } from './services/geminiService';
import { generateWhatsAppLink, openWhatsAppTab, isMobileDevice, copyImageToClipboard, canNativeShare, shareContent } from './services/whatsappService';
import { Lead, Campaign, ViewState, SearchHistoryItem } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// --- MOCK DATA FOR DASHBOARD ---
const MOCK_LEADS: Lead[] = [
  { id: '1', name: 'Smile Dental', category: 'Dentist', address: '123 Market St, SF', phone: '+1 415-555-0123', email: 'contact@smiledental.com', website: 'smiledental.com', rating: 4.8, status: 'New', source: 'Manual' },
  { id: '2', name: 'Tech Innovators', category: 'Software', address: '404 Silicon Ave, CA', phone: '+1 650-555-9876', email: 'hello@techinnovators.io', website: 'techinnovators.io', rating: 5.0, status: 'Contacted', source: 'Import' },
  { id: '3', name: 'Green Cafe', category: 'Restaurant', address: '88 Coffee Ln, NY', phone: '+1 212-555-4567', email: 'manager@greencafe.com', website: 'greencafe.com', rating: 4.2, status: 'Converted', source: 'Manual' },
];

type SortKey = 'name' | 'rating' | 'status' | 'address';
type SortDirection = 'asc' | 'desc';

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Scraper State
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [scrapeMode, setScrapeMode] = useState<'fast' | 'deep' | 'extreme'>('fast');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  
  // New States for History and Load More
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [sessionStats, setSessionStats] = useState({ totalGenerated: MOCK_LEADS.length, totalContacted: 1 });
  const [lastScrapeParams, setLastScrapeParams] = useState<{category: string, location: string} | null>(null);

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

  // Stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'New').length;
  const contactedLeads = leads.filter(l => l.status === 'Contacted').length;
  const whatsappReady = leads.filter(l => validateWhatsAppNumber(l.phone)).length;

  // --- EFFECTS ---
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('mapleads_onboarding_seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('mapleads_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  // --- ACTIONS ---

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

      const results = await searchBusinesses(scrapeCategory, scrapeLocation, scrapeMode, excludedNames);
      
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
      setLastScrapeParams({ category: scrapeCategory, location: scrapeLocation });

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
      ? <ArrowUp size={14} className="ml-1 text-indigo-600" />
      : <ArrowDown size={14} className="ml-1 text-indigo-600" />;
  };


  // --- COMPONENT RENDERERS ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Leads (Session)" value={sessionStats.totalGenerated} icon={Users} color="blue" />
        <StatsCard title="New Leads" value={newLeads} icon={MapPin} color="purple" />
        <StatsCard title="Contacted (Session)" value={sessionStats.totalContacted} icon={Mail} color="orange" />
        <StatsCard title="WhatsApp Ready" value={whatsappReady} icon={MessageCircle} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Lead Acquisition Source</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Extreme', value: leads.filter(l => l.source === 'Extreme Scrape').length },
                  { name: 'Deep', value: leads.filter(l => l.source === 'Deep Scrape').length },
                  { name: 'Fast', value: leads.filter(l => l.source === 'Fast Scrape').length },
                  { name: 'Manual', value: leads.filter(l => !l.source.includes('Scrape')).length },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} />
                  <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Recent History Table */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <History size={20} className="text-gray-400" />
               <h3 className="text-lg font-bold text-gray-800">Recent Searches</h3>
             </div>
             {searchHistory.length > 0 ? (
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase">
                     <tr>
                       <th className="px-4 py-3">Category</th>
                       <th className="px-4 py-3">Location</th>
                       <th className="px-4 py-3">Results</th>
                       <th className="px-4 py-3">Time</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {searchHistory.map((item) => (
                       <tr key={item.id} className="hover:bg-gray-50">
                         <td className="px-4 py-3 font-medium text-gray-900">{item.category}</td>
                         <td className="px-4 py-3 text-gray-500">{item.location}</td>
                         <td className="px-4 py-3 text-indigo-600 font-bold">+{item.resultsCount}</td>
                         <td className="px-4 py-3 text-gray-400 text-xs">
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

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Lead Status</h3>
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
                >
                  <Cell fill="#818CF8" />
                  <Cell fill="#34D399" />
                  <Cell fill="#FBBF24" />
                  <Cell fill="#9CA3AF" />
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-sm text-gray-500 mt-2 flex-wrap">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-400"></div> New</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Contacted</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Won</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-400"></div> Skipped</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScraper = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4 text-indigo-600">
            <MapPin size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Google Maps Lead Scraper</h2>
          <p className="text-gray-500 mt-2">Find business emails and phone numbers instantly using AI.</p>
        </div>

        <form onSubmit={handleScrape} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Business Keyword</label>
              <input 
                type="text" 
                placeholder="e.g. Dentists, Marketing Agencies, Cafes" 
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                value={scrapeCategory}
                onChange={(e) => setScrapeCategory(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Target Location</label>
              <input 
                type="text" 
                placeholder="e.g. Downtown Los Angeles, CA" 
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                value={scrapeLocation}
                onChange={(e) => setScrapeLocation(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="text-sm font-medium text-gray-700 mb-3 block">Scraping Intensity</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* FAST */}
              <label className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer transition text-center
                ${scrapeMode === 'fast' ? 'bg-white border-indigo-500 shadow-md transform scale-105' : 'bg-transparent border-gray-200 hover:bg-white'}
              `}>
                <input type="radio" name="mode" value="fast" className="hidden" checked={scrapeMode === 'fast'} onChange={() => setScrapeMode('fast')} />
                <div className={`p-3 rounded-full mb-3 ${scrapeMode === 'fast' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Zap size={24} />
                </div>
                <div className="font-bold text-gray-900">Fast Scan</div>
                <div className="text-xs text-gray-500 mt-1">~10 Results</div>
              </label>
              
              {/* DEEP */}
              <label className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer transition text-center
                ${scrapeMode === 'deep' ? 'bg-white border-purple-500 shadow-md transform scale-105' : 'bg-transparent border-gray-200 hover:bg-white'}
              `}>
                <input type="radio" name="mode" value="deep" className="hidden" checked={scrapeMode === 'deep'} onChange={() => setScrapeMode('deep')} />
                 <div className={`p-3 rounded-full mb-3 ${scrapeMode === 'deep' ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Layers size={24} />
                </div>
                <div className="font-bold text-gray-900">Deep Scan</div>
                <div className="text-xs text-gray-500 mt-1">50-99 Results</div>
              </label>

              {/* EXTREME */}
              <label className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer transition text-center
                ${scrapeMode === 'extreme' ? 'bg-white border-red-500 shadow-md transform scale-105' : 'bg-transparent border-gray-200 hover:bg-white'}
              `}>
                <input type="radio" name="mode" value="extreme" className="hidden" checked={scrapeMode === 'extreme'} onChange={() => setScrapeMode('extreme')} />
                 <div className={`p-3 rounded-full mb-3 ${scrapeMode === 'extreme' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Flame size={24} />
                </div>
                <div className="font-bold text-gray-900">Extreme Scan</div>
                <div className="text-xs text-gray-500 mt-1">200-500 Results</div>
              </label>

            </div>
          </div>

          {scrapeError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {scrapeError}
            </div>
          )}

          <div className="flex flex-col gap-3">
             <button 
                type="submit" 
                disabled={isScraping}
                className={`w-full py-4 rounded-xl text-white font-semibold shadow-lg transition-all flex items-center justify-center gap-2
                  ${isScraping ? 'bg-indigo-400 cursor-not-allowed' : 
                    scrapeMode === 'extreme' ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:shadow-xl' :
                    scrapeMode === 'deep' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-xl' :
                    'bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl'
                  }
                `}
              >
                {isScraping ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    {scrapeMode === 'extreme' ? 'Running Extreme Deep Search...' : 
                     scrapeMode === 'deep' ? 'Running Deep Search...' : 'Scanning...'}
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Start New {scrapeMode.charAt(0).toUpperCase() + scrapeMode.slice(1)} Scrape
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
                  className="w-full py-3 bg-white border border-indigo-200 text-indigo-700 font-medium rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={18} /> Load More Results for "{scrapeCategory}"
                </button>
              )}
          </div>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Higher intensity scans take longer to process but yield significantly more contact data.
          </p>
        </div>
      </div>
    </div>
  );

  const renderLeads = () => {
    const isAllSelected = leads.length > 0 && selectedLeadIds.size === leads.length;
    const isIndeterminate = selectedLeadIds.size > 0 && selectedLeadIds.size < leads.length;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {selectedLeadIds.size > 0 ? (
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-indigo-50 transition-colors animate-fade-in">
            <div className="flex items-center gap-4">
              <span className="font-bold text-indigo-900 bg-indigo-100 px-3 py-1 rounded-full text-sm">{selectedLeadIds.size} Selected</span>
              <button onClick={() => setSelectedLeadIds(new Set())} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                Cancel
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleBulkStatusChange('Contacted')} className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition shadow-sm">
                Mark Contacted
              </button>
              <button onClick={() => handleBulkStatusChange('New')} className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition shadow-sm">
                Mark New
              </button>
              <button onClick={() => handleBulkStatusChange('Skipped')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm">
                Mark Skipped
              </button>
              <div className="h-8 w-px bg-indigo-200 mx-1"></div>
              <button onClick={handleBulkExport} className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition flex items-center gap-1 shadow-sm">
                <Download size={14} /> Export
              </button>
              <button onClick={handleBulkDelete} className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition flex items-center gap-1 shadow-sm">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Leads Database <span className="text-gray-400 font-normal text-sm ml-2">({leads.length})</span></h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition">
                Filter
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-2">
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-6 py-4 w-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    checked={isAllSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition select-none" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Business Name {renderSortIcon('name')}</div>
                </th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition select-none" onClick={() => handleSort('address')}>
                  <div className="flex items-center">Location {renderSortIcon('address')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition select-none" onClick={() => handleSort('rating')}>
                  <div className="flex items-center">Rating {renderSortIcon('rating')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status {renderSortIcon('status')}</div>
                </th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedLeads.length > 0 ? sortedLeads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-gray-50 transition ${selectedLeadIds.has(lead.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleSelectLead(lead.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    <div className="text-xs text-gray-400">{lead.category}</div>
                  </td>
                  <td className="px-6 py-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <Mail size={12} className="text-gray-400" /> 
                      {lead.email || <span className="text-gray-300 italic">No Email</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <MessageCircle size={12} className="text-gray-400" /> 
                      {lead.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 truncate max-w-xs">{lead.address}</td>
                  <td className="px-6 py-4">
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-medium">
                      {lead.rating} ★
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border
                      ${lead.status === 'New' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                        lead.status === 'Contacted' ? 'bg-green-50 text-green-600 border-green-100' : 
                        lead.status === 'Skipped' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                        'bg-gray-50 text-gray-600 border-gray-100'}
                    `}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <button 
                      onClick={() => handleSendSingleWhatsApp(lead)}
                      className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition"
                      title="Open WhatsApp"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Sparkles size={20} className="text-indigo-600"/> Generate Campaign
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Campaign Topic / Goal</label>
            <input 
              type="text" 
              className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. Special offer for dental implants"
              value={emailTopic}
              onChange={(e) => setEmailTopic(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Tone</label>
            <select 
              className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={emailTone}
              onChange={(e) => setEmailTone(e.target.value)}
            >
              <option>Professional</option>
              <option>Friendly</option>
              <option>Urgent</option>
              <option>Persuasive</option>
            </select>
          </div>
          
          <button 
            onClick={handleGenerateEmail}
            disabled={isGeneratingEmail || !emailTopic}
            className="w-full py-3 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition flex items-center justify-center gap-2"
          >
            {isGeneratingEmail ? <Loader2 className="animate-spin" size={18} /> : <span className="flex items-center gap-2">✨ Generate with AI</span>}
          </button>
        </div>

        {generatedEmail && (
          <div className="mt-6 animate-fade-in">
            <div className="border border-indigo-100 rounded-lg overflow-hidden">
              <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100">
                <span className="text-xs font-bold text-indigo-600 uppercase">Preview</span>
              </div>
              <div className="p-4 space-y-3">
                <input 
                  value={generatedEmail.subject} 
                  onChange={(e) => setGeneratedEmail({...generatedEmail, subject: e.target.value})}
                  className="w-full font-bold text-gray-900 border-none focus:ring-0 p-0"
                />
                <div className="h-px bg-gray-100 w-full my-2"></div>
                <textarea 
                  value={generatedEmail.body.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, "")}
                  onChange={(e) => setGeneratedEmail({...generatedEmail, body: e.target.value})}
                  className="w-full h-40 text-gray-600 text-sm resize-none border-none focus:ring-0 p-0"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
               <button 
                onClick={handleCopyToWhatsApp}
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition flex items-center gap-2"
                title="Copy body to WhatsApp Composer"
               >
                 <MessageCircle size={16} /> Copy to WhatsApp
               </button>
               <button 
                 onClick={() => setGeneratedEmail(null)}
                 className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
               >
                 Discard
               </button>
               <button 
                onClick={saveCampaign}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm transition"
               >
                 Save Draft
               </button>
            </div>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
           <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Campaigns</h2>
           <div className="space-y-4">
             {campaigns.length > 0 ? campaigns.map(c => (
               <div key={c.id} className="p-4 border border-gray-100 rounded-lg hover:border-indigo-100 transition group">
                 <div className="flex justify-between items-start">
                   <div>
                     <h3 className="font-semibold text-gray-800">{c.name}</h3>
                     <p className="text-xs text-gray-400 mt-1">Created: {c.createdAt.toLocaleDateString()}</p>
                   </div>
                   <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">{c.status}</span>
                 </div>
               </div>
             )) : (
               <div className="text-center py-10 text-gray-400">
                 <Mail size={40} className="mx-auto mb-2 opacity-20" />
                 <p>No campaigns yet.</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );

  const renderWhatsApp = () => (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 text-white shadow-lg flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <MessageCircle size={32} /> WhatsApp Web Bridge
          </h2>
          <p className="opacity-90 max-w-xl">
            No API keys required. Use our smart session tool to open WhatsApp Web (Desktop) or App (Mobile).
          </p>
        </div>
        <div className="hidden lg:block bg-white/20 p-3 rounded-lg backdrop-blur-sm">
           <div className="flex items-center gap-2 text-sm font-medium">
             <Zap size={16} className="text-yellow-300" /> Fast & Free
           </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Left: Composer */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-full">
              <h3 className="font-bold text-gray-900 mb-4">Message Composer</h3>
              
              <div className="space-y-3">
                <textarea 
                  className="w-full h-40 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Type your message here..."
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                />
                
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
                       className="text-sm font-medium text-gray-500 hover:text-green-600 flex items-center gap-2 transition"
                     >
                       <Paperclip size={16} /> Attach Photo
                     </button>
                   ) : (
                     <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center overflow-hidden">
                           <ImageIcon size={20} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-xs font-medium text-gray-700 truncate">{waImage.name}</p>
                           <p className="text-[10px] text-gray-400">{(waImage.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => setWaImage(null)} className="text-gray-400 hover:text-red-500">
                           <XCircle size={16} />
                        </button>
                     </div>
                   )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button 
                  onClick={startBulkSession}
                  disabled={!waMessage || whatsappReady === 0}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-md
                    ${!waMessage || whatsappReady === 0 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02]'}
                  `}
                >
                  <Play size={18} fill="currentColor" /> Start Bulk Session
                </button>
                <div className="text-center text-xs text-gray-400 my-1">- OR -</div>
                <button 
                  onClick={exportWhatsAppList}
                  disabled={whatsappReady === 0}
                  className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Export Valid Numbers CSV
                </button>
              </div>
            </div>
         </div>

         {/* Right: List */}
         <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Valid Contacts ({whatsappReady})</h3>
                <span className="text-xs text-gray-500">Only showing numbers with 10-15 digits</span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {leads.filter(l => validateWhatsAppNumber(l.phone)).length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm text-xs uppercase text-gray-500 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leads.filter(l => validateWhatsAppNumber(l.phone)).map(l => (
                        <tr key={l.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                          <td className="px-4 py-3 font-mono text-gray-500">{l.phone}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${
                              l.status === 'Contacted' ? 'bg-green-50 text-green-600 border-green-100' :
                              l.status === 'Skipped' ? 'bg-red-50 text-red-600 border-red-100' :
                              'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {l.status === 'Contacted' ? 'Sent' : l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button 
                              onClick={() => handleSendSingleWhatsApp(l)}
                              className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition"
                              title="Open WhatsApp"
                            >
                              <ExternalLink size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                   <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                     <AlertCircle size={32} className="mb-2 opacity-50"/>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="bg-gray-900 p-6 flex justify-between items-center text-white shrink-0">
             <div>
               <h3 className="font-bold text-lg flex items-center gap-2">
                 <Zap className="text-yellow-400" size={20} fill="currentColor" />
                 Bulk Session
               </h3>
               <p className="text-gray-400 text-xs mt-1">Don't close this window while sending</p>
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
               className="p-2 hover:bg-gray-800 rounded-full transition cursor-pointer text-gray-400 hover:text-white"
             >
               <X size={20} />
             </button>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="bg-gray-100 w-full border-b border-gray-200">
            <div className="flex justify-between px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
               <span>{Math.round(progress)}% Complete</span>
               <span>{currentBulkIndex + 1} / {bulkQueue.length}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200">
              <div className="h-full bg-green-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ width: `${Math.max(5, progress)}%` }}></div>
            </div>
          </div>

          {/* Queue Strip (New) */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between text-xs shrink-0">
             <div className="flex-1 min-w-0 pr-2 opacity-60">
                <span className="block uppercase text-[10px] font-bold text-gray-400 mb-0.5">Previous</span>
                <div className="truncate font-medium text-gray-700">
                  {prevLead ? (
                    <span className="flex items-center gap-1"><CheckCircle size={10} className="text-green-500"/> {prevLead.name}</span>
                  ) : <span className="text-gray-400 italic">Start</span>}
                </div>
             </div>

             <div className="text-gray-300 mx-2">
               <ChevronRight size={16} />
             </div>

             <div className="flex-1 min-w-0 pl-2 text-right">
                <span className="block uppercase text-[10px] font-bold text-gray-400 mb-0.5">Up Next</span>
                <div className="truncate font-medium text-gray-600">
                  {nextLead ? nextLead.name : <span className="text-gray-400 italic">Finish</span>}
                </div>
             </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center flex-1 overflow-y-auto">
             
             {/* Main Card */}
             <div className="mb-8 relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold mb-4 border border-blue-100">
                  <Loader2 size={12} className="animate-spin" /> Ready to Send
                </div>
                
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{currentLead.name}</h2>
                <div className="inline-block mt-2 px-4 py-1.5 bg-gray-100 rounded-lg text-lg font-mono text-gray-700 border border-gray-200 font-medium">
                  {currentLead.phone}
                </div>
             </div>

             {waImage && (
               <div className={`mb-6 text-xs p-3 rounded-xl border flex items-center justify-center gap-3 text-left
                 ${canUseNativeShare 
                   ? 'bg-blue-50 text-blue-800 border-blue-100' 
                   : 'bg-amber-50 text-amber-800 border-amber-100'}
               `}>
                 {canUseNativeShare ? <Share2 size={18} className="shrink-0" /> : <Copy size={18} className="shrink-0" />}
                 <div>
                   <p className="font-bold mb-0.5">{canUseNativeShare ? "Image Sharing Active" : "Image Auto-Copy Active"}</p>
                   <p className="opacity-80">
                     {canUseNativeShare 
                       ? "Click Open → Select WhatsApp in share sheet."
                       : "Image copied to clipboard. Paste (Ctrl+V) in chat."}
                   </p>
                 </div>
               </div>
             )}

             <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto w-full">
                <button 
                  onClick={handleBulkOpenWhatsApp}
                  className="group w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg hover:shadow-green-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <span className="bg-white/20 p-1 rounded-full"><ExternalLink size={20} /></span>
                  <span>1. Open WhatsApp</span>
                </button>

                <div className="flex gap-3">
                   <button 
                     onClick={() => handleBulkNext('Contacted')}
                     className="flex-1 py-3 bg-white border-2 border-indigo-100 text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50 font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
                   >
                     <Check size={18} /> 2. Next
                   </button>
                   <button 
                     onClick={() => handleBulkNext('Skipped')}
                     className="px-4 py-3 border-2 border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 font-medium rounded-xl transition flex items-center justify-center active:scale-[0.98]"
                     title="Skip this contact"
                   >
                     <XSquare size={20} />
                   </button>
                </div>
             </div>
             
             <p className="mt-8 text-xs text-gray-400 max-w-xs mx-auto">
                Step 1 opens the chat. Step 2 marks it as done and loads the next person.
             </p>
          </div>

        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="flex min-h-screen bg-gray-50 relative">
      
      {/* Watermark */}
      <div className="fixed bottom-2 right-2 z-40 pointer-events-none opacity-40 hover:opacity-100 transition-opacity select-none">
        <span className="text-[10px] font-medium text-slate-500 bg-white/50 backdrop-blur-[2px] px-2 py-1 rounded-md border border-slate-100/50">
          Made with ❤️ by Sardar Toheed
        </span>
      </div>

      {/* Modals */}
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}
      {renderBulkSessionModal()}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              M
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">MapLeads IO</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 mt-4">
            <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} />
            <NavItem icon={Search} label="Map Scraper" active={view === 'scraper'} onClick={() => { setView('scraper'); setIsSidebarOpen(false); }} />
            <NavItem icon={Users} label="Leads" active={view === 'leads'} onClick={() => { setView('leads'); setIsSidebarOpen(false); }} />
            <NavItem icon={Mail} label="Generate Campaigns" active={view === 'campaigns'} onClick={() => { setView('campaigns'); setIsSidebarOpen(false); }} />
            <NavItem icon={MessageCircle} label="WhatsApp Tools" active={view === 'whatsapp'} onClick={() => { setView('whatsapp'); setIsSidebarOpen(false); }} />
          </nav>

          <div className="p-4 border-t border-gray-100">
             <div className="bg-indigo-50 rounded-xl p-4">
               <div className="flex items-center gap-3 mb-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-semibold text-indigo-900">System Online</span>
               </div>
               <p className="text-xs text-indigo-700/70">
                 Gemini 2.5 Active
               </p>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          
          <div className="ml-auto flex items-center gap-4">
             <div className="hidden sm:flex items-center text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
               <span className="mr-2">Credit Balance:</span>
               <span className="font-bold text-gray-900">Unlimited</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs cursor-pointer shadow-md shadow-indigo-200">
               JS
             </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
             <div className="mb-8">
               <h1 className="text-2xl font-bold text-gray-900 capitalize">
                 {view === 'scraper' ? 'Lead Scraper' : view === 'campaigns' ? 'Generate Campaigns' : view.replace('-', ' ')}
               </h1>
               <p className="text-gray-500 text-sm mt-1">
                 {view === 'dashboard' && 'Overview of your marketing performance'}
                 {view === 'scraper' && 'Extract data from Google Maps in seconds'}
                 {view === 'leads' && 'Manage and organize your gathered contacts'}
                 {view === 'campaigns' && 'Create content for emails or WhatsApp messages using AI'}
                 {view === 'whatsapp' && 'Prepare lists for mobile marketing'}
               </p>
             </div>

             {view === 'dashboard' && renderDashboard()}
             {view === 'scraper' && renderScraper()}
             {view === 'leads' && renderLeads()}
             {view === 'campaigns' && renderCampaigns()}
             {view === 'whatsapp' && renderWhatsApp()}
          </div>
        </div>
      </main>
      <Analytics />
    </div>
  );
};

// Helper Component for Navigation
const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
      ${active 
        ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }
    `}
  >
    <Icon size={18} className={active ? 'text-indigo-600' : 'text-gray-400'} />
    {label}
  </button>
);

export default App;