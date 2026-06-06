import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Zap, Code, FileText, Search, CheckCircle, AlertTriangle, ArrowRight, Clipboard, Copy } from 'lucide-react';

export const SEOOptimizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'meta' | 'checklist' | 'blog'>('meta');
  
  // Tab 1: AI Meta Tag & Schema Generator
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('LocalBusiness');
  const [targetLocation, setTargetLocation] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    metaTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    schemaMarkup: string;
  } | null>(null);

  // Tab 3: AI SEO Blog Outliner
  const [blogTopic, setBlogTopic] = useState('');
  const [blogKeywords, setBlogKeywords] = useState('');
  const [isGeneratingBlog, setIsGeneratingBlog] = useState(false);
  const [generatedBlog, setGeneratedBlog] = useState<string>('');

  // Tab 2: Interactive Real-Time Checklist
  const [checklist, setChecklist] = useState([
    { id: 1, category: 'Technical', text: 'Install SSL Certificate (HTTPS website)', checked: true, desc: 'Secures user data and is a direct Ranking Factor.' },
    { id: 2, category: 'Technical', text: 'Create XML Sitemap & robots.txt', checked: false, desc: 'Helps search engine bots find, crawl, and index your website pages.' },
    { id: 3, category: 'On-Page', text: 'Optimize Meta Title (keep under 60 chars with main keyword)', checked: false, desc: 'The title displayed in search engine result pages.' },
    { id: 4, category: 'On-Page', text: 'Write Meta Description (keep under 160 chars containing keyword)', checked: false, desc: 'Snippet that summaries your page content for search results.' },
    { id: 5, category: 'On-Page', text: 'Use exactly one H1 tag per page', checked: true, desc: 'Identifies the main topic of your page to search bots.' },
    { id: 6, category: 'On-Page', text: 'Add descriptive Alt text to all images', checked: false, desc: 'Enables search engines to read images and rank them in Image Search.' },
    { id: 7, category: 'Local SEO', text: 'Add Schema Markup (JSON-LD LocalBusiness Schema)', checked: false, desc: 'Structures business details (address, phone, hours) for Google Local Map Pack.' },
    { id: 8, category: 'Local SEO', text: 'Claim & Optimize Google Business Profile', checked: true, desc: 'The single most critical ranking factor for local search queries.' },
    { id: 9, category: 'Performance', text: 'Optimize page speed & Core Web Vitals', checked: false, desc: 'Faster loading reduces bounce rates and is a major mobile ranking factor.' }
  ]);

  const toggleCheck = (id: number) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const getClient = () => {
    const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('API Key is missing. Please set your GEMINI_API_KEY in Settings.');
    }
    return new GoogleGenAI({ apiKey: key });
  };

  const handleGenerateMeta = async () => {
    if (!businessName) return;
    setIsGeneratingMeta(true);
    try {
      const ai = getClient();
      const prompt = `
        You are an elite Local SEO Architect. I will give you business details, and you must generate optimized Meta Tags and a complete JSON-LD Schema markup block.
        
        Business Name: ${businessName}
        Business Type: ${businessType}
        Target Location: ${targetLocation}
        Primary Keywords: ${keywords}
        
        Requirements:
        1. metaTitle: Formulate a highly optimized title tag under 60 characters (e.g., "Keyword | Business Name").
        2. metaDescription: Formulate a compelling meta description under 155 characters that induces clickthroughs.
        3. ogTitle: Optimized Open Graph title for social share.
        4. ogDescription: Optimized Open Graph description.
        5. schemaMarkup: Create a clean JSON-LD Schema representation for this business type. Include name, description, address outline, location, rating mock (e.g., 4.8), and relevant category details. Output as structured JSON (NOT stringified inside a string).

        Return ONLY a JSON response matching this schema:
        {
          "metaTitle": "string",
          "metaDescription": "string",
          "ogTitle": "string",
          "ogDescription": "string",
          "schemaMarkup": "object or formatting string of JSON-LD"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      let responseText = response.text || '{}';
      if (!responseText || responseText === 'undefined' || responseText === 'null') {
        responseText = '{}';
      }
      const parsed = JSON.parse(responseText);
      
      const schemaString = typeof parsed.schemaMarkup === 'object' 
        ? JSON.stringify({ "@context": "https://schema.org", ...parsed.schemaMarkup }, null, 2)
        : parsed.schemaMarkup;

      setGeneratedResult({
        metaTitle: parsed.metaTitle || '',
        metaDescription: parsed.metaDescription || '',
        ogTitle: parsed.ogTitle || '',
        ogDescription: parsed.ogDescription || '',
        schemaMarkup: schemaString || ''
      });
    } catch (error: any) {
      console.error('Error in SEO Meta Generator:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  const handleGenerateBlog = async () => {
    if (!blogTopic) return;
    setIsGeneratingBlog(true);
    try {
      const ai = getClient();
      const prompt = `
        Create a comprehensive SEO-optimized Blog Article Outline and Content Playbook.
        Topic: ${blogTopic}
        Target Keywords to Optimize: ${blogKeywords}
        
        Your response must include:
        1. H1 Suggested Title - Compelling & Optimized.
        2. Suggested Meta Description.
        3. Complete Outline (H2 / H3 Headings structure).
        4. Target keyword usage placement recommendations (URI, Intro, body density, Alt tags).
        5. An introductory paragraph written beautifully in professional and persuasive style.
        
        Format beautifully using markdown.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      setGeneratedBlog(response.text || 'Unable to generate content outline.');
    } catch (error: any) {
      console.error('Error generating blog SEO schema:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsGeneratingBlog(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard successfully!');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-textMain flex items-center gap-2">
            <Zap className="text-amber-500 fill-amber-500" size={24} />
            AI SEO & GMB Optimizer
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Analyze, structure, and optimize local listings and B2B web pages to rank #1 on Google.
          </p>
        </div>
        
        <div className="flex gap-2 bg-gray-50 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('meta')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'meta'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <Code size={16} />
            Schema & Meta Tags
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'checklist'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <CheckCircle size={16} />
            SEO Audit Checklist
          </button>
          <button
            onClick={() => setActiveTab('blog')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'blog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <FileText size={16} />
            SEO Content Outline
          </button>
        </div>
      </div>

      {/* TAB 1: AI Meta Tag & Schema Generator */}
      {activeTab === 'meta' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-1.5 mb-1">
                <Zap size={16} className="text-blue-600 fill-blue-600" />
                Structured Schema Markup
              </h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                Google Maps uses structured local schema code to confirm geolocation matching. Enter your business details below to generate clean open-graph elements and JSON-LD markup recursively.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Business Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Dental Care Clinic"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm transition-shadow shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Business / Schema Type</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm transition-shadow shadow-xs"
                  >
                    <option value="LocalBusiness">Local Business (General)</option>
                    <option value="Dentist">Dentist Clinic</option>
                    <option value="FoodEstablishment">Restaurant / Cafe</option>
                    <option value="RealRealEstateAgent">Real Estate Agency</option>
                    <option value="LegalService">Lawyer / Law Firm</option>
                    <option value="MedicalBusiness">Medical / Health Clinic</option>
                    <option value="ProfessionalService">Consulting Agency</option>
                    <option value="Organization">Global Brand / Org</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Target Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Brooklyn, NY"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm transition-shadow shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Target Keywords (separated by commas)</label>
                <input
                  type="text"
                  placeholder="e.g. emergency dentist, teeth whitening Brooklyn"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm transition-shadow shadow-xs"
                />
              </div>

              <button
                onClick={handleGenerateMeta}
                disabled={isGeneratingMeta || !businessName}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm"
              >
                {isGeneratingMeta ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Generating Local SEO Code...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Generate SEO Schema & Meta tags
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6 flex flex-col h-full min-h-[450px]">
            {generatedResult ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 mb-2">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">SERP Snippet Preview</span>
                      <button
                        onClick={() => copyToClipboard(`<title>${generatedResult.metaTitle}</title>\n<meta name="description" content="${generatedResult.metaDescription}" />`)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Copy Tags"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <span className="text-xs text-green-700 block mb-0.5">https://yourdomain.com</span>
                    <h4 className="text-lg font-medium text-blue-800 hover:underline cursor-pointer leading-tight mb-1">
                      {generatedResult.metaTitle}
                    </h4>
                    <p className="text-xs text-gray-600 leading-snug">
                      {generatedResult.metaDescription}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 mb-2">
                      <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Twitter & OpenGraph Social Cards</span>
                      <button
                        onClick={() => copyToClipboard(`<meta property="og:title" content="${generatedResult.ogTitle}" />\n<meta property="og:description" content="${generatedResult.ogDescription}" />`)}
                        className="text-gray-400 hover:text-purple-600 transition-colors"
                        title="Copy OG Tags"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <h5 className="font-semibold text-xs text-gray-800 mb-0.5">{generatedResult.ogTitle}</h5>
                    <p className="text-xs text-gray-500 leading-snug">{generatedResult.ogDescription}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Structured JSON-LD Schema (LocalBusiness)</label>
                      <button
                        onClick={() => copyToClipboard(`<script type="application/ld+json">\n${generatedResult.schemaMarkup}\n</script>`)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs hover:bg-gray-100 rounded-lg text-blue-600 font-medium transition-colors border border-gray-200 bg-white shadow-3xs"
                      >
                        <Clipboard size={12} />
                        Copy Entire Script
                      </button>
                    </div>
                    <pre className="w-full text-[11px] font-mono p-4 bg-gray-900 text-emerald-400 rounded-xl overflow-x-auto max-h-[180px] border border-gray-800 shadow-inner">
                      {generatedResult.schemaMarkup}
                    </pre>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-500" />
                  Place this snippet in the header of your HTML to help Google crawler read structural data.
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border border-blue-100/50">
                  <Code size={28} />
                </div>
                <h4 className="font-semibold text-textMain mb-1">No optimization generated yet</h4>
                <p className="text-xs text-textSec max-w-xs leading-normal">
                  Fill in your local business details on the left and click execute to receive validated SEO-compliant schemas and meta configurations.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SEO Audit Checklist */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          <div className="bg-emerald-50/50 rounded-xl p-5 border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5 mb-1">
                <CheckCircle size={16} className="text-emerald-600 fill-emerald-100" />
                Audit Scoring Index
              </h3>
              <p className="text-xs text-emerald-700 leading-relaxed max-w-2xl">
                Check off optimized factors to track your technical preparedness score. Local business listings ranking factors are heavily influenced by direct on-site SEO indexing.
              </p>
            </div>
            <div className="bg-white px-5 py-3 rounded-xl border border-emerald-200/60 shadow-3xs text-center md:text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Current Score</span>
              <span className="text-2xl font-black text-emerald-600">
                {Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)}%
              </span>
              <span className="text-xs text-gray-500 block">({checklist.filter(c => c.checked).length} of {checklist.length} passed)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 shadow-3xs ${
                  item.checked
                    ? 'bg-white border-emerald-200/60 hover:bg-emerald-50/10'
                    : 'bg-white border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors border ${
                  item.checked
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  {item.checked && <CheckCircle size={14} className="stroke-[3]" />}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-textMain text-sm font-medium">{item.text}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      item.category === 'Technical' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                      item.category === 'On-Page' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      item.category === 'Local SEO' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                      'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-textSec leading-snug">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SEO Blog Outliner */}
      {activeTab === 'blog' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100">
              <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 mb-1">
                <AlertTriangle size={16} className="text-amber-600" />
                SEO Search Intent Alignment
              </h3>
              <p className="text-xs text-amber-700 leading-relaxed">
                Rank high on keywords your prospects use. Enter your topic and main target keywords and our model compiles structures with optimal paragraph structures to satisfy search bots.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Article Topic / Keyword Goal *</label>
                <input
                  type="text"
                  placeholder="e.g. How Dentist Clinics can get more online appointments recursively"
                  value={blogTopic}
                  onChange={(e) => setBlogTopic(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm transition-shadow shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Keywords to Optimize</label>
                <input
                  type="text"
                  placeholder="e.g. dentist appointment, dental SEO, clinic growth 2026"
                  value={blogKeywords}
                  onChange={(e) => setBlogKeywords(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm transition-shadow shadow-xs"
                />
              </div>

              <button
                onClick={handleGenerateBlog}
                disabled={isGeneratingBlog || !blogTopic}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm"
              >
                {isGeneratingBlog ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Writing Content Outline...
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Generate SEO Content outline
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6 flex flex-col h-full min-h-[450px]">
            {generatedBlog ? (
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                  <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">AI SEO Content Playbook</span>
                  <button
                    onClick={() => copyToClipboard(generatedBlog)}
                    className="flex items-center gap-1 text-xs hover:text-blue-600 transition-colors text-textSec font-medium border border-gray-200 bg-white px-2.5 py-1 rounded-lg shadow-3xs"
                  >
                    <Clipboard size={12} />
                    Copy Outline
                  </button>
                </div>
                <div className="flex-1 overflow-auto max-h-[350px] bg-white p-5 rounded-xl border border-gray-200 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap select-text markdown-body shadow-inner">
                  {generatedBlog}
                </div>
                <p className="text-[11px] text-gray-400 flex items-center gap-1 pt-2 border-t border-gray-150">
                  <CheckCircle size={14} className="text-emerald-500" />
                  Follow this structure to build high-converting traffic from localized organic search terms.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4 border border-amber-100/50">
                  <FileText size={28} />
                </div>
                <h4 className="font-semibold text-textMain mb-1">No blog outline generated yet</h4>
                <p className="text-xs text-textSec max-w-xs leading-normal">
                  Type an article topic and target keywords, then click execute to receive a highly structured search-friendly heading list and content architecture.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
