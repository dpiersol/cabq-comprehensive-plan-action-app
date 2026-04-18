import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import "../index.css";
import "./admin.css";
import { AdminApp } from "./AdminApp";
import { AdminAuthGate } from "./AdminAuthGate";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { EntraAuthSync } from "../components/EntraAuthSync";
import { isMockAuthMode } from "../auth/entraEligibility";
import { getMsalConfiguration } from "../msal/msalConfig";
import { registerMsalInstance } from "../msal/msalInstance";

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);

  if (isMockAuthMode()) {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <AdminAuthGate>
            <AdminApp />
          </AdminAuthGate>
        </ErrorBoundary>
      </StrictMode>,
    );
    return;
  }

  const pca = new PublicClientApplication(getMsalConfiguration());
  await pca.initialize();
  registerMsalInstance(pca);
  await pca.handleRedirectPromise();

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <MsalProvider instance={pca}>
          <EntraAuthSync>
            <AdminAuthGate>
              <AdminApp />
            </AdminAuthGate>
          </EntraAuthSync>
        </MsalProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
