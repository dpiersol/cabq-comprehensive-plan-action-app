import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./admin.css";
import { AdminApp } from "./AdminApp";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { seedTestData } from "./seedTestData";

const seeded = seedTestData();
if (seeded > 0) console.log(`Seeded ${seeded} test submissions`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </StrictMode>,
);
