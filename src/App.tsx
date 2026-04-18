import { Navigate, Route, Routes } from "react-router-dom";
import { ComposerApp } from "./ComposerApp";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { AppHomePage } from "./pages/AppHomePage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { LandingPage } from "./pages/LandingPage";

/** Top-level routes: public landing, OAuth callback, access denied, protected home + composer. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/compose"
        element={
          <ProtectedRoute>
            <ComposerApp />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
