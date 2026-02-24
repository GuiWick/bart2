import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, SlackChannel, NotionDatabase } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function Integrations() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState({ slack: false, notion: false });

  // Slack state
  const [slackToken, setSlackToken] = useState("");
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [slackFetchLimit, setSlackFetchLimit] = useState(10);
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackFetching, setSlackFetching] = useState(false);
  const [slackMsg, setSlackMsg] = useState("");

  // Notion state
  const [notionKey, setNotionKey] = useState("");
  const [notionDbs, setNotionDbs] = useState<NotionDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [notionContentType, setNotionContentType] = useState("blog");
  const [notionSaving, setNotionSaving] = useState(false);
  const [notionFetching, setNotionFetching] = useState(false);
  const [notionMsg, setNotionMsg] = useState("");

  useEffect(() => {
    api.integrations.status().then(setStatus);
    if (status.slack) {
      api.integrations.slackChannels().then(setSlackChannels).catch(() => {});
    }
    if (status.notion) {
      api.integrations.notionDatabases().then(setNotionDbs).catch(() => {});
    }
  }, []);

  const saveSlack = async () => {
    setSlackSaving(true);
    setSlackMsg("");
    try {
      await api.integrations.saveSlack(slackToken, []);
      const channels = await api.integrations.slackChannels();
      setSlackChannels(channels);
      setStatus((s) => ({ ...s, slack: true }));
      setSlackMsg("Connected! Select a channel to import messages.");
    } catch (err: unknown) {
      setSlackMsg(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setSlackSaving(false);
    }
  };

  const fetchSlack = async () => {
    if (!selectedChannel) return;
    setSlackFetching(true);
    setSlackMsg("");
    try {
      const result = await api.integrations.fetchSlack(selectedChannel, slackFetchLimit);
      setSlackMsg(`Queued ${result.queued} messages for analysis.`);
      setTimeout(() => navigate("/history"), 2000);
    } catch (err: unknown) {
      setSlackMsg(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setSlackFetching(false);
    }
  };

  const saveNotion = async () => {
    setNotionSaving(true);
    setNotionMsg("");
    try {
      await api.integrations.saveNotion(notionKey, []);
      const dbs = await api.integrations.notionDatabases();
      setNotionDbs(dbs);
      setStatus((s) => ({ ...s, notion: true }));
      setNotionMsg("Connected! Select a database to import pages.");
    } catch (err: unknown) {
      setNotionMsg(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setNotionSaving(false);
    }
  };

  const fetchNotion = async () => {
    if (!selectedDb) return;
    setNotionFetching(true);
    setNotionMsg("");
    try {
      const result = await api.integrations.fetchNotion(selectedDb, notionContentType, 20);
      setNotionMsg(`Queued ${result.queued} pages for analysis.`);
      setTimeout(() => navigate("/history"), 2000);
    } catch (err: unknown) {
      setNotionMsg(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setNotionFetching(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">
          Import content from Slack and Notion for batch review.
        </p>
      </div>

      {/* Slack */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-lg">#</div>
          <div>
            <h2 className="font-semibold text-gray-900">Slack</h2>
            <p className="text-xs text-gray-500">Import messages from channels</p>
          </div>
          {status.slack && (
            <CheckCircle size={18} className="text-green-500 ml-auto" />
          )}
        </div>

        {(!status.slack || !slackChannels.length) && user?.is_admin && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Token <span className="text-gray-400">(xoxb-…)</span>
              </label>
              <input
                type="password"
                value={slackToken}
                onChange={(e) => setSlackToken(e.target.value)}
                placeholder="xoxb-..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-near-green"
              />
              <p className="text-xs text-gray-400 mt-1">
                Create a Slack app with <code>channels:history</code>, <code>channels:read</code> scopes.
              </p>
            </div>
            <button
              onClick={saveSlack}
              disabled={slackSaving || !slackToken}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {slackSaving ? "Connecting…" : "Connect Slack"}
            </button>
          </div>
        )}

        {slackChannels.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select a channel…</option>
                {slackChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Messages to import
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={slackFetchLimit}
                onChange={(e) => setSlackFetchLimit(parseInt(e.target.value))}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <button
              onClick={fetchSlack}
              disabled={slackFetching || !selectedChannel}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {slackFetching ? "Importing…" : "Import & Review"}
            </button>
          </div>
        )}

        {slackMsg && (
          <p className={`mt-3 text-sm ${slackMsg.includes("Failed") || slackMsg.includes("error") ? "text-red-600" : "text-green-600"}`}>
            {slackMsg}
          </p>
        )}
      </div>

      {/* Notion */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 font-bold">N</div>
          <div>
            <h2 className="font-semibold text-gray-900">Notion</h2>
            <p className="text-xs text-gray-500">Import pages from databases</p>
          </div>
          {status.notion && (
            <CheckCircle size={18} className="text-green-500 ml-auto" />
          )}
        </div>

        {(!status.notion || !notionDbs.length) && user?.is_admin && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key <span className="text-gray-400">(secret_…)</span>
              </label>
              <input
                type="password"
                value={notionKey}
                onChange={(e) => setNotionKey(e.target.value)}
                placeholder="secret_..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-near-green"
              />
              <p className="text-xs text-gray-400 mt-1">
                Create an integration at notion.so/my-integrations and share your databases with it.
              </p>
            </div>
            <button
              onClick={saveNotion}
              disabled={notionSaving || !notionKey}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {notionSaving ? "Connecting…" : "Connect Notion"}
            </button>
          </div>
        )}

        {notionDbs.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database</label>
              <select
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select a database…</option>
                {notionDbs.map((db) => (
                  <option key={db.id} value={db.id}>{db.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content type</label>
              <select
                value={notionContentType}
                onChange={(e) => setNotionContentType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="blog">Blog / Website Copy</option>
                <option value="email">Email Campaign</option>
                <option value="social_media">Social Media</option>
                <option value="ad_copy">Ad Copy</option>
              </select>
            </div>
            <button
              onClick={fetchNotion}
              disabled={notionFetching || !selectedDb}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {notionFetching ? "Importing…" : "Import & Review"}
            </button>
          </div>
        )}

        {notionMsg && (
          <p className={`mt-3 text-sm ${notionMsg.includes("Failed") || notionMsg.includes("error") ? "text-red-600" : "text-green-600"}`}>
            {notionMsg}
          </p>
        )}
      </div>

      {!user?.is_admin && (
        <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-4 py-3 rounded-lg">
          <AlertCircle size={16} />
          Only admins can configure integrations.
        </div>
      )}
    </div>
  );
}
