import { buildServer } from "./app.js";

const app = buildServer();
const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: "0.0.0.0" });
