import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Lock, Mail, TrendingUp, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/data/types";
import { DEV_AUTH_ENABLED, fetchDevAuthUsers } from "@/lib/devAuth";
import { supabase } from "@/lib/supabase";
import { mapAuthProfile, useAuthStore } from "@/store/useAuthStore";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const { login, devLogin } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devUsers, setDevUsers] = useState<User[]>([]);
  const [devUserId, setDevUserId] = useState("");

  // "Set / reset password" mode — sends a password-reset email.
  // Works for first-time users (no password yet) and forgot-password alike.
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    if (!DEV_AUTH_ENABLED) return;
    let cancelled = false;
    fetchDevAuthUsers()
      .then((users) => {
        if (cancelled) return;
        setDevUsers(users);
        setDevUserId((current) => current || users[0]?.id || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dev users.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitDevLogin = () => {
    const user = devUsers.find((u) => u.id === devUserId);
    if (!user) {
      setError("Choose a dev user.");
      return;
    }
    devLogin(user);
    navigate("/");
  };

  const sendResetEmail = async () => {
    setResetSubmitting(true);
    setResetError(null);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/set-password` },
    );
    setResetSubmitting(false);
    if (resetErr) {
      setResetError(resetErr.message);
    } else {
      setResetSent(true);
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
      .select("id,name,email,role,avatar,is_active,credit_balance,telemarketer_access,telemarketer_id,leads_access,created_at,must_change_password")
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

    login(mapAuthProfile(profile), profile.must_change_password ?? false);
    navigate("/");
  };

  if (DEV_AUTH_ENABLED) {
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

          <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Local Docker dev auth</p>
              <p className="text-xs text-muted-foreground">
                Pick a seeded CRM user to test role-specific workflows.
              </p>
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={devUserId} onValueChange={setDevUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose user" />
                </SelectTrigger>
                <SelectContent>
                  {devUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} · {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button className="w-full gap-2" disabled={!devUserId} onClick={submitDevLogin}>
              <Users className="h-4 w-4" />
              Continue as selected user
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => { setResetEmail(email); setResetMode(true); setResetSent(false); setResetError(null); }}
              >
                Forgot / Set password?
              </button>
            </div>
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
        </form>

        {/* ── Set / Reset password panel ───────────────────────────────────── */}
        {resetMode && (
          <div className="mt-6 rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">
              {resetSent ? "Check your inbox" : "Set or reset your password"}
            </p>
            {resetSent ? (
              <>
                <p className="text-sm text-muted-foreground">
                  A password-setup link was sent to <strong>{resetEmail}</strong>.
                  Click the link in the email to choose your password.
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setResetMode(false)}>
                  Back to sign in
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  We'll email you a link. Click it to set (or reset) your password, then sign in normally.
                </p>
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-9"
                      placeholder="you@example.com"
                      onKeyDown={(e) => { if (e.key === "Enter" && resetEmail.trim()) void sendResetEmail(); }}
                    />
                  </div>
                  {resetError && (
                    <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {resetError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setResetMode(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 gap-2"
                      disabled={resetSubmitting || !resetEmail.trim()}
                      onClick={() => void sendResetEmail()}
                    >
                      <Send className="h-4 w-4" />
                      {resetSubmitting ? "Sending…" : "Send link"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
