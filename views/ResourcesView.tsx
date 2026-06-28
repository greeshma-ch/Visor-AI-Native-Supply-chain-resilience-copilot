
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, BookOpen, FileText, Globe, Search, ArrowRight, ExternalLink, X, Download, Printer, Loader2, ShieldAlert, FileCheck, ChevronDown, FileDown, Archive, Zap, Lock } from 'lucide-react';
import { HISTORICAL_ARCHIVE_2024 } from '../constants';
import { generateResourceBriefing, generateResourceDocument } from '../services/apiClient';
import { Disruption, Supplier, RiskStatus, User } from '../types';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';

interface ResourceBriefing {
  summary: string;
  keyPoints: string[];
  status: string;
}

interface ResourceDocument {
  title: string;
  summary: string;
  keyPoints: string[];
  executiveSummary: string;
  detailedAnalysis: string;
  riskAssessment: string;
  operationalProtocol: string;
  mitigationStrategies: string;
  classification: string;
}

interface Resource {
  id: number;
  title: string;
  type: 'PDF' | 'Report' | 'Manual' | 'Link';
  date: string;
  category: string;
  url?: string;
  location?: string;
}

interface ResourcesViewProps {
  user: User;
  onBack: () => void;
  context?: { title: string; sources: { title: string; uri: string }[] } | null;
  disruptions?: Disruption[];
  suppliers?: Supplier[];
}

