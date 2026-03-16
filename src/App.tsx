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
  Pie
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'source-of-visit' | 'analytics'>('source-of-visit');
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
    ).length
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
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
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
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters Bar */}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Visits</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-slate-800">{loading ? '...' : stats.total}</h2>
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <TableIcon className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unique GLIDs</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-slate-800">{loading ? '...' : stats.uniqueGlids}</h2>
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unique Sources</p>
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-black text-slate-800">{loading ? '...' : stats.sources}</h2>
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <LayoutDashboard className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Analysis Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6 border border-slate-200">
          <button
            onClick={() => setActiveTab('source-of-visit')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
              activeTab === 'source-of-visit'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Source of Visit
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
              activeTab === 'analytics'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>
        </div>

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
          ) : activeTab === 'analytics' ? (
            <div className="p-8 flex-1 flex flex-col gap-8">
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
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }}
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
                            />
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
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-amber-500 rounded-full" />
                      Analysis of Types of Issues
                    </h3>
                    <p className="text-xs text-slate-500">Distribution of different issue types reported.</p>
                  </div>
                  
                  <div className="h-[400px] w-full">
                    {issueTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={issueTypeData} 
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                            width={120}
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
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Fixed Header */}
              <div className="overflow-x-auto border-b border-slate-200 bg-slate-50/50">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th className="w-1/5 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                      <th className="w-1/4 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Buyer GLID</th>
                      <th className="w-1/4 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Source</th>
                      <th className="w-auto px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type of Issue</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse table-fixed">
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.length > 0 ? (
                      filteredData.map((row, idx) => (
                        <tr key={idx} className="group hover:bg-blue-50/30 transition-all">
                          <td className="w-1/5 px-8 py-4">
                            <span className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                              {row.date}
                            </span>
                          </td>
                          <td className="w-1/4 px-8 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-blue-50 text-blue-600 border-blue-100 shadow-sm transition-all">
                              {row.buyerGlid}
                            </span>
                          </td>
                          <td className="w-1/4 px-8 py-4">
                            <span className={cn(
                              "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm",
                              getSourceColor(row.source)
                            )}>
                              {row.source}
                            </span>
                          </td>
                          <td className="w-auto px-8 py-4">
                            <span className="text-xs font-semibold text-slate-500 italic">
                              {row.typeOfIssue || '—'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-8 py-24 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <TableIcon className="w-12 h-12" />
                            <p className="text-sm font-bold uppercase tracking-widest">No Records Match Filters</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
