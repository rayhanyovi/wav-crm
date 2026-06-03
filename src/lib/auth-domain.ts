// Registration domain gate (also enforced server-side by the
// public.handle_new_auth_user trigger on auth.users — this is UX-only).

export const ALLOWED_REGISTRATION_DOMAIN = "sg-alliance.com";
export const SUPER_ADMIN_EMAIL = "tech@wav.sg";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The single super-admin exception. */
export function isSuperAdminEmail(email: string): boolean {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

/**
 * True if the email may register: the super-admin address, or any
 * address on the allowed company domain.
 */
export function isAllowedRegistrationEmail(email: string): boolean {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  if (at <= 0 || at === e.length - 1) return false;
  if (e === SUPER_ADMIN_EMAIL) return true;
  return e.endsWith("@" + ALLOWED_REGISTRATION_DOMAIN);
}
