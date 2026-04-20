/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_CLIENT_ID?: string;
  readonly VITE_AZURE_TENANT_ID?: string;
  readonly VITE_AZURE_REDIRECT_URI?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAINS?: string;
  readonly VITE_ENTRA_ROLE_ADMIN?: string;
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_E2E_MOCK_AUTH?: string;
  /** Entra delegated scope for `/api/submissions` (defaults to api://CLIENT_ID/access_as_user). */
  readonly VITE_API_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
