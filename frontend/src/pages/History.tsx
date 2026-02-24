import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, Review } from "../api/client";
import { ScoreBadge, RatingBadge, SentimentBadge } from "../components/ScoreBadge";
import { Search } from "lucide-react";

const CONTENT_LABELS: Record<string, string> = {
  social_media: "Social", blog: "Blog", email: "Email", ad_copy: "Ad Copy"
};

export default function History() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.reviews.list(0, 200).then(setReviews).finally(() => setLoading(false));
  }, []);

  const filtered = reviews.filter((r) => {
    const matchSearch = r.original_content.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "pending" && r.status === "pending") ||
      (filter === "completed" && r.status === "completed") ||
      (filter === r.content_type);
    return matchSearch && matchFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-near-green" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review History</h1>
          <p className="text-gray-500 mt-1">{reviews.length} total reviews</p>
        </div>
        <Link
          to="/review/new"
          className="bg-near-green text-near-dark px-4 py-2 rounded-lg text-sm font-medium hover:bg-near-green-hover"
        >
          New Review
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-near-green"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="all">All types</option>
          <option value="social_media">Social Media</option>
          <option value="blog">Blog</option>
          <option value="email">Email</option>
          <option value="ad_copy">Ad Copy</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {reviews.length === 0 ? (
            <>
              <p className="mb-3">No reviews yet</p>
              <Link
                to="/review/new"
                className="text-sm text-near-green-text hover:underline"
              >
                Create your first review
              </Link>
            </>
          ) : (
            <p>No results match your filters</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Content</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rating</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sentiment</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/review/${review.id}`}
                      className="text-near-green-text hover:underline font-medium"
                    >
                      {review.original_content.slice(0, 60)}
                      {review.original_content.length > 60 ? "…" : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {CONTENT_LABELS[review.content_type] || review.content_type}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {review.source}
                  </td>
                  <td className="px-4 py-3">
                    {review.status === "pending" ? (
                      <span className="text-xs text-gray-400 animate-pulse">…</span>
                    ) : review.brand_score != null ? (
                      <ScoreBadge score={Math.round(review.brand_score)} />
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {review.overall_rating ? (
                      <RatingBadge rating={review.overall_rating} />
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {review.sentiment ? (
                      <SentimentBadge sentiment={review.sentiment} />
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(review.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
