/**
 * Load demo workflow data (30 submissions by default: 6 steps × 5 each).
 * Usage: npm run seed:demo
 */
import { initDb } from "../db/client.js";
import { runDemoWorkflowSeed } from "../db/seedDemoWorkflow.js";
import { seedUsers } from "../db/seed.js";

const { sqlite, db } = initDb();
seedUsers(sqlite);
const { inserted } = runDemoWorkflowSeed(sqlite, db);
console.log(`Seeded ${inserted} demo workflow submissions (ids prefixed with "demo-").`);
