"use client";

import { useState } from "react";

interface DashboardData {
  overview: {
    totalPageViews: number;
    totalClicks: number;
    uniqueVisitors: number;
    totalLikes: number;
    totalComments: number;
    totalHearts: number;
    totalResources: number;
    totalCategories: number;
    last7Days: { pageViews: number; clicks: number };
  };
  pageViewsByPage: { page: string; views: number }[];
  pageViewsByDay: { date: string; views: number }[];
  topClickedResources: { resourceId: number; resourceName: string; clicks: number }[];
  topLikedResources: { resourceId: number; resourceName: string; score: number; votes: number }[];
  recentComments: { id: number; resourceId: number; resourceName: string; nickname: string; body: string; createdAt: string }[];
  categories: { name: string; slug: string; resource_count: number }[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, maxItems = 10 }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string; maxItems?: number }) {
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map((d) => Number(d[valueKey])), 1);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-40 sm:w-56 text-sm text-gray-600 truncate" title={String(item[labelKey])}>
            {String(item[labelKey])}
          </div>
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(Number(item[valueKey]) / max) * 100}%` }}
            />
          </div>
          <div className="w-12 text-sm font-medium text-gray-700 text-right">
            {Number(item[valueKey])}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniTimeline({ data }: { data: { date: string; views: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400">No data yet</p>;
  const max = Math.max(...data.map((d) => d.views), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.views} views`}>
          <div
            className="w-full bg-blue-400 rounded-t-sm min-h-[2px] transition-all duration-300"
            style={{ height: `${(d.views / max) * 100}%` }}
          />
          <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?key=${encodeURIComponent(password)}`);
      if (res.status === 401) {
        setError("Invalid password");
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setAuthenticated(true);
      }
    } catch {
      setError("Failed to load dashboard");
    }
    setLoading(false);
  };

  const refresh = () => loadDashboard();

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mb-6">Enter the dashboard password to continue.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadDashboard();
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading..." : "View Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const o = data.overview;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Irvine Kids Resources — Site Analytics</p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Page Views" value={o.totalPageViews} sub={`${o.last7Days.pageViews} in last 7 days`} />
          <StatCard label="Unique Visitors" value={o.uniqueVisitors} />
          <StatCard label="Outbound Clicks" value={o.totalClicks} sub={`${o.last7Days.clicks} in last 7 days`} />
          <StatCard label="Support Hearts" value={o.totalHearts} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Resources" value={o.totalResources} />
          <StatCard label="Categories" value={o.totalCategories} />
          <StatCard label="Total Likes" value={o.totalLikes} />
          <StatCard label="Total Comments" value={o.totalComments} />
        </div>

        {/* Page Views Over Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Views — Last 30 Days</h2>
          <MiniTimeline data={data.pageViewsByDay} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Pages */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h2>
            <BarChart data={data.pageViewsByPage} labelKey="page" valueKey="views" />
          </div>

          {/* Top Clicked Resources */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Clicked Resources</h2>
            {data.topClickedResources.length > 0 ? (
              <BarChart data={data.topClickedResources} labelKey="resourceName" valueKey="clicks" />
            ) : (
              <p className="text-sm text-gray-400">No outbound clicks recorded yet</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Liked Resources */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Liked Resources</h2>
            {data.topLikedResources.length > 0 ? (
              <div className="space-y-3">
                {data.topLikedResources.map((r) => (
                  <div key={r.resourceId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700 truncate flex-1">{r.resourceName}</span>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-medium text-green-600">+{r.score}</span>
                      <span className="text-xs text-gray-400">{r.votes} votes</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No likes yet</p>
            )}
          </div>

          {/* Categories */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Categories</h2>
            <div className="space-y-3">
              {data.categories.map((c) => (
                <div key={c.slug} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{c.name}</span>
                  <span className="text-sm font-medium text-blue-600">{c.resource_count} resources</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Comments */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Comments</h2>
          {data.recentComments.length > 0 ? (
            <div className="space-y-4">
              {data.recentComments.map((c) => (
                <div key={c.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{c.nickname}</span>
                    <span className="text-xs text-gray-400">on {c.resourceName}</span>
                    <span className="text-xs text-gray-300 ml-auto">{c.createdAt}</span>
                  </div>
                  <p className="text-sm text-gray-600">{c.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No comments yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
