import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { api, DashboardStats } from "../api/client";
import { ScoreBadge, RatingBadge, SentimentBadge } from "../components/ScoreBadge";
import { TrendingUp, FileText, AlertTriangle, Clock } from "lucide-react";

const RATING_COLORS: Record<string, string> = {
  A: "#00EC97", B: "#00b872", C: "#eab308", D: "#f97316", F: "#ef4444"
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#00EC97", neutral: "#94a3b8", negative: "#ef4444"
};

function ContentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    social_media: "Social", blog: "Blog", email: "Email", ad_copy: "Ad Copy"
  };
  return labels[type] || type;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.stats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-near-green" />
      </div>
    );
  }

  if (!stats) return null;

  const ratingData = Object.entries(stats.rating_distribution).map(([k, v]) => ({ name: k, value: v }));
  const sentimentData = Object.entries(stats.sentiment_distribution).map(([k, v]) => ({ name: k, value: v }));
  const contentTypeData = Object.entries(stats.content_type_distribution).map(([k, v]) => ({
    name: ContentTypeLabel(k), value: v
  }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your content reviews</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Reviews</span>
            <FileText className="text-near-green-text" size={18} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total_reviews}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Avg Brand Score</span>
            <TrendingUp className="text-green-500" size={18} />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats.avg_brand_score != null ? stats.avg_brand_score : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">This Week</span>
            <Clock className="text-purple-500" size={18} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.reviews_this_week}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Top Issues</span>
            <AlertTriangle className="text-orange-500" size={18} />
          </div>
          <p className="text-sm text-gray-700">
            {stats.top_issues[0] || "None yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Rating distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Rating Distribution</h3>
          {ratingData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ratingData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {ratingData.map((entry) => (
                    <Cell key={entry.name} fill={RATING_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
              No completed reviews yet
            </div>
          )}
        </div>

        {/* Sentiment */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Sentiment</h3>
          {sentimentData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {sentimentData.map((entry) => (
                    <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
        </div>

        {/* Content types */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Content Types</h3>
          {contentTypeData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={contentTypeData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                <Tooltip />
                <Bar dataKey="value" fill="#00EC97" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent reviews */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Reviews</h3>
          <Link to="/history" className="text-sm text-near-green-text hover:underline">
            View all
          </Link>
        </div>
        {stats.recent_reviews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-3">No reviews yet</p>
            <Link
              to="/review/new"
              className="text-sm bg-near-green text-near-dark px-4 py-2 rounded-lg hover:bg-near-green-hover font-bold"
            >
              Create your first review
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats.recent_reviews.map((review) => (
              <Link
                key={review.id}
                to={`/review/${review.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {review.original_content.slice(0, 80)}…
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {review.content_type.replace("_", " ")} ·{" "}
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {review.status === "pending" && (
                    <span className="text-xs text-gray-400 animate-pulse">Analyzing…</span>
                  )}
                  {review.status === "completed" && (
                    <>
                      {review.brand_score != null && <ScoreBadge score={review.brand_score} />}
                      {review.overall_rating && <RatingBadge rating={review.overall_rating} />}
                      {review.sentiment && <SentimentBadge sentiment={review.sentiment} />}
                    </>
                  )}
                  {review.status === "error" && (
                    <span className="text-xs text-red-500">Error</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
