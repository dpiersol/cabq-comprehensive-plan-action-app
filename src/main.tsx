import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EntraAuthSync } from "./components/EntraAuthSync";
import { getMsalConfiguration } from "./msal/msalConfig";
import { registerMsalInstance } from "./msal/msalInstance";

async function bootstrap() {
  const pca = new PublicClientApplication(getMsalConfiguration());
  await pca.initialize();
  registerMsalInstance(pca);
  await pca.handleRedirectPromise();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <MsalProvider instance={pca}>
          <BrowserRouter>
            <EntraAuthSync>
              <App />
            </EntraAuthSync>
          </BrowserRouter>
        </MsalProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
