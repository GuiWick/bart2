const BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, full_name: string) =>
      request<{ access_token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name }),
      }),
    me: () => request<User>("/auth/me"),
    updateMe: (data: Partial<User> & { password?: string }) =>
      request<User>("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
    listUsers: () => request<User[]>("/auth/users"),
    createUser: (data: { email: string; password: string; full_name: string }) =>
      request<User>("/auth/users", { method: "POST", body: JSON.stringify(data) }),
    updateUser: (id: number, data: { full_name?: string; password?: string }) =>
      request<User>(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deactivateUser: (id: number) =>
      request<void>(`/auth/users/${id}`, { method: "DELETE" }),
  },

  reviews: {
    create: (data: { content_type: string; original_content: string; source?: string; source_reference?: string; jurisdiction?: string }) =>
      request<Review>("/reviews/", { method: "POST", body: JSON.stringify(data) }),
    uploadFile: async (file: File, content_type: string, jurisdiction: string): Promise<Review> => {
      const token = localStorage.getItem("token");
      const form = new FormData();
      form.append("file", file);
      form.append("content_type", content_type);
      form.append("jurisdiction", jurisdiction);
      const res = await fetch(`${BASE}/reviews/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      return res.json();
    },
    list: (skip = 0, limit = 50) =>
      request<Review[]>(`/reviews/?skip=${skip}&limit=${limit}`),
    get: (id: number) => request<Review>(`/reviews/${id}`),
    delete: (id: number) => request<void>(`/reviews/${id}`, { method: "DELETE" }),
    legalReview: (id: number, action: "approved" | "rejected", note?: string) =>
      request<Review>(`/reviews/${id}/legal-review`, {
        method: "PATCH",
        body: JSON.stringify({ action, note }),
      }),
  },

  dashboard: {
    stats: () => request<DashboardStats>("/dashboard/stats"),
    analyzePatterns: () => request<PatternAnalysis>("/dashboard/analyze-patterns", { method: "POST" }),
  },

  settings: {
    getGuidelines: () => request<BrandGuidelines>("/settings/guidelines"),
    updateGuidelines: (content: string) =>
      request<BrandGuidelines>("/settings/guidelines", {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },

  integrations: {
    status: () => request<{ slack: boolean; notion: boolean }>("/integrations/status"),
    saveSlack: (bot_token: string, channel_ids: string[], signing_secret?: string, notification_channel_id?: string, legal_channel_id?: string) =>
      request<{ status: string }>("/integrations/slack/config", {
        method: "POST",
        body: JSON.stringify({ bot_token, channel_ids, signing_secret, notification_channel_id, legal_channel_id }),
      }),
    slackChannels: () => request<SlackChannel[]>("/integrations/slack/channels"),
    fetchSlack: (channel_id: string, limit = 20) =>
      request<{ queued: number; review_ids: number[] }>(
        `/integrations/slack/fetch?channel_id=${channel_id}&limit=${limit}`,
        { method: "POST" }
      ),
    saveNotion: (api_key: string, database_ids: string[], backup_database_id?: string) =>
      request<{ status: string }>("/integrations/notion/config", {
        method: "POST",
        body: JSON.stringify({ api_key, database_ids, backup_database_id }),
      }),
    notionDatabases: () => request<NotionDatabase[]>("/integrations/notion/databases"),
    fetchNotion: (database_id: string, content_type: string, limit = 20) =>
      request<{ queued: number; review_ids: number[] }>(
        `/integrations/notion/fetch?database_id=${database_id}&content_type=${content_type}&limit=${limit}`,
        { method: "POST" }
      ),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ComplianceFlag {
  text: string;
  issue: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}

export interface Review {
  id: number;
  user_id: number;
  content_type: string;
  original_content: string;
  source: string;
  source_reference?: string;
  jurisdiction?: string;
  source_filename?: string;
  brand_score?: number;
  brand_feedback?: string;
  compliance_flags?: ComplianceFlag[];
  risk_score?: number;
  sentiment?: string;
  sentiment_score?: number;
  sentiment_feedback?: string;
  suggested_rewrite?: string;
  overall_rating?: string;
  summary?: string;
  status: "pending" | "completed" | "error";
  error_message?: string;
  legal_status?: "pending" | "approved" | "rejected" | null;
  legal_reviewed_by?: number | null;
  legal_reviewed_at?: string | null;
  legal_note?: string | null;
  created_at: string;
  user?: User;
}

export interface DashboardStats {
  total_reviews: number;
  avg_brand_score?: number;
  reviews_this_week: number;
  top_issues: string[];
  rating_distribution: Record<string, number>;
  sentiment_distribution: Record<string, number>;
  content_type_distribution: Record<string, number>;
  recent_reviews: Review[];
}

export interface BrandGuidelines {
  id: number;
  content: string;
  updated_at: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

export interface NotionDatabase {
  id: string;
  title: string;
}

export interface PatternAnalysis {
  patterns: string[];
  sentiment_insights: string;
  jurisdiction_notes: Record<string, string>;
  guideline_suggestions: { suggestion: string; rationale: string }[];
}
