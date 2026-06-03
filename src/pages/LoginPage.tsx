import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, TrendingUp } from "lucide-react";
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
        </form>
      </div>
    </div>
  );
}
