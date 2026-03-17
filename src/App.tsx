/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { LayoutDashboard, Table as TableIcon, Loader2, AlertCircle, RefreshCw, Calendar, Filter, X, BarChart3 } from 'lucide-react';
import { fetchSourceOfVisitData, fetchTSDataBifurcation, fetchPPPInScopeData, SourceOfVisitData, TSDataBifurcationRow, PPPInScopeRow } from './services/sheetService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parse, isWithinInterval, startOfDay, endOfDay, isValid, format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LabelList
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'visit-data' | 'ts-bifurcation' | 'ppp-in-scope' | 'overall'>('ts-bifurcation');
  const [data, setData] = useState<SourceOfVisitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tsData, setTsData] = useState<TSDataBifurcationRow[]>([]);
  const [tsLoading, setTsLoading] = useState(true);
  const [tsError, setTsError] = useState<string | null>(null);
  const [selectedTsRow, setSelectedTsRow] = useState<TSDataBifurcationRow | null>(null);
  const [graphClickType, setGraphClickType] = useState<string | null>(null);
  const [graphClickValue, setGraphClickValue] = useState<string | null>(null);
  const [graphClickedTickets, setGraphClickedTickets] = useState<TSDataBifurcationRow[]>([]);

  const [pppInScopeData, setPppInScopeData] = useState<PPPInScopeRow[]>([]);
  const [pppInScopeLoading, setPppInScopeLoading] = useState(true);
  const [pppInScopeError, setPppInScopeError] = useState<string | null>(null);
  const [selectedPppRow, setSelectedPppRow] = useState<PPPInScopeRow | null>(null);

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  const [tsStartDate, setTsStartDate] = useState<string>('');
  const [tsEndDate, setTsEndDate] = useState<string>('');
  const [selectedTsCustType, setSelectedTsCustType] = useState<string>('all');
  const [selectedTsTypeOfIssue, setSelectedTsTypeOfIssue] = useState<string>('all');
  const [selectedTsPppStatus, setSelectedTsPppStatus] = useState<string>('all');
  const [selectedTsStage, setSelectedTsStage] = useState<string>('all');
  const [tsSearchTerm, setTsSearchTerm] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSourceOfVisitData();
      setData(result);
    } catch (err) {
      setError('Failed to fetch data from Google Sheets. Please ensure the sheet is public.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTSData = async () => {
    setTsLoading(true);
    setTsError(null);
    try {
      const result = await fetchTSDataBifurcation();
      setTsData(result);
    } catch (err) {
      setTsError('Failed to fetch TS Data. Please ensure the sheet is public.');
      console.error(err);
    } finally {
      setTsLoading(false);
    }
  };

  const loadPPPInScopeData = async () => {
    setPppInScopeLoading(true);
    setPppInScopeError(null);
    try {
      const result = await fetchPPPInScopeData();
      setPppInScopeData(result);
    } catch (err) {
      setPppInScopeError('Failed to fetch PPP-In Scope Data. Please ensure the sheet is public.');
      console.error(err);
    } finally {
      setPppInScopeLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadTSData();
    loadPPPInScopeData();
  }, []);

  // Helper to parse dates from various formats
  const parseSheetDate = (dateStr: string) => {
    if (!dateStr) return null;
    // Try common formats
    const formats = ['MM/dd/yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'M/d/yyyy', 'd/M/yyyy'];
    for (const fmt of formats) {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
    // Fallback to native Date
    const native = new Date(dateStr);
    return isValid(native) ? native : null;
  };

  const uniqueSources = useMemo(() => {
    const sources = new Set(data.map(d => d.source).filter(Boolean));
    return Array.from(sources).sort();
  }, [data]);

  const uniqueTsCustTypes = useMemo(() => {
    const types = new Set(tsData.map(d => d.sellerCusttype).filter(Boolean));
    return Array.from(types).sort();
  }, [tsData]);

  const uniqueTsTypeOfIssues = useMemo(() => {
    const issues = new Set(tsData.map(d => d.typeOfIssue).filter(Boolean));
    return Array.from(issues).sort();
  }, [tsData]);

  const uniqueTsPppStatuses = useMemo(() => {
    const statuses = new Set(tsData.map(d => d.pppStatus).filter(Boolean));
    return Array.from(statuses).sort();
  }, [tsData]);

  const uniqueTsStages = useMemo(() => {
    const stages = new Set(tsData.map(d => d.ticketStage).filter(Boolean));
    return Array.from(stages).sort();
  }, [tsData]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Source Filter
      if (selectedSource !== 'all' && item.source !== selectedSource) {
        return false;
      }

      // Date Filter
      if (startDate || endDate) {
        const itemDate = parseSheetDate(item.date);
        if (!itemDate) return false;

        const start = startDate ? startOfDay(new Date(startDate)) : null;
        const end = endDate ? endOfDay(new Date(endDate)) : null;

        if (start && end) {
          return isWithinInterval(itemDate, { start, end });
        } else if (start) {
          return itemDate >= start;
        } else if (end) {
          return itemDate <= end;
        }
      }

      return true;
    });
  }, [data, startDate, endDate, selectedSource]);

  const filteredTsData = useMemo(() => {
    return tsData.filter(item => {
      if (tsStartDate || tsEndDate) {
        const itemDate = parseSheetDate(item.issueDate);
        if (!itemDate) return false;

        const start = tsStartDate ? startOfDay(new Date(tsStartDate)) : null;
        const end = tsEndDate ? endOfDay(new Date(tsEndDate)) : null;

        if (start && end) {
          return isWithinInterval(itemDate, { start, end });
        } else if (start) {
          return itemDate >= start;
        } else if (end) {
          return itemDate <= end;
        }
      }

      // Additional Filters
      if (selectedTsCustType !== 'all' && item.sellerCusttype !== selectedTsCustType) {
        return false;
      }
      if (selectedTsTypeOfIssue !== 'all' && item.typeOfIssue !== selectedTsTypeOfIssue) {
        return false;
      }
      if (selectedTsPppStatus !== 'all' && item.pppStatus !== selectedTsPppStatus) {
        return false;
      }
      if (selectedTsStage !== 'all' && item.ticketStage !== selectedTsStage) {
        return false;
      }

      // Search Filter
      if (tsSearchTerm) {
        const term = tsSearchTerm.toLowerCase();
        const searchableFields = [
          item.id,
          item.issueDate,
          item.closeDate,
          item.buyerGlid,
          item.againstSellerGlid,
          item.sellerCusttype,
          item.typeOfIssue,
          item.pppStatus,
          item.ticketStage,
          item.closingComment
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchableFields.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [tsData, tsStartDate, tsEndDate, selectedTsCustType, selectedTsTypeOfIssue, selectedTsPppStatus, selectedTsStage, tsSearchTerm]);

  const stats = {
    total: filteredData.length,
    uniqueGlids: new Set(filteredData.map(d => d.buyerGlid)).size,
    sources: new Set(filteredData.map(d => d.source)).size,
    // Help Page Analysis (Strictly from help.im source)
    identified: filteredData.filter(d => d.source.toLowerCase() === 'help.im' && /^\d+$/.test(d.buyerGlid)).length,
    unidentified: filteredData.filter(d => d.source.toLowerCase() === 'help.im' && d.buyerGlid.toLowerCase().includes('(not set)')).length,
    // VOC Data Analysis
    vocCallCenter: filteredData.filter(d => d.source === '9696').length,
    vocMails: filteredData.filter(d => d.source.toLowerCase().includes('mail')).length,
    vocSocial: filteredData.filter(d => 
      d.source.toLowerCase().includes('social') || 
      d.source.toLowerCase().includes('grievance') || 
      d.source.toLowerCase().includes('consumer help') || 
      d.source.toLowerCase().includes('appstore')
    ).length,
    // PPP Applicable Analysis
    pppYes: filteredData.filter(d => d.pppApplicable.toLowerCase() === 'yes').length,
    pppNo: filteredData.filter(d => d.pppApplicable.toLowerCase() === 'no').length,
    // Ticket Stage Analysis
    ticketStageCounts: filteredData.reduce((acc, d) => {
      const stage = d.ticketStage;
      if (stage && stage.toLowerCase() !== 'unassigned') {
        acc[stage] = (acc[stage] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>)
  };

  const chartData = useMemo(() => {
    const dateGroups: Record<string, Record<string, number>> = {};
    
    filteredData.forEach(item => {
      const d = item.date;
      if (!dateGroups[d]) {
        dateGroups[d] = {};
      }
      dateGroups[d][item.source] = (dateGroups[d][item.source] || 0) + 1;
    });

    return Object.entries(dateGroups)
      .map(([date, sources]) => ({
        date,
        ...sources,
        total: Object.values(sources).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => {
        const da = parseSheetDate(a.date) || new Date(0);
        const db = parseSheetDate(b.date) || new Date(0);
        return da.getTime() - db.getTime();
      });
  }, [filteredData]);

  const pieData = useMemo(() => {
    const sourceCounts: Record<string, number> = {};
    filteredData.forEach(item => {
      sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    });
    return Object.entries(sourceCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const issueTypeData = useMemo(() => {
    const issueCounts: Record<string, number> = {};
    filteredData.forEach(item => {
      const issue = item.typeOfIssue || 'Unspecified';
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    return Object.entries(issueCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const ticketStageData = useMemo(() => {
    const stageGroups: Record<string, Record<string, number>> = {};
    const issueTypes = new Set<string>();

    filteredData.forEach(item => {
      const stage = item.ticketStage;
      if (stage && stage.toLowerCase() !== 'unassigned') {
        if (!stageGroups[stage]) stageGroups[stage] = {};
        const issue = item.typeOfIssue || 'Unspecified';
        issueTypes.add(issue);
        stageGroups[stage][issue] = (stageGroups[stage][issue] || 0) + 1;
      }
    });

    const data = Object.entries(stageGroups).map(([name, issues]) => ({
      name,
      ...issues,
      total: Object.values(issues).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.total - a.total);

    return {
      data,
      issueTypes: Array.from(issueTypes).sort()
    };
  }, [filteredData]);

  const tsIssueTypeData = useMemo(() => {
    const issueCounts: Record<string, number> = {};
    filteredTsData.forEach(item => {
      const issue = item.typeOfIssue || 'Unspecified';
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    return Object.entries(issueCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTsData]);

  const tsSellerCusttypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTsData.forEach(item => {
      const key = item.sellerCusttype || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTsData]);

  const tsPppStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTsData.forEach(item => {
      const key = item.pppStatus || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTsData]);

  const tsTicketStageData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTsData.forEach(item => {
      const key = item.ticketStage || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTsData]);

  const tsClosingCommentData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTsData.forEach(item => {
      if (item.closingComment && item.closingComment.trim() !== '') {
        const key = item.closingComment.trim();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTsData]);

  const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#14B8A6', // Teal
    '#6366F1', // Indigo
    '#000000', // Black
    '#71717a', // Zinc
  ];

  const getChartColor = (index: number) => {
    return COLORS[index % COLORS.length];
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedSource('all');
  };

  const resetTsFilters = () => {
    setTsStartDate('');
    setTsEndDate('');
    setSelectedTsCustType('all');
    setSelectedTsTypeOfIssue('all');
    setSelectedTsPppStatus('all');
    setSelectedTsStage('all');
    setTsSearchTerm('');
  };

  const handleGraphClick = (type: string, value: string) => {
    setGraphClickType(type);
    setGraphClickValue(value);
    
    let filtered: TSDataBifurcationRow[] = [];
    
    switch(type) {
      case 'typeOfIssue':
        filtered = filteredTsData.filter(item => item.typeOfIssue === value);
        break;
      case 'sellerCusttype':
        filtered = filteredTsData.filter(item => item.sellerCusttype === value);
        break;
      case 'pppStatus':
        filtered = filteredTsData.filter(item => item.pppStatus === value);
        break;
      case 'ticketStage':
        filtered = filteredTsData.filter(item => item.ticketStage === value);
        break;
      case 'closingComment':
        filtered = filteredTsData.filter(item => item.closingComment === value);
        break;
      default:
        filtered = [];
    }
    
    setGraphClickedTickets(filtered);
  };

  const getSourceColor = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('google')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (s.includes('direct')) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (s.includes('social') || s.includes('facebook')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (s.includes('referral')) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const activeLoading = activeTab === 'visit-data' ? loading : activeTab === 'ts-bifurcation' ? tsLoading : activeTab === 'ppp-in-scope' ? pppInScopeLoading : loading;
  const activeError = activeTab === 'visit-data' ? error : activeTab === 'ts-bifurcation' ? tsError : activeTab === 'ppp-in-scope' ? pppInScopeError : error;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-1.5 rounded-lg shadow-blue-200 shadow-lg">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                Buyer's Payment Protection Plan Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Data
              </div>
              <button 
                onClick={activeTab === 'ts-bifurcation' ? loadTSData : activeTab === 'ppp-in-scope' ? loadPPPInScopeData : loadData}
                disabled={activeLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all text-xs font-semibold disabled:opacity-50 border border-blue-100"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", activeLoading && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Tabs in Header */}
          <div className="flex items-center gap-8 h-12">
            <button
              onClick={() => setActiveTab('ts-bifurcation')}
              className={cn(
                "h-full px-1 text-sm font-black transition-all flex items-center gap-2 relative",
                activeTab === 'ts-bifurcation'
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TableIcon className="w-4 h-4" />
              TS Data Bifurcation
              {activeTab === 'ts-bifurcation' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('ppp-in-scope')}
              className={cn(
                "h-full px-1 text-sm font-black transition-all flex items-center gap-2 relative",
                activeTab === 'ppp-in-scope'
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TableIcon className="w-4 h-4" />
              PPP-In Scope
              {activeTab === 'ppp-in-scope' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('visit-data')}
              className={cn(
                "h-full px-1 text-sm font-black transition-all flex items-center gap-2 relative",
                activeTab === 'visit-data'
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Visit Data
              {activeTab === 'visit-data' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('overall')}
              className={cn(
                "h-full px-1 text-sm font-black transition-all flex items-center gap-2 relative",
                activeTab === 'overall'
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Overall
              {activeTab === 'overall' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters Bar */}
        {activeTab === 'visit-data' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <span className="text-slate-300 text-xs font-bold">TO</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="w-full md:w-64">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Source Filter
                </label>
                <div className="relative">
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Sources</option>
                    {uniqueSources.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {(startDate || endDate || selectedSource !== 'all') && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all text-xs font-bold border border-transparent hover:border-red-100"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ts-bifurcation' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <div className="w-full md:col-span-2 lg:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Issue Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={tsStartDate}
                    onChange={(e) => setTsStartDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <span className="text-slate-300 text-xs font-bold">TO</span>
                  <input
                    type="date"
                    value={tsEndDate}
                    onChange={(e) => setTsEndDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Cust Type
                </label>
                <div className="relative">
                  <select
                    value={selectedTsCustType}
                    onChange={(e) => setSelectedTsCustType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Cust Types</option>
                    {uniqueTsCustTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Type of Issue
                </label>
                <div className="relative">
                  <select
                    value={selectedTsTypeOfIssue}
                    onChange={(e) => setSelectedTsTypeOfIssue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Issues</option>
                    {uniqueTsTypeOfIssues.map(issue => (
                      <option key={issue} value={issue}>{issue}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  PPP Status
                </label>
                <div className="relative">
                  <select
                    value={selectedTsPppStatus}
                    onChange={(e) => setSelectedTsPppStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All PPP Status</option>
                    {uniqueTsPppStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Stage
                </label>
                <div className="relative">
                  <select
                    value={selectedTsStage}
                    onChange={(e) => setSelectedTsStage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Stages</option>
                    {uniqueTsStages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Search Tickets
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tsSearchTerm}
                    onChange={(e) => setTsSearchTerm(e.target.value)}
                    placeholder="Search any field..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {(tsStartDate || tsEndDate || selectedTsCustType !== 'all' || selectedTsTypeOfIssue !== 'all' || selectedTsPppStatus !== 'all' || selectedTsStage !== 'all' || tsSearchTerm) && (
                <div className="w-full flex justify-start">
                  <button
                    onClick={resetTsFilters}
                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all text-xs font-bold border border-transparent hover:border-red-100"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          {activeLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Syncing with Sheet</p>
            </div>
          ) : activeError ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-6 px-6 text-center">
              <div className="bg-red-50 p-4 rounded-2xl shadow-inner">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-black text-slate-800 mb-2">Sync Failed</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{activeError}</p>
              </div>
              <button 
                onClick={activeTab === 'ts-bifurcation' ? loadTSData : activeTab === 'ppp-in-scope' ? loadPPPInScopeData : loadData}
                className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Retry Connection
              </button>
            </div>
          ) : activeTab === 'visit-data' ? (
            <div className="p-8 flex-1 flex flex-col gap-8">
              {/* Detailed Analysis Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Help Page Analysis */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-blue-600 rounded-full" />
                      Total Visits - Help Page
                    </h3>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 shadow-sm">
                      Total: {loading ? '...' : (stats.identified + stats.unidentified)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Identified Mode</p>
                      <p className="text-2xl font-black text-slate-800">{loading ? '...' : stats.identified}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Numeric GLIDs</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Un-Identified Mode</p>
                      <p className="text-2xl font-black text-slate-800">{loading ? '...' : stats.unidentified}</p>
                      <p className="text-[9px] text-slate-400 mt-1">(not set) GLIDs</p>
                    </div>
                  </div>
                </div>

                {/* VOC Data Analysis */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-emerald-600 rounded-full" />
                      VOC Data
                    </h3>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black border border-emerald-100 shadow-sm">
                      Total: {loading ? '...' : (stats.vocCallCenter + stats.vocMails + stats.vocSocial)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">9696-Call Center</p>
                      <p className="text-xl font-black text-slate-800">{loading ? '...' : stats.vocCallCenter}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mails</p>
                      <p className="text-xl font-black text-slate-800">{loading ? '...' : stats.vocMails}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Social/Appstore</p>
                      <p className="text-xl font-black text-slate-800">{loading ? '...' : stats.vocSocial}</p>
                    </div>
                  </div>
                </div>

                {/* PPP Applicable Analysis */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-violet-600 rounded-full" />
                      PPP Applicable
                    </h3>
                    <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-black border border-violet-100 shadow-sm">
                      Total: {loading ? '...' : (stats.pppYes + stats.pppNo)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Yes</p>
                      <p className="text-2xl font-black text-emerald-600">{loading ? '...' : stats.pppYes}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">No</p>
                      <p className="text-2xl font-black text-rose-400">{loading ? '...' : stats.pppNo}</p>
                    </div>
                  </div>
                </div>

                {/* Ticket Stage Analysis */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-amber-600 rounded-full" />
                      Ticket Stage Bifurcation Out Of
                    </h3>
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-black border border-amber-100 shadow-sm">
                      Total: {loading ? '...' : stats.total}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                    {Object.entries(stats.ticketStageCounts).map(([stage, count], idx) => (
                      <div key={stage} className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                        <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-0.5 leading-tight">{stage}</p>
                        <p className="text-lg font-black text-slate-900">{loading ? '...' : count}</p>
                      </div>
                    ))}
                    {Object.keys(stats.ticketStageCounts).length === 0 && (
                      <div className="col-span-2 py-4 text-center text-[10px] font-bold text-slate-400 uppercase">No Stage Data</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bar Chart Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-blue-500 rounded-full" />
                      Source Volume Over Time
                    </h3>
                    <p className="text-xs text-slate-500">Daily visit counts per source.</p>
                  </div>
                  
                  <div className="h-[350px] w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }}
                            dy={10}
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fontWeight: 800, fill: '#1E293B' }}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.5)' }}
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: '1px solid #F1F5F9', 
                              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: '700' }}
                          />
                          {uniqueSources.map((source, index) => (
                            <Bar 
                              key={source} 
                              dataKey={source} 
                              stackId="a" 
                              fill={getChartColor(index)} 
                              radius={index === uniqueSources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                              barSize={24}
                            >
                              {index === uniqueSources.length - 1 && (
                                <LabelList 
                                  dataKey="total" 
                                  position="top" 
                                  style={{ fontSize: '10px', fontWeight: '800', fill: '#1E293B' }} 
                                />
                              )}
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                        <BarChart3 className="w-12 h-12 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Data for Bar Chart</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie Chart Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      Source Market Share
                    </h3>
                    <p className="text-xs text-slate-500">Percentage distribution of all visits.</p>
                  </div>
                  
                  <div className="h-[350px] w-full">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: '1px solid #F1F5F9', 
                              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            align="center"
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '700' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                        <BarChart3 className="w-12 h-12 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Data for Pie Chart</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Issue Type Chart Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-amber-500 rounded-full" />
                      Analysis of Types of Issues
                    </h3>
                    <p className="text-xs text-slate-500">Distribution of different issue types reported.</p>
                  </div>
                  
                  <div className="h-[350px] w-full">
                    {issueTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={issueTypeData} 
                          layout="vertical"
                          margin={{ top: 5, right: 40, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#1E293B' }}
                            width={180}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: '1px solid #F1F5F9', 
                              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                          />
                          <Bar 
                            dataKey="value" 
                            radius={[0, 4, 4, 0]}
                            barSize={30}
                          >
                            <LabelList 
                              dataKey="value" 
                              position="right" 
                              style={{ fontSize: '10px', fontWeight: '800', fill: '#1E293B' }} 
                            />
                            {issueTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getChartColor(index + 2)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                        <BarChart3 className="w-12 h-12 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Data for Issue Type Analysis</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ticket Stage Chart Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-violet-500 rounded-full" />
                      Ticket Stage Distribution by Issue Type
                    </h3>
                    <p className="text-xs text-slate-500">Breakdown of stages by the type of issue reported.</p>
                  </div>
                  
                  <div className="h-[350px] w-full">
                    {ticketStageData.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={ticketStageData.data} 
                          layout="vertical"
                          margin={{ top: 5, right: 40, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#1E293B' }}
                            width={180}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: '1px solid #F1F5F9', 
                              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: '700' }}
                          />
                          {ticketStageData.issueTypes.map((issueType, index) => (
                            <Bar 
                              key={issueType} 
                              dataKey={issueType} 
                              stackId="a" 
                              fill={getChartColor(index + 5)} 
                              radius={[0, 0, 0, 0]}
                              barSize={30}
                            >
                              {index === ticketStageData.issueTypes.length - 1 && (
                                <LabelList 
                                  dataKey="total" 
                                  position="right" 
                                  style={{ fontSize: '10px', fontWeight: '800', fill: '#1E293B' }} 
                                />
                              )}
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                        <BarChart3 className="w-12 h-12 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Data for Ticket Stage Analysis</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PPP Details Table Section */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      PPP Details (Yes)
                    </h3>
                    <p className="text-xs text-slate-500">Detailed list of entries where PPP is applicable.</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="w-[10%] px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                        <th className="w-[12%] px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ticket ID</th>
                        <th className="w-[15%] px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Buyer GLID</th>
                        <th className="w-[15%] px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Source</th>
                        <th className="w-[18%] px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type of Issue</th>
                        <th className="w-[15%] px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stage</th>
                        <th className="w-auto px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">PPP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.filter(d => d.pppApplicable.toLowerCase() === 'yes').length > 0 ? (
                        filteredData.filter(d => d.pppApplicable.toLowerCase() === 'yes').map((row, idx) => (
                          <tr key={idx} className="group hover:bg-blue-50/30 transition-all">
                            <td className="w-[10%] px-8 py-4">
                              <span className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                                {row.date}
                              </span>
                            </td>
                            <td className="w-[12%] px-8 py-4">
                              <span className="text-xs font-bold text-slate-700">
                                {row.ticketId || '—'}
                              </span>
                            </td>
                            <td className="w-[15%] px-8 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-blue-50 text-blue-600 border-blue-100 shadow-sm transition-all">
                                {row.buyerGlid}
                              </span>
                            </td>
                            <td className="w-[15%] px-8 py-4">
                              <span className={cn(
                                "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm",
                                getSourceColor(row.source)
                              )}>
                                {row.source}
                              </span>
                            </td>
                            <td className="w-[18%] px-8 py-4">
                              <span className="text-xs font-semibold text-slate-500 italic">
                                {row.typeOfIssue || '—'}
                              </span>
                            </td>
                            <td className="w-[15%] px-8 py-4">
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                {row.ticketStage || '—'}
                              </span>
                            </td>
                            <td className="w-auto px-8 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                                {row.pppApplicable}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-8 py-24 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                              <TableIcon className="w-12 h-12" />
                              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No "Yes" Entries Found</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'ts-bifurcation' ? (
            <div className="p-8 flex-1 flex flex-col gap-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-blue-600 rounded-full" />
                      Total Tickets
                    </h3>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 shadow-sm">
                      Total: {tsLoading ? '...' : filteredTsData.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Tickets in the current filter selection.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-emerald-600 rounded-full" />
                      Unique Buyers
                    </h3>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black border border-emerald-100 shadow-sm">
                      {tsLoading ? '...' : Array.from(new Set(filteredTsData.map(d => d.buyerGlid))).filter(Boolean).length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Distinct buyer GLIDs in current filter selection.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-4 bg-amber-600 rounded-full" />
                      Unique Sellers
                    </h3>
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-black border border-amber-100 shadow-sm">
                      {tsLoading ? '...' : Array.from(new Set(filteredTsData.map(d => d.againstSellerGlid))).filter(Boolean).length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Distinct seller GLIDs in current filter selection.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-blue-500 rounded-full" />
                      Type of Issue Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">Count of tickets by issue type.</p>
                  </div>
                  <div className="h-[280px] w-full">
                    <div className="w-full overflow-x-auto">
                      {tsIssueTypeData.length > 0 ? (
                        <div style={{ minWidth: Math.max(500, tsIssueTypeData.length * 80) }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart 
                              data={tsIssueTypeData} 
                              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 800, fill: '#1E293B', angle: -30, textAnchor: 'end' }}
                              />
                              <YAxis 
                                type="number" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 800, fill: '#1E293B' }}
                              />
                              <Tooltip 
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                contentStyle={{ 
                                  borderRadius: '16px', 
                                  border: '1px solid #F1F5F9', 
                                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}
                              />
                              <Bar 
                                dataKey="value" 
                                fill="#3B82F6"
                                radius={[4, 4, 0, 0]}
                                barSize={48}
                                onClick={(data) => handleGraphClick('typeOfIssue', data.name)}
                              >
                                <LabelList 
                                  dataKey="value" 
                                  position="top" 
                                  style={{ fontSize: '10px', fontWeight: '800', fill: '#1E293B' }} 
                                />
                                {tsIssueTypeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={getChartColor(index + 2)} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                          <BarChart3 className="w-12 h-12 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Type of Issue Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      Seller Custtype Distribution
                    </h3>
                    <p className="text-xs text-slate-500">Share of tickets by seller customer type.</p>
                  </div>
                  <div className="h-[280px] w-full">
                    <div className="w-full overflow-x-auto">
                      {tsSellerCusttypeData.length > 0 ? (
                        <div style={{ minWidth: Math.max(500, tsSellerCusttypeData.length * 120) }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie
                                data={tsSellerCusttypeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                                label={({ name, value }) => `${name}: ${value}`}
                                onClick={(state) => handleGraphClick('sellerCusttype', String(state.name))}
                              >
                                {tsSellerCusttypeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  borderRadius: '16px', 
                                  border: '1px solid #F1F5F9', 
                                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                align="center"
                                iconType="circle"
                                wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '700' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                          <BarChart3 className="w-12 h-12 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Seller Custtype Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-violet-500 rounded-full" />
                      PPP Status Overview
                    </h3>
                    <p className="text-xs text-slate-500">How many tickets have PPP enabled vs disabled.</p>
                  </div>
                  <div className="h-[280px] w-full">
                    <div className="w-full overflow-x-auto">
                      {tsPppStatusData.length > 0 ? (
                        <div style={{ minWidth: Math.max(500, tsPppStatusData.length * 120) }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie
                                data={tsPppStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                                label={({ name, value }) => `${name}: ${value}`}
                                onClick={(state) => handleGraphClick('pppStatus', String(state.name))}
                              >
                                {tsPppStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  borderRadius: '16px', 
                                  border: '1px solid #F1F5F9', 
                                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                align="center"
                                iconType="circle"
                                wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '700' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                          <BarChart3 className="w-12 h-12 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No PPP Status Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-amber-500 rounded-full" />
                      Ticket Stage Distribution
                    </h3>
                    <p className="text-xs text-slate-500">How many tickets are in each stage.</p>
                  </div>
                  <div className="h-[280px] w-full">
                    <div className="w-full overflow-x-auto">
                      {tsTicketStageData.length > 0 ? (
                        <div style={{ minWidth: Math.max(500, tsTicketStageData.length * 100) }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart 
                              data={tsTicketStageData} 
                              layout="vertical"
                              margin={{ top: 5, right: 40, left: 100, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 800, fill: '#1E293B' }}
                                width={180}
                              />
                              <Tooltip 
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                contentStyle={{ 
                                  borderRadius: '16px', 
                                  border: '1px solid #F1F5F9', 
                                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}
                              />
                              <Bar 
                                dataKey="value" 
                                radius={[0, 4, 4, 0]}
                                barSize={28}
                                onClick={(data) => handleGraphClick('ticketStage', data.name)}
                              >
                                <LabelList 
                                  dataKey="value" 
                                  position="right" 
                                  style={{ fontSize: '10px', fontWeight: '800', fill: '#1E293B' }}
                                />
                                {tsTicketStageData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={getChartColor(index + 1)} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                          <BarChart3 className="w-12 h-12 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Ticket Stage Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                    Top Closing Comments
                  </h3>
                  <p className="text-xs text-slate-500">Most frequent closing comments (top 10).</p>
                </div>
                <div className="h-[280px] w-full">
                  <div className="w-full overflow-x-auto">
                    {tsClosingCommentData.length > 0 ? (
                      <div style={{ minWidth: Math.max(600, tsClosingCommentData.length * 220) }}>
                        <ResponsiveContainer width="100%" height={340}>
                          <BarChart 
                            data={tsClosingCommentData} 
                            layout="vertical"
                            margin={{ top: 10, right: 40, left: 220, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fontWeight: 800, fill: '#1E293B', wordBreak: 'break-all' }}
                              width={220}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                              contentStyle={{ 
                                borderRadius: '16px', 
                                border: '1px solid #F1F5F9', 
                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                fontSize: '12px',
                                fontWeight: '700',
                                maxWidth: '400px',
                                whiteSpace: 'pre-line',
                              }}
                            />
                            <Bar 
                              dataKey="value" 
                              radius={[0, 4, 4, 0]}
                              barSize={32}
                              onClick={(data) => handleGraphClick('closingComment', String(data.name))}
                            >
                              <LabelList 
                                dataKey="value" 
                                position="right" 
                                style={{ fontSize: '12px', fontWeight: '800', fill: '#1E293B' }} 
                              />
                              {tsClosingCommentData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getChartColor(index + 3)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                        <BarChart3 className="w-12 h-12 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Closing Comment Data</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      TS Tickets
                    </h3>
                    <p className="text-xs text-slate-500">Click on Ticket ID to view detailed information.</p>
                  </div>
                </div>

                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="w-[10%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ID</th>
                        <th className="w-[12%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Issue Date</th>
                        <th className="w-[12%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Close Date</th>
                        <th className="w-[12%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Buyer GLID</th>
                        <th className="w-[12%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Seller GLID</th>
                        <th className="w-[12%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Cust Type</th>
                        <th className="w-[12%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type of Issue</th>
                        <th className="w-[10%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">PPP Status</th>
                        <th className="w-[10%] px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTsData.length > 0 ? (
                        filteredTsData.map((row, idx) => (
                          <tr key={idx} className="group hover:bg-blue-50/30 transition-all">
                            <td className="w-[10%] px-4 py-4">
                              <button
                                onClick={() => setSelectedTsRow(row)}
                                className="text-xs font-bold text-blue-600 hover:underline"
                              >
                                {row.id || '—'}
                              </button>
                            </td>
                            <td className="w-[12%] px-4 py-4">
                              <span className="text-sm font-medium text-slate-600">
                                {row.issueDate || '—'}
                              </span>
                            </td>
                            <td className="w-[12%] px-4 py-4 hidden sm:table-cell">
                              <span className="text-sm font-medium text-slate-600">
                                {row.closeDate || '—'}
                              </span>
                            </td>
                            <td className="w-[12%] px-4 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-blue-50 text-blue-600 border-blue-100 shadow-sm">
                                {row.buyerGlid || '—'}
                              </span>
                            </td>
                            <td className="w-[12%] px-4 py-4 hidden sm:table-cell">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-slate-50 text-slate-700 border-slate-100 shadow-sm">
                                {row.againstSellerGlid || '—'}
                              </span>
                            </td>
                            <td className="w-[12%] px-4 py-4 hidden sm:table-cell">
                              <span className="text-xs font-semibold text-slate-500">{row.sellerCusttype || '—'}</span>
                            </td>
                            <td className="w-[12%] px-4 py-4">
                              <span className="text-xs font-semibold text-slate-500">{row.typeOfIssue || '—'}</span>
                            </td>
                            <td className="w-[10%] px-4 py-4">
                              <span className="text-xs font-semibold text-slate-500">{row.pppStatus || '—'}</span>
                            </td>
                            <td className="w-[10%] px-4 py-4">
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                {row.ticketStage || '—'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-8 py-24 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                              <TableIcon className="w-12 h-12" />
                              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No Entries Found</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'ppp-in-scope' ? (
            <div className="p-8 flex-1 flex flex-col gap-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      PPP-In Scope Records
                    </h3>
                    <p className="text-xs text-slate-500">Click on any row to view detailed information.</p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto max-h-[600px]">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-slate-50/50 sticky top-0">
                        {pppInScopeData.length > 0 && Object.keys(pppInScopeData[0]).map((header) => (
                          <th
                            key={header}
                            className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r border-slate-100"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pppInScopeData.length > 0 ? (
                        pppInScopeData.map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedPppRow(row)}
                            className="hover:bg-emerald-50/30 transition-all cursor-pointer group"
                          >
                            {Object.values(row).map((value, colIdx) => (
                              <td
                                key={colIdx}
                                className="px-4 py-4 text-sm font-medium text-slate-600 border-r border-slate-100 group-hover:text-slate-800"
                                title={String(value)}
                              >
                                <span className="line-clamp-2">{String(value) || '—'}</span>
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={40} className="px-8 py-24 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                              <TableIcon className="w-12 h-12" />
                              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No Entries Found</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 flex-1 flex flex-col items-center justify-center text-center gap-6">
              <div className="bg-blue-50 p-6 rounded-3xl shadow-inner">
                <LayoutDashboard className="w-16 h-16 text-blue-500 opacity-50" />
              </div>
              <div className="max-w-md">
                <h3 className="text-2xl font-black text-slate-800 mb-3">Overall Analysis</h3>
                <p className="text-slate-500 leading-relaxed">
                  This section will contain overall performance metrics and high-level trends. 
                  We are currently preparing the data for this view.
                </p>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-slate-100 rounded-2xl border border-slate-200">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Coming Soon</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer Info */}
        {!activeLoading && !activeError && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                ))}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {activeTab === 'ts-bifurcation' ? filteredTsData.length : filteredData.length} of {activeTab === 'ts-bifurcation' ? tsData.length : data.length} Entries Filtered
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Last Sync: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </main>

      {selectedTsRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Ticket Details</h3>
              <button
                onClick={() => setSelectedTsRow(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'ID', value: selectedTsRow.id },
                { label: 'Issue Date', value: selectedTsRow.issueDate },
                { label: 'Close Date', value: selectedTsRow.closeDate },
                { label: 'Last Updated', value: selectedTsRow.lastUpdated },
                { label: 'Buyer GLID', value: selectedTsRow.buyerGlid },
                { label: 'Seller GLID', value: selectedTsRow.againstSellerGlid },
                { label: 'Seller Custtype', value: selectedTsRow.sellerCusttype },
                { label: 'Type of Issue', value: selectedTsRow.typeOfIssue },
                { label: 'PPP Status', value: selectedTsRow.pppStatus },
                { label: 'Ticket Stage', value: selectedTsRow.ticketStage },
                { label: 'Closing Comment', value: selectedTsRow.closingComment },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{value || '—'}</p>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedTsRow(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {graphClickType && graphClickValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  {graphClickType === 'typeOfIssue' && `Tickets - Type of Issue: ${graphClickValue}`}
                  {graphClickType === 'sellerCusttype' && `Tickets - Customer Type: ${graphClickValue}`}
                  {graphClickType === 'pppStatus' && `Tickets - PPP Status: ${graphClickValue}`}
                  {graphClickType === 'ticketStage' && `Tickets - Ticket Stage: ${graphClickValue}`}
                  {graphClickType === 'closingComment' && `Tickets - Closing Comment: ${graphClickValue}`}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Showing {graphClickedTickets.length} ticket(s)
                </p>
              </div>
              <button
                onClick={() => {
                  setGraphClickType(null);
                  setGraphClickValue(null);
                  setGraphClickedTickets([]);
                }}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {graphClickedTickets.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 sticky top-0">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ID</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Issue Date</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Close Date</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Buyer GLID</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Seller GLID</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">Cust Type</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type of Issue</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">PPP</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {graphClickedTickets.map((ticket, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-blue-600">
                            {ticket.id || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600">
                            {ticket.issueDate || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-sm font-medium text-slate-600">
                            {ticket.closeDate || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-blue-50 text-blue-600 border-blue-100">
                            {ticket.buyerGlid || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-slate-50 text-slate-700 border-slate-100">
                            {ticket.againstSellerGlid || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="text-xs font-semibold text-slate-500">{ticket.sellerCusttype || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-slate-500">{ticket.typeOfIssue || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-slate-500">{ticket.pppStatus || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            {ticket.ticketStage || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <TableIcon className="w-12 h-12 opacity-20 mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No Tickets Found</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 text-right bg-slate-50/50">
              <button
                onClick={() => {
                  setGraphClickType(null);
                  setGraphClickValue(null);
                  setGraphClickedTickets([]);
                }}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPppRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800">PPP-In Scope Record Details</h3>
              <button
                onClick={() => setSelectedPppRow(null)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPppRow && Object.entries(selectedPppRow).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{key}</p>
                    <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap break-words">{String(value) || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 text-right bg-slate-50/50">
              <button
                onClick={() => setSelectedPppRow(null)}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}} />
    </div>
  );
}
