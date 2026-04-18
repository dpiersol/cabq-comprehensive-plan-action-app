import bcrypt from "bcryptjs";

/**
 * Work factor for bcrypt. 12 is a common modern default (≈150ms on a 2024
 * laptop). Overridable via `BCRYPT_ROUNDS` for test speed (tests use 4).
 */
function rounds(): number {
  const raw = process.env.BCRYPT_ROUNDS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 4 && n <= 15) return n;
  }
  if (process.env.VITEST) return 4;
  return 12;
}

/**
 * Validate a password against the Comprehensive Plan Action app policy.
 *   • minimum 12 characters
 *   • at least 3 of {lower, upper, digit, symbol}
 *   • not equal to (or substring of) the email / username / display name
 *
 * Returns an array of human-readable error messages. Empty array ⇒ OK.
 */
export function validatePasswordPolicy(
  password: string,
  ctx?: { username?: string; email?: string; displayName?: string },
): string[] {
  const errors: string[] = [];
  if (typeof password !== "string") {
    return ["Password is required."];
  }
  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long.");
  }
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (classes < 3) {
    errors.push(
      "Password must include at least 3 of: lowercase, uppercase, digit, symbol.",
    );
  }
  const lower = password.toLowerCase();
  const bad = [ctx?.username, ctx?.email, ctx?.displayName]
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter((s) => s.length >= 4);
  for (const token of bad) {
    if (lower.includes(token)) {
      errors.push("Password cannot contain your username, email, or name.");
      break;
    }
  }
  return errors;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, rounds());
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
