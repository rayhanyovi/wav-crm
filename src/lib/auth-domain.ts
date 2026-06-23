// Registration domain gate. Supabase Auth and the handle_new_user trigger will
// create pending users for valid signups; this helper controls who may start
// that flow from the app UI.

export const ALLOWED_REGISTRATION_DOMAIN = "sg-alliance.com";
export const SUPER_ADMIN_EMAIL = "tech@wav.sg";
export const REGISTRATION_EMAIL_POLICIES = ["company", "any"] as const;

export type RegistrationEmailPolicy = (typeof REGISTRATION_EMAIL_POLICIES)[number];

/**
 * Emails explicitly whitelisted outside the company domain.
 * Remove entries here once testing is complete.
 */
export const ALLOWED_TEST_EMAILS: readonly string[] = [
  "yovihan@gmail.com",
  "rayhan.yovi@gmail.com",
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The single super-admin exception. */
export function isSuperAdminEmail(email: string): boolean {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

export function normalizeRegistrationEmailPolicy(value: unknown): RegistrationEmailPolicy {
  return String(value ?? "").trim().toLowerCase() === "any" ? "any" : "company";
}

export function getRegistrationEmailPolicy(): RegistrationEmailPolicy {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return normalizeRegistrationEmailPolicy(env?.VITE_REGISTRATION_EMAIL_POLICY);
}

export function allowsAnyRegistrationEmail(
  policy: RegistrationEmailPolicy = getRegistrationEmailPolicy(),
): boolean {
  return policy === "any";
}

/**
 * True if the email may register:
 *   - the super-admin address (tech@wav.sg)
 *   - any address on the allowed company domain (@sg-alliance.com)
 *   - any explicitly whitelisted test email
 *   - any syntactically valid email when staging opts into the "any" policy
 */
export function isAllowedRegistrationEmail(
  email: string,
  policy: RegistrationEmailPolicy = getRegistrationEmailPolicy(),
): boolean {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  if (at <= 0 || at === e.length - 1) return false;
  if (allowsAnyRegistrationEmail(policy)) return true;
  if (e === SUPER_ADMIN_EMAIL) return true;
  if ((ALLOWED_TEST_EMAILS as string[]).includes(e)) return true;
  return e.endsWith("@" + ALLOWED_REGISTRATION_DOMAIN);
}
