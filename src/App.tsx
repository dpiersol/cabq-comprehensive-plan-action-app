import { Navigate, Route, Routes } from "react-router-dom";
import { ComposerApp } from "./ComposerApp";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { LandingPage } from "./pages/LandingPage";

/** Top-level routes: public landing, OAuth callback, access denied, protected composer app. */
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
            <ComposerApp />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
