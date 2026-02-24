import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewReview from "./pages/NewReview";
import ReviewDetail from "./pages/ReviewDetail";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import Admin from "./pages/Admin";
import Guide from "./pages/Guide";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Guide />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/review/new" element={<NewReview />} />
                    <Route path="/review/:id" element={<ReviewDetail />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/integrations" element={<Integrations />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