const ResourcesView: React.FC<ResourcesViewProps> = ({ user, onBack, context, disruptions = [], suppliers = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewingResource, setViewingResource] = useState<Resource | null>(null);
  const [hoveredResourceId, setHoveredResourceId] = useState<number | null>(null);
  
  // AI States
  const [briefings, setBriefings] = useState<Record<number, ResourceBriefing>>({});
  const [activeDocument, setActiveDocument] = useState<ResourceDocument | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (context?.title === "VISOR ARCHIVAL VAULT") {
      setSelectedCategory('archives');
    }
  }, [context]);

  const recentResources: Resource[] = useMemo(() => {
    // 1. Map current disruptions to resources
    const realTimeSignals: Resource[] = disruptions
      .filter(d => d.title && d.location)
      .map((d, index) => ({
        id: 5000 + index,
        title: d.title,
        type: 'Report' as const,
        date: 'Real-time',
        category: 'intelligence',
        location: d.location
      }));

    const base = [
      // 2026 - Current
      { id: 1, title: '2026 Global Logistics Resilience Strategy', type: 'PDF', date: 'Mar 2026', category: 'reports', location: 'Global' },
      { id: 2, title: 'Hsinchu Semiconductor Hub: Q1 2026 Risk Matrix', type: 'Report', date: 'Feb 2026', category: 'reports', location: 'Taiwan' },
      { id: 3, title: 'VISOR v3.0 Operational Manual', type: 'Manual', date: 'Jan 2026', category: 'handbooks', location: 'System' },
      { id: 4, title: 'Live Maritime Traffic & Congestion Index', type: 'Link', date: 'Real-time', category: 'geospatial', url: 'https://www.marinetraffic.com', location: 'Global' },
      { id: 5, title: '2026 Arctic Trade Route Feasibility Study', type: 'Report', date: 'Mar 2026', category: 'reports', location: 'Arctic Circle' },
      
      // 2025 - Recent
      { id: 6, title: '2025 Annual Supply Chain Vulnerability Audit', type: 'PDF', date: 'Dec 2025', category: 'reports', location: 'Global' },
      { id: 7, title: 'Standard Operating Procedures: Cyber-Resilience', type: 'Manual', date: 'Oct 2025', category: 'handbooks', location: 'Global' },
      { id: 8, title: 'Red Sea Maritime Security Protocol v2.1', type: 'Manual', date: 'Aug 2025', category: 'handbooks', location: 'Red Sea' },
      { id: 9, title: 'NOAA Climate Impact Forecast 2025-2030', type: 'Link', date: 'Jul 2025', category: 'geospatial', url: 'https://www.noaa.gov', location: 'Global' },
      
      // 2024 Intelligence Archive
      ...HISTORICAL_ARCHIVE_2024.map(res => ({
        ...res,
        title: `2024 ARCHIVE: ${res.title.replace('ARCHIVE: ', '').replace('CASE STUDY: ', '')}`,
        category: 'archives'
      }))
    ] as Resource[];

    let contextResources: Resource[] = [];
    if (context) {
      if (context.sources && context.sources.length > 0) {
        contextResources = context.sources.map((s, i) => ({
          id: 100 + i,
          title: s.title,
          type: 'Link',
          date: 'Recent',
          category: 'reports',
          url: s.uri
        }));
      } else if (context.title) {
        // If we have a title but no sources, check if it's already in base
        const exists = base.some(r => r.title === context.title);
        if (!exists) {
          contextResources = [{
            id: 999,
            title: context.title,
            type: 'Report',
            date: 'Real-time',
            category: 'reports',
            location: 'Active Node'
          }];
        }
      }
    }

    const combined = [...realTimeSignals, ...contextResources, ...base];
    const unique = new Map<string, Resource>();
    combined.forEach(res => {
      if (!unique.has(res.title)) {
        unique.set(res.title, res);
      }
    });

    return Array.from(unique.values());
  }, [context, disruptions]);

  const categories = useMemo(() => {
    const counts = recentResources.reduce((acc, res) => {
      const title = res.title || '';
      const isArchive = title.includes('ARCHIVE') || title.includes('CASE STUDY');
      const catId = isArchive ? 'archives' : (res.category || 'reports');
      acc[catId] = (acc[catId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { title: 'Linked Intelligence', count: counts.intelligence || 0, icon: Zap, id: 'intelligence' },
      { title: 'Technical Briefs', count: counts.reports || 0, icon: FileText, id: 'reports' },
      { title: 'Global Handbooks', count: counts.handbooks || 0, icon: BookOpen, id: 'handbooks' },
      { title: '2024 Archive', count: counts.archives || 0, icon: Archive, id: 'archives' },
    ];
  }, [recentResources]);

  const filteredResources = useMemo(() => {
    return recentResources.filter(res => {
      const title = res.title || '';
      const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
      const isHistorical = title.includes('ARCHIVE') || title.includes('CASE STUDY');
      const resourceCat = isHistorical ? 'archives' : (res.category || 'reports');
      
      const matchesCategory = selectedCategory 
        ? resourceCat === selectedCategory 
        : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, recentResources]);

  const handleResourceClick = async (res: Resource) => {
    if (res.url) {
      window.open(res.url, '_blank');
    } else {
      setViewingResource(res);
      setIsLoadingDoc(true);
      // Find matching disruption to ensure consistency
      const matchingDisruption = disruptions.find(d => d.title === res.title || d.location === res.location);
      const doc = await generateResourceDocument(res.title, res.location || 'Global', res.type, matchingDisruption?.summary);
      setActiveDocument(doc);
      setIsLoadingDoc(false);
    }
  };

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleHover = (res: Resource) => {
    if (res.type === 'Link') return;
    setHoveredResourceId(res.id);
    
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Only trigger briefing if user stays hovered for 400ms
    hoverTimeoutRef.current = setTimeout(async () => {
      if (!briefings[res.id]) {
        try {
          const matchingDisruption = disruptions.find(d => d.title === res.title || d.location === res.location);
          const briefing = await generateResourceBriefing(res.title, res.location || 'Global', res.type, matchingDisruption?.summary);
          setBriefings(prev => ({ ...prev, [res.id]: briefing }));
        } catch (error) {
          console.error("Failed to load briefing on hover:", error);
        }
      }
    }, 400);
  };

  const handleMouseLeave = () => {
    setHoveredResourceId(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const highlightedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (context && context.title) {
      // Clear filters to show all resources (including archives) as requested
      setSelectedCategory(null);
      setSearchQuery('');
      
      // Small delay to allow the list to render with the new context resource
      const timer = setTimeout(() => {
        if (highlightedRef.current) {
          highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [context?.title]);

  const handlePrint = () => {
    window.print();
  };

  const getResourceRiskLevel = (res: Resource): { label: string; color: string; bg: string; quote: string } => {
    // 1. Find matching disruption
    const matchingDisruption = disruptions.find(d => d.title === res.title || (res.location && d.location.includes(res.location)));
    
    let highestStatus: RiskStatus = RiskStatus.STABLE;

    if (matchingDisruption) {
      // Find impacted suppliers and their status
      matchingDisruption.impactedSuppliers.forEach(sid => {
        const s = suppliers.find(sup => sup.id === sid);
        if (s) {
          if (s.status === RiskStatus.RISKY) highestStatus = RiskStatus.RISKY;
          else if (s.status === RiskStatus.CAUTION && highestStatus !== RiskStatus.RISKY) highestStatus = RiskStatus.CAUTION;
        }
      });
    } else if (res.location && res.location !== 'Global') {
      // If no disruption but specific location, check suppliers in that location
      suppliers.forEach(s => {
        if (s.location.includes(res.location!)) {
          if (s.status === RiskStatus.RISKY) highestStatus = RiskStatus.RISKY;
          else if (s.status === RiskStatus.CAUTION && highestStatus !== RiskStatus.RISKY) highestStatus = RiskStatus.CAUTION;
        }
      });
    }

    switch (highestStatus as RiskStatus) {
      case RiskStatus.RISKY:
        return { 
          label: 'High', 
          color: 'text-rose-600', 
          bg: 'bg-rose-100', 
          quote: "Regional telemetry indicates a high-sensitivity environment requiring immediate node synchronization and proactive mitigation."
        };
      case RiskStatus.CAUTION:
        return { 
          label: 'Medium', 
          color: 'text-amber-600', 
          bg: 'bg-amber-100', 
          quote: "Operational caution advised. Telemetry shows minor variance in regional throughput requiring sustained monitoring."
        };
      default:
        return { 
          label: 'Low', 
          color: 'text-emerald-600', 
          bg: 'bg-emerald-100', 
          quote: "Node maintaining baseline stability. High-frequency telemetry confirms optimal throughput across all regional vectors."
        };
    }
  };

  const currentRisk = useMemo(() => {
    if (!viewingResource) return null;
    return getResourceRiskLevel(viewingResource);
  }, [viewingResource, disruptions, suppliers]);

  const handleExportTXT = () => {
    if (!activeDocument || !viewingResource) return;
    
    const separator = "=".repeat(60);
    const subSeparator = "-".repeat(60);
    
    const content = `
${separator}
VISOR GLOBAL INTELLIGENCE PROTOCOL
${separator}
CLASSIFICATION: ${activeDocument.classification}
DOCUMENT ID:    VS-RES-${viewingResource.id}-${viewingResource.date.match(/\d{4}/)?.[0] || '2026'}
TITLE:          ${viewingResource.title}
DATE:           ${viewingResource.date}
${separator}

01. SUMMARY & KEY POINTS
${subSeparator}
${activeDocument.summary}

KEY INTELLIGENCE VECTORS:
${activeDocument.keyPoints.map(kp => `[•] ${kp}`).join('\n')}

02. EXECUTIVE SUMMARY
${subSeparator}
${activeDocument.executiveSummary}

03. DETAILED ANALYSIS
${subSeparator}
${activeDocument.detailedAnalysis}

04. RISK ASSESSMENT
${subSeparator}
${activeDocument.riskAssessment}

05. OPERATIONAL PROTOCOL
${subSeparator}
${activeDocument.operationalProtocol}

06. MITIGATION STRATEGIES
${subSeparator}
${activeDocument.mitigationStrategies}

${separator}
GENERATED BY VISOR AI CORE v2.5.4
${subSeparator}
SYSTEM TIMESTAMP: ${new Date().toLocaleString()}
ORIGIN: GLOBAL INTELLIGENCE NETWORK
${separator}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${viewingResource.title.replace(/\s+/g, '_')}_Intelligence_Report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportOptions(false);
  };

  const handleExportPDF = async () => {
    if (!documentRef.current || !viewingResource) return;
    
    setIsLoadingDoc(true);
    try {
      const element = documentRef.current;
      
      // Capture the element with high quality
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
        width: element.offsetWidth,
        height: element.scrollHeight,
        onclone: (clonedDoc) => {
          // Find the cloned element by its data attribute
          const clonedElement = clonedDoc.querySelector('[data-export-container="true"]') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.animation = 'none';
            clonedElement.style.margin = '0';
            clonedElement.style.padding = '60px'; // Consistent padding for PDF
            
            // Ensure watermarks and other absolute elements are handled
            const watermark = clonedElement.querySelector('.watermark-text') as HTMLElement;
            if (watermark) watermark.style.opacity = '0.05';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Add a small margin to the PDF (5mm)
      const margin = 5;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;

      // Add the first page
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - margin);

      // Add subsequent pages if content exceeds one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - margin);
      }
      
      pdf.save(`${viewingResource.title.replace(/\s+/g, '_')}_Intelligence_Report.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
    } finally {
      setIsLoadingDoc(false);
      setShowExportOptions(false);
    }
  };

  if (viewingResource && (activeDocument || isLoadingDoc)) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-in fade-in duration-500 overflow-hidden">
        {/* Full Page Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-10 sticky top-0 z-50 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setViewingResource(null);
                setActiveDocument(null);
              }} 
              className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <FileText size={20} />
              </div>
              <div className="max-w-[150px] sm:max-w-md">
                <h3 className="text-sm sm:text-lg font-black text-slate-900 leading-tight truncate">{viewingResource.title}</h3>
                <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                  {viewingResource.type} • {viewingResource.date} • {activeDocument?.classification || 'CLASSIFIED'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="p-2 sm:p-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/10"
              >
                <Download size={16} /> <span className="hidden sm:inline">Export</span> <ChevronDown size={14} className={`transition-transform ${showExportOptions ? 'rotate-180' : ''}`} />
              </button>
              
              {showExportOptions && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-[10000] animate-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={handleExportPDF}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                  >
                    <FileDown size={16} className="text-rose-500" /> Export as PDF
                  </button>
                  <button 
                    onClick={handleExportTXT}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors border-t border-slate-100"
                  >
                    <FileText size={16} className="text-blue-500" /> Export as Text
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={handlePrint}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all flex items-center gap-2 text-xs font-bold"
            >
              <Printer size={16} /> <span className="hidden sm:inline">Print</span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1 sm:mx-2 hidden sm:block" />
            <button 
              onClick={() => {
                setViewingResource(null);
                setActiveDocument(null);
              }}
              className="p-2 sm:p-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white flex justify-center">
          {isLoadingDoc && !activeDocument ? (
            <div className="flex flex-col items-center justify-center gap-6 mt-20">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <ShieldAlert className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 animate-pulse" size={32} />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-slate-900 mb-2">Decrypting Asset...</p>
                <p className="text-slate-500 text-sm font-medium">Synchronizing with regional intelligence nodes</p>
              </div>
            </div>
          ) : activeDocument && (
            <div 
              ref={documentRef}
              data-export-container="true"
              className="w-full max-w-5xl bg-white p-8 sm:p-16 lg:p-24 min-h-screen text-slate-900 animate-in slide-in-from-bottom-10 duration-700 relative"
            >
              {/* Watermark */}
              <div className="watermark-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw] font-black text-slate-100/50 -rotate-12 pointer-events-none select-none uppercase tracking-tighter z-0">
                VISOR
              </div>

              <div className="relative z-10">
                <div className="border-b-4 border-slate-900 pb-8 mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase mb-2">Intelligence Brief</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Global Intelligence Protocol // {activeDocument.classification}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document ID</p>
                    <p className="text-sm font-bold">VS-RES-{viewingResource.id}-{viewingResource.date.match(/\d{4}/)?.[0] || '2026'}</p>
                  </div>
                </div>

                <div className="space-y-16">
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm">01</div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight border-b-2 border-slate-900 flex-1 pb-1">Summary & Key Points</h2>
                    </div>
                    <div className="space-y-6">
                      <p className="text-lg leading-relaxed text-slate-700 font-medium italic">
                        {activeDocument.summary}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeDocument.keyPoints.map((kp, i) => (
                          <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl min-h-[80px]">
                            <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                            <p className="text-sm font-bold text-slate-600 leading-snug">{kp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm">02</div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight border-b-2 border-slate-900 flex-1 pb-1">Executive Summary</h2>
                    </div>
                    <div className="text-lg leading-relaxed text-slate-700 font-medium markdown-body">
                      <Markdown>{activeDocument.executiveSummary}</Markdown>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm">03</div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight border-b-2 border-slate-900 flex-1 pb-1">Detailed Analysis</h2>
                    </div>
                    <div className="text-lg leading-relaxed text-slate-700 font-medium markdown-body">
                      <Markdown>{activeDocument.detailedAnalysis}</Markdown>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm">04</div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight border-b-2 border-slate-900 flex-1 pb-1">Risk Assessment</h2>
                    </div>
                    <div className={`bg-slate-50 p-8 border-l-8 ${currentRisk?.label === 'High' ? 'border-rose-600 font-bold text-rose-900 bg-rose-50' : currentRisk?.label === 'Medium' ? 'border-amber-600 text-amber-900 bg-amber-50' : 'border-slate-900 text-slate-600'} italic mb-8 text-lg`}>
                      "{currentRisk?.quote || "Regional telemetry indicates a high-sensitivity environment requiring immediate node synchronization and proactive mitigation."}"
                    </div>
                    <div className="text-lg leading-relaxed text-slate-700 font-medium markdown-body">
                      <Markdown>{activeDocument.riskAssessment}</Markdown>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm">05</div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight border-b-2 border-slate-900 flex-1 pb-1">Operational Protocol</h2>
                    </div>
                    <div className="text-lg leading-relaxed text-slate-700 font-medium markdown-body">
                      <Markdown>{activeDocument.operationalProtocol}</Markdown>
                    </div>
                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="p-6 border-2 border-slate-900 rounded-xl flex items-center gap-4 bg-slate-50">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                          <FileCheck size={28} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                          <p className="text-sm font-black uppercase">Protocol Verified</p>
                        </div>
                      </div>
                      <div className={`p-6 border-2 border-slate-900 rounded-xl flex items-center gap-4 ${currentRisk?.bg || 'bg-slate-50'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${currentRisk?.label === 'High' ? 'bg-rose-200 text-rose-600' : currentRisk?.label === 'Medium' ? 'bg-amber-200 text-amber-600' : 'bg-emerald-200 text-emerald-600'}`}>
                          <ShieldAlert size={28} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assessment</p>
                          <p className={`text-sm font-black uppercase ${currentRisk?.color || 'text-slate-900'}`}>Risk Level: {currentRisk?.label || 'High'}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm">06</div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight border-b-2 border-slate-900 flex-1 pb-1">Mitigation Strategies</h2>
                    </div>
                    <div className="text-lg leading-relaxed text-slate-700 font-medium markdown-body">
                      <Markdown>{activeDocument.mitigationStrategies}</Markdown>
                    </div>
                  </section>

                  <div className="mt-32 pt-12 border-t-2 border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-8 opacity-60">
                    <div className="flex gap-6">
                      <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center font-black text-slate-400 text-xl">CG</div>
                      <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center font-black text-slate-400 text-xl">AI</div>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] mb-2">Classified Intelligence // NOFORN</p>
                      <p className="text-[10px] font-medium uppercase tracking-widest">Generated by VISOR AI Core v2.5.4 // {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-slate-400 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">Resource Center</h2>
          <p className="text-slate-500 font-medium text-xs sm:text-base uppercase tracking-widest mt-1">Global documentation and regional intelligence assets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
        {categories.map((cat) => {
          return (
            <button 
              key={cat.id} 
              onClick={() => {
                setSelectedCategory(selectedCategory === cat.id ? null : cat.id);
              }}
              className={`p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[3rem] border transition-all duration-500 group text-left relative overflow-hidden ${
                selectedCategory === cat.id 
                  ? 'bg-blue-600/5 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.2)]' 
                  : 'bg-[#070b14] border-white/[0.03] hover:border-blue-500/20'
              }`}
            >
              {selectedCategory === cat.id && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] -mr-16 -mt-16" />
              )}
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-8 sm:mb-12 group-hover:scale-110 transition-all duration-500 ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.5)]' : 'bg-[#0a1224] text-blue-500 border border-blue-500/10'
              }`}>
                <cat.icon size={28} />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 uppercase tracking-tight leading-tight">{cat.title}</h3>
                  <p className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{cat.count} Active Assets</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-[#0a0f1c] rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight">
                {selectedCategory ? categories.find(c => c.id === selectedCategory)?.title : 'Intelligence Library'}
              </h3>
              {(selectedCategory || context) && (
                <button 
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                    if (context) onBack(); // Clear context
                  }}
                  className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 flex items-center gap-1"
                >
                  <X size={12} /> Reset View
                </button>
              )}
            </div>
            {context && (
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Linked to: <span className="text-blue-400">{context.title}</span>
              </div>
            )}
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <input 
              type="text" 
              placeholder="Search archive..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-blue-600 transition-all font-medium" 
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-6 sm:p-8 min-h-[300px] relative">
          {filteredResources.length > 0 ? (
            filteredResources.map((res) => {
              const isHighlighted = context?.title === res.title;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={res.id} 
                  ref={isHighlighted ? highlightedRef : null}
                  onClick={() => {
                    handleResourceClick(res);
                  }}
                  onMouseEnter={() => {
                    handleHover(res);
                  }}
                  onMouseLeave={handleMouseLeave}
                  className={`relative p-6 bg-white/5 rounded-3xl border transition-all cursor-pointer group flex flex-col h-full overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 ${
                    isHighlighted 
                      ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.2)] ring-2 ring-blue-500/50' 
                      : 'border-white/10 hover:border-blue-500/50 hover:bg-white/[0.08]'
                  }`}
                >
                  {isHighlighted && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-blue-600 text-[8px] font-black text-white uppercase tracking-widest rounded-bl-xl z-20 animate-pulse">
                      Linked Intelligence
                    </div>
                  )}
                  {/* Briefing Overlay */}
                {hoveredResourceId === res.id && (
                  <div className="absolute inset-0 z-10 bg-[#0a0f1c]/90 backdrop-blur-sm p-6 flex flex-col animate-in slide-in-from-bottom-full duration-300 border border-blue-500/50">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Intelligence Briefing</p>
                        <h4 className="text-xs font-black text-white uppercase truncate max-w-[150px]">{res.title}</h4>
                      </div>
                      {res.location && (
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                          {res.location}
                        </span>
                      )}
                    </div>
                    
                    {!briefings[res.id] ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Synchronizing AI Node...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                          <p className="text-xs text-slate-300 leading-relaxed font-medium mb-4">
                            {briefings[res.id].summary}
                          </p>
                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Key Intelligence Vectors:</p>
                            <ul className="space-y-1.5">
                              {briefings[res.id].keyPoints.map((point, i) => (
                                <li key={i} className="text-[10px] text-slate-400 flex items-start gap-2 leading-tight">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            {briefings[res.id].status}
                          </div>
                          <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">Click to View Full Asset</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                    {res.type === 'Link' ? <ExternalLink size={20} /> : <FileText size={20} />}
                  </div>
                  <ArrowRight size={18} className="text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{res.type}</span>
                    <span className="text-[8px] font-medium text-slate-600 uppercase tracking-widest">{res.date}</span>
                  </div>
                  <h4 className="text-base font-bold text-white leading-tight group-hover:text-blue-400 transition-colors">{res.title}</h4>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Access Protocol</span>
                  <span className="text-[9px] font-bold uppercase text-blue-500">
                    Authorized
                  </span>
                </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="font-medium">No resources found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourcesView;
