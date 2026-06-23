import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, TrendingUp, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  ALLOWED_REGISTRATION_DOMAIN,
  allowsAnyRegistrationEmail,
  getRegistrationEmailPolicy,
  isAllowedRegistrationEmail,
} from "@/lib/auth-domain";

export function RegisterPage() {
  const registrationEmailPolicy = getRegistrationEmailPolicy();
  const allowAnyRegistrationEmail = allowsAnyRegistrationEmail(registrationEmailPolicy);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);

    if (!isAllowedRegistrationEmail(email, registrationEmailPolicy)) {
      setError(
        allowAnyRegistrationEmail
          ? "Enter a valid email address."
          : `Registration is restricted to @${ALLOWED_REGISTRATION_DOMAIN} email addresses.`,
      );
      return;
    }

    setSubmitting(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-foreground">
              Dealflow
            </span>
          </div>
          <p className="text-lg font-medium text-foreground/80">
            Create your WAV CRM account
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Check your email</p>
                <p className="mt-1 text-sm">
                  We sent a sign-in link to <strong>{email.trim()}</strong>.
                  Open it on this device to set your password and finish
                  setting up your account.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/login">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {allowAnyRegistrationEmail ? "Email" : "Work email"}
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={
                    allowAnyRegistrationEmail
                      ? "you@example.com"
                      : `you@${ALLOWED_REGISTRATION_DOMAIN}`
                  }
                  className="pl-9"
                  autoComplete="email"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {allowAnyRegistrationEmail
                  ? "Staging registration accepts any email address."
                  : `Only @${ALLOWED_REGISTRATION_DOMAIN} addresses can register.`}
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              <Mail className="h-4 w-4" />
              {submitting ? "Sending link…" : "Send sign-in link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
