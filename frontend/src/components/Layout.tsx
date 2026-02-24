import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard, PlusCircle, History, Settings,
  Plug, Users, LogOut, BookOpen
} from "lucide-react";

const nav = [
  { to: "/", icon: BookOpen, label: "Guide" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/review/new", icon: PlusCircle, label: "New Review" },
  { to: "/history", icon: History, label: "History" },
  { to: "/integrations", icon: Plug, label: "Integrations" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-60 bg-near-dark flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🤗</span>
            <span className="font-bold text-white text-lg">Bartholomew</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">by NEAR Foundation</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-near-green bg-white/5"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-near-green bg-white/5"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Users size={18} />
              Team
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-near-green rounded-full flex items-center justify-center text-near-dark text-sm font-bold">
              {(user?.full_name || user?.email || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.full_name || user?.email}
              </p>
              {user?.is_admin && (
                <p className="text-xs text-near-green">Admin</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white w-full transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
