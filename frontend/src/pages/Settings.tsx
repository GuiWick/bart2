import { useState, useEffect } from "react";
import { api, BrandGuidelines } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Save, CheckCircle } from "lucide-react";

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
