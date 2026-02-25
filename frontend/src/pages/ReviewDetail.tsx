import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, Review } from "../api/client";
import { ScoreBadge, RatingBadge, SentimentBadge, SeverityBadge } from "../components/ScoreBadge";
import { AlertTriangle, CheckCircle, RefreshCw, Trash2, ChevronDown, ChevronUp, ShieldAlert, Download } from "lucide-react";

const LEGAL_RISK_THRESHOLD = 70;

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  const fetchReview = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.reviews.get(parseInt(id));
      setReview(data);
      if (data.status === "pending") {
        setTimeout(fetchReview, 3000);
      }
    } catch {
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  const handleDelete = async () => {
    if (!review || !confirm("Delete this review?")) return;
    await api.reviews.delete(review.id);
    navigate("/history");
  };

  const handleDownload = () => {
    if (!review || review.status !== "completed") return;
    const date = new Date(review.created_at).toISOString().split("T")[0];
    const flags = review.compliance_flags || [];
    const flagLines = flags.map(f =>
      `- [${f.severity.toUpperCase()}] "${f.text}"\n  Issue: ${f.issue}\n  Suggestion: ${f.suggestion}`
    ).join("\n");

    const lines: string[] = [
      `# Content Review #${review.id}`,
      `**Date:** ${new Date(review.created_at).toLocaleString()}`,
      `**Content Type:** ${CONTENT_LABELS[review.content_type] || review.content_type}`,
      ...(review.jurisdiction && review.jurisdiction !== "general" ? [`**Jurisdiction:** ${review.jurisdiction}`] : []),
      ``,
      `## Scores`,
      `- Overall Rating: ${review.overall_rating ?? "–"}`,
      `- Brand Score: ${review.brand_score != null ? review.brand_score + "/100" : "–"}`,
      `- Risk Score: ${review.risk_score ?? 0}%`,
      `- Sentiment: ${review.sentiment ?? "–"} (${review.sentiment_score != null ? Math.round(review.sentiment_score * 100) + "%" : "–"})`,
      ``,
      `## Summary`,
      review.summary || "",
      ``,
      `## Brand Voice Feedback`,
      review.brand_feedback || "",
      ``,
      `## Compliance Flags (${flags.length})`,
      flagLines || "No compliance issues found.",
      ``,
      `## Sentiment Analysis`,
      review.sentiment_feedback || "",
      ``,
      `## Original Content`,
      "```",
      review.original_content,
      "```",
      ...(review.suggested_rewrite ? [``, `## Suggested Rewrite`, review.suggested_rewrite] : []),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-${review.id}-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-near-green" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Review not found.</p>
      </div>
    );
  }

  const toggleFlag = (i: number) => {
    setExpandedFlags(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const CONTENT_LABELS: Record<string, string> = {
    social_media: "Social Media Post", blog: "Blog / Website Copy",
    email: "Email Campaign", ad_copy: "Ad Copy",
    crypto_marketing: "Crypto Marketing", financial_product: "Financial Product",
  };

  const JURISDICTION_LABELS: Record<string, string> = {
    US: "🇺🇸 US", UK: "🇬🇧 UK", CH: "🇨🇭 Switzerland", EU: "🇪🇺 EU",
  };

  const riskScore = review.risk_score ?? 0;
  const needsLegalReview = review.status === "completed" && riskScore > LEGAL_RISK_THRESHOLD;

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2 flex-wrap">
            <span>{CONTENT_LABELS[review.content_type] || review.content_type}</span>
            {review.jurisdiction && review.jurisdiction !== "general" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-near-green-muted text-near-green-text text-xs font-medium">
                {JURISDICTION_LABELS[review.jurisdiction] || review.jurisdiction}
              </span>
            )}
            <span>·</span>
            {review.source !== "manual" && <span className="capitalize">{review.source_filename || review.source} ·</span>}
            <span>{new Date(review.created_at).toLocaleString()}</span>
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Content Review</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReview}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleDownload}
            disabled={review.status !== "completed"}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download report"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Legal alert banner — shown when risk > 70% */}
      {needsLegalReview && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-5 mb-6 flex items-start gap-4">
          <ShieldAlert className="text-red-600 flex-shrink-0 mt-0.5" size={22} />
          <div>
            <p className="font-semibold text-red-800 text-base">
              Legal Review Required — Risk Score {riskScore}%
            </p>
            <p className="text-sm text-red-700 mt-1">
              This content has a high compliance risk profile. Please forward to the legal team before publishing.
              The compliance flags below detail the specific issues that require legal assessment.
            </p>
          </div>
        </div>
      )}

      {/* Pending state */}
      {review.status === "pending" && (
        <div className="bg-near-green-muted border border-near-green/30 rounded-xl p-6 mb-6 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-near-green-text" />
          <div>
            <p className="font-medium text-near-green-text">Analyzing content…</p>
            <p className="text-sm text-near-green-text/80 mt-0.5">
              Claude is reviewing your content. This page will update automatically.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {review.status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="font-medium text-red-800">Analysis failed</p>
          <p className="text-sm text-red-600 mt-1">{review.error_message}</p>
        </div>
      )}

      {/* Scores row */}
      {review.status === "completed" && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Brand Score</p>
              {review.brand_score != null && (
                <ScoreBadge score={Math.round(review.brand_score)} size="lg" />
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Overall Rating</p>
              {review.overall_rating && (
                <RatingBadge rating={review.overall_rating} size="lg" />
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Sentiment</p>
              {review.sentiment && (
                <div className="flex flex-col items-center gap-1">
                  <SentimentBadge sentiment={review.sentiment} />
                  {review.sentiment_score != null && (
                    <p className="text-xs text-gray-400">{Math.round(review.sentiment_score * 100)}%</p>
                  )}
                </div>
              )}
            </div>
            <div className={`rounded-xl border p-5 text-center ${needsLegalReview ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Risk Score</p>
              <div className="flex flex-col items-center gap-1">
                <span className={`text-3xl font-bold ${needsLegalReview ? "text-red-700" : riskScore > 40 ? "text-orange-600" : "text-near-green-text"}`}>
                  {riskScore}%
                </span>
                {needsLegalReview && (
                  <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Legal review</span>
                )}
              </div>
            </div>
          </div>

          {/* Summary */}
          {review.summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{review.summary}</p>
            </div>
          )}

          {/* Brand feedback */}
          {review.brand_feedback && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Brand Voice</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{review.brand_feedback}</p>
            </div>
          )}

          {/* Compliance flags */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              {(review.compliance_flags?.length ?? 0) > 0 ? (
                <AlertTriangle className="text-orange-500" size={18} />
              ) : (
                <CheckCircle className="text-near-green-text" size={18} />
              )}
              <h3 className="font-semibold text-gray-900">
                Compliance Flags ({review.compliance_flags?.length ?? 0})
              </h3>
            </div>
            {(review.compliance_flags?.length ?? 0) === 0 ? (
              <p className="text-sm text-near-green-text bg-near-green-muted px-3 py-2 rounded-lg">
                No compliance issues found.
              </p>
            ) : (
              <div className="space-y-2">
                {review.compliance_flags!.map((flag, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleFlag(i)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SeverityBadge severity={flag.severity} />
                        <span className="text-sm text-gray-700 truncate">
                          "{flag.text}"
                        </span>
                      </div>
                      {expandedFlags.has(i) ? (
                        <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {expandedFlags.has(i) && (
                      <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
                        <p className="text-sm text-gray-700 mt-2">
                          <span className="font-medium">Issue:</span> {flag.issue}
                        </p>
                        <p className="text-sm text-near-green-text mt-1">
                          <span className="font-medium">Suggestion:</span> {flag.suggestion}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sentiment feedback */}
          {review.sentiment_feedback && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Sentiment Analysis</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{review.sentiment_feedback}</p>
            </div>
          )}

          {/* Original content */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Original Content</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">
              {review.original_content}
            </p>
          </div>

          {/* Suggested rewrite */}
          {review.suggested_rewrite && (
            <div className="bg-white rounded-xl border border-near-green/30 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Suggested Rewrite</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-near-green-muted rounded-lg p-3">
                {review.suggested_rewrite}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
