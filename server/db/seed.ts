import type Database from "better-sqlite3";

export function seedUsers(sqlite: Database.Database): void {
  const row = sqlite.prepare("SELECT COUNT(1) as c FROM users").get() as { c: number };
  if (row.c > 0) return;
  const ins = sqlite.prepare(
    "INSERT INTO users (id, display_name, email, role) VALUES (?, ?, ?, ?)",
  );
  ins.run("user-planning-1", "Planning User", "planning@local.dev", "planning");
  ins.run("user-council-1", "Council User", "council@local.dev", "city_council");
  ins.run("user-submitter-1", "Submitter", "submitter@local.dev", "submitter");
}
