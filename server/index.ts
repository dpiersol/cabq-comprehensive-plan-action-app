// Load a .env file from the working directory (if present) BEFORE any other
// imports so modules that read process.env at import-time see the values.
// Real env vars (e.g. ones set by PM2) always win over .env entries.
import { config as loadDotenv } from "dotenv";
loadDotenv();

import { buildServer } from "./app.js";

const app = buildServer();
const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: "0.0.0.0" });
