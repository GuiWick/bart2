import { useState, useEffect } from "react";
import { api, BrandGuidelines, PatternAnalysis } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Save, CheckCircle, ChevronDown, ChevronUp, Copy } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [guidelines, setGuidelines] = useState<BrandGuidelines | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Profile fields
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [newPassword, setNewPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Pattern analysis
  const [patternOpen, setPatternOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [patternResult, setPatternResult] = useState<PatternAnalysis | null>(null);
  const [patternError, setPatternError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    api.settings.getGuidelines().then((g) => {
      setGuidelines(g);
      setContent(g.content);
    });
  }, []);

  const handleSaveGuidelines = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await api.settings.updateGuidelines(content);
      setGuidelines(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await api.auth.updateMe({
        full_name: fullName,
        ...(newPassword ? { password: newPassword } : {}),
      });
      setNewPassword("");
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAnalyzePatterns = async () => {
    setAnalyzing(true);
    setPatternError("");
    setPatternResult(null);
    try {
      const result = await api.dashboard.analyzePatterns();
      setPatternResult(result);
    } catch (err: unknown) {
      setPatternError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Brand Guidelines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Brand Guidelines</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              These guidelines inform every content analysis.{" "}
              {!user?.is_admin && (
                <span className="text-orange-600">Only admins can edit guidelines.</span>
              )}
            </p>
            {guidelines?.updated_at && (
              <p className="text-xs text-gray-400 mt-1">
                Last updated {new Date(guidelines.updated_at).toLocaleString()}
              </p>
            )}
          </div>
          {saved && (
            <div className="flex items-center gap-1 text-near-green-text text-sm">
              <CheckCircle size={16} />
              Saved
            </div>
          )}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!user?.is_admin}
          rows={16}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-near-green font-mono disabled:bg-gray-50 disabled:text-gray-500 resize-none"
          placeholder={`Describe your brand guidelines here. For example:\n\n## Voice & Tone\n- Professional but approachable\n- Use active voice\n- Avoid jargon\n\n## Prohibited Language\n- Never use "cheap"\n- Avoid superlative claims without data\n\n## Compliance\n- Always include required disclosures\n- FDA claims must be pre-approved`}
        />

        {error && (
          <p className="text-red-600 text-sm mt-2">{error}</p>
        )}

        {user?.is_admin && (
          <button
            onClick={handleSaveGuidelines}
            disabled={saving}
            className="mt-3 flex items-center gap-2 bg-near-green text-near-dark px-4 py-2 rounded-lg text-sm font-bold hover:bg-near-green-hover disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save guidelines"}
          </button>
        )}
      </div>

      {/* Pattern Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setPatternOpen((o) => !o)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 rounded-xl text-left"
        >
          <div>
            <h2 className="font-semibold text-gray-900">Pattern Analysis & Insights</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Analyze recent reviews to discover trends and improve guidelines.
            </p>
          </div>
          {patternOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {patternOpen && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
            <div className="pt-4">
              <button
                onClick={handleAnalyzePatterns}
                disabled={analyzing}
                className="flex items-center gap-2 bg-near-green text-near-dark px-4 py-2 rounded-lg text-sm font-bold hover:bg-near-green-hover disabled:opacity-50"
              >
                {analyzing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-near-dark" />
                )}
                {analyzing ? "Analyzing…" : "Analyze Recent Reviews"}
              </button>
              <p className="text-xs text-gray-400 mt-1">Requires at least 3 completed reviews. May take ~30 seconds.</p>
            </div>

            {patternError && (
              <p className="text-red-600 text-sm">{patternError}</p>
            )}

            {patternResult && (
              <div className="space-y-5">
                {/* Key Patterns */}
                {patternResult.patterns.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Key Patterns</h3>
                    <ul className="space-y-1">
                      {patternResult.patterns.map((p, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-near-green-text font-bold mt-0.5">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sentiment Insights */}
                {patternResult.sentiment_insights && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">Sentiment Insights</h3>
                    <p className="text-sm text-gray-700">{patternResult.sentiment_insights}</p>
                  </div>
                )}

                {/* Jurisdiction Notes */}
                {Object.keys(patternResult.jurisdiction_notes).length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Jurisdiction Notes</h3>
                    <div className="space-y-2">
                      {Object.entries(patternResult.jurisdiction_notes).map(([jur, note]) => (
                        <div key={jur} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{jur}</p>
                          <p className="text-sm text-gray-700">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guideline Suggestions */}
                {patternResult.guideline_suggestions.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Suggested Guideline Updates</h3>
                    <div className="space-y-3">
                      {patternResult.guideline_suggestions.map((s, i) => (
                        <div key={i} className="border border-near-green/30 rounded-lg p-4 bg-near-green-muted">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-gray-900 font-medium flex-1">{s.suggestion}</p>
                            <button
                              onClick={() => handleCopy(s.suggestion, i)}
                              className="flex-shrink-0 p-1.5 text-near-green-text hover:bg-near-green/20 rounded"
                              title="Copy suggestion"
                            >
                              {copiedIdx === i ? <CheckCircle size={15} /> : <Copy size={15} />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">{s.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Your Profile</h2>
          {profileSaved && (
            <div className="flex items-center gap-1 text-near-green-text text-sm">
              <CheckCircle size={16} />
              Saved
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-near-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password <span className="text-gray-400">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-near-green"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="flex items-center gap-2 bg-near-green text-near-dark px-4 py-2 rounded-lg text-sm font-bold hover:bg-near-green-hover disabled:opacity-50"
          >
            <Save size={16} />
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
