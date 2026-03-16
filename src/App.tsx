/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { LayoutDashboard, Table as TableIcon, Loader2, AlertCircle, RefreshCw, Calendar, Filter, X, BarChart3 } from 'lucide-react';
import { fetchSourceOfVisitData, SourceOfVisitData } from './services/sheetService';
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
  const [activeTab, setActiveTab] = useState<'visit-data' | 'overall'>('visit-data');
  const [data, setData] = useState<SourceOfVisitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('all');

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

  useEffect(() => {
    loadData();
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

  const getSourceColor = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('google')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (s.includes('direct')) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (s.includes('social') || s.includes('facebook')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (s.includes('referral')) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

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
                Buyer's Payment Protection Plan
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Data
              </div>
              <button 
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all text-xs font-semibold disabled:opacity-50 border border-blue-100"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Tabs in Header */}
          <div className="flex items-center gap-8 h-12">
            <button
              onClick={() => setActiveTab('visit-data')}
              className={cn(
                "h-full px-1 text-xs font-bold transition-all flex items-center gap-2 relative",
                activeTab === 'visit-data'
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Visit Data
              {activeTab === 'visit-data' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('overall')}
              className={cn(
                "h-full px-1 text-xs font-bold transition-all flex items-center gap-2 relative",
                activeTab === 'overall'
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Overall
              {activeTab === 'overall' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
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

        {/* Content Area */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Syncing with Sheet</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-6 px-6 text-center">
              <div className="bg-red-50 p-4 rounded-2xl shadow-inner">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-black text-slate-800 mb-2">Sync Failed</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{error}</p>
              </div>
              <button 
                onClick={loadData}
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
                      Ticket Stage
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
        {!loading && !error && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                ))}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {filteredData.length} of {data.length} Entries Filtered
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
