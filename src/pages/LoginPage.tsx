import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, TrendingUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { mapAuthProfile, useAuthStore } from "@/store/useAuthStore";

export function LoginPage() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Magic-link recovery mode (for users who haven't set a password yet)
  const [linkMode, setLinkMode] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  const sendMagicLink = async (event?: FormEvent) => {
    event?.preventDefault();
    setLinkSubmitting(true);
    setLinkError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: linkEmail.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // Only allows existing accounts
      },
    });
    setLinkSubmitting(false);
    if (otpError) {
      setLinkError(otpError.message);
    } else {
      setLinkSent(true);
    }
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      setSubmitting(false);
      setError(authError?.message ?? "Unable to sign in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("crm_users")
      .select("id,name,email,role,avatar,is_active,credit_balance,telemarketer_access,telemarketer_id,created_at")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError("Signed in, but no CRM profile was found for this account.");
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError("This CRM account is inactive.");
      return;
    }

    login(mapAuthProfile(profile));
    navigate("/");
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
            WAV Telemarketing &amp; Advisory CRM
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-9"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-9"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            <Lock className="h-4 w-4" />
            {submitting ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            New to Dealflow?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {!linkMode ? (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setLinkMode(true)}
            >
              <Send className="h-4 w-4" />
              Sign in with a magic link
            </Button>
          ) : linkSent ? (
            <div className="rounded-md border border-green-500/25 bg-green-500/10 px-3 py-3 text-sm text-green-700 dark:text-green-300 text-center">
              Check your inbox — a sign-in link is on its way.
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="link-email">Your email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="link-email"
                    type="email"
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              {linkError && (
                <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {linkError}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLinkMode(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gap-2" disabled={linkSubmitting}>
                  <Send className="h-4 w-4" />
                  {linkSubmitting ? "Sending…" : "Send link"}
                </Button>
              </div>
            </form>
          )}
        </form>
      </div>
    </div>
  );
}
