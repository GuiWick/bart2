import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Upload, FileText, X } from "lucide-react";

const CONTENT_TYPES = [
  { value: "social_media", label: "Social Media" },
  { value: "blog", label: "Blog / Web Copy" },
  { value: "email", label: "Email Campaign" },
  { value: "ad_copy", label: "Ad Copy" },
  { value: "crypto_marketing", label: "Crypto Marketing" },
  { value: "financial_product", label: "Financial Product" },
];

const JURISDICTIONS = [
  { value: "general", label: "General" },
  { value: "US", label: "🇺🇸 US" },
  { value: "UK", label: "🇬🇧 UK" },
  { value: "CH", label: "🇨🇭 Switzerland" },
  { value: "EU", label: "🇪🇺 EU" },
];

const REGULATED_TYPES = new Set(["crypto_marketing", "financial_product"]);

export default function NewReview() {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [contentType, setContentType] = useState("social_media");
  const [jurisdiction, setJurisdiction] = useState("general");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const isRegulated = REGULATED_TYPES.has(contentType);

  const handleContentTypeChange = (value: string) => {
    setContentType(value);
    if (!REGULATED_TYPES.has(value)) setJurisdiction("general");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let review;
      if (mode === "upload" && file) {
        review = await api.reviews.uploadFile(file, contentType, isRegulated ? jurisdiction : "general");
      } else {
        if (!content.trim()) { setLoading(false); return; }
        review = await api.reviews.create({
          content_type: contentType,
          original_content: content.trim(),
          jurisdiction: isRegulated ? jurisdiction : "general",
        });
      }
      navigate(`/review/${review.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Review</h1>
        <p className="text-gray-500 mt-1">
          Submit content for AI-powered brand and compliance analysis.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Content type</label>
          <div className="grid grid-cols-3 gap-2">
            {CONTENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleContentTypeChange(value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  contentType === value
                    ? "bg-near-green text-near-dark border-near-green"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Jurisdiction — only for regulated types */}
        {isRegulated && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jurisdiction
              <span className="ml-2 text-xs text-gray-400 font-normal">
                Applies specific regulatory compliance rules
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {JURISDICTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setJurisdiction(value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    jurisdiction === value
                      ? "bg-near-green text-near-dark border-near-green"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input mode tabs */}
        <div>
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {(["paste", "upload"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}

              >
                {m === "paste" ? "Paste text" : "Upload file"}
              </button>
            ))}
          </div>

          {mode === "paste" ? (
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={12}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Paste your marketing content here…"
              />
              <p className="text-xs text-gray-400 mt-1">{content.length} characters</p>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="text-blue-600" size={36} />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    <X size={12} /> Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="text-gray-400" size={36} />
                  <p className="text-sm font-medium text-gray-600">Click to upload a file</p>
                  <p className="text-xs text-gray-400">PDF, DOCX, or TXT — up to 20 MB</p>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || (mode === "paste" ? !content.trim() : !file)}
            className="bg-near-green text-near-dark px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-near-green-hover disabled:opacity-50 transition-colors"
          >
            {loading ? "Submitting…" : "Analyze content"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-gray-600 px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
