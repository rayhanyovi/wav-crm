import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, Phone, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { mapAuthProfile, useAuthStore } from "@/store/useAuthStore";
import type { UserRole } from "@/data/types";

const SEEDED_PASSWORD = "WavCRM@2026!";

const roleAccounts: Array<{
  name: string;
  email: string;
  role: UserRole;
  icon: typeof TrendingUp;
  desc: string;
}> = [
  {
    name: "WAV Master",
    email: "master@wav.sg",
    role: "MASTER",
    icon: TrendingUp,
    desc: "Full access, team controls, audit logs, and all leads.",
  },
  {
    name: "Junhao",
    email: "junhao@wav.sg",
    role: "ADVISER",
    icon: Users,
    desc: "Adviser account with assigned leads, deals, and follow-ups.",
  },
  {
    name: "Javier",
    email: "javier@wav.sg",
    role: "ADVISER",
    icon: Users,
    desc: "Second adviser account for role and ownership testing.",
  },
  {
    name: "Yinesa",
    email: "yinesa@wav.sg",
    role: "TELEMARKETER",
    icon: Phone,
    desc: "Telemarketer account for cold-call queues and handoffs.",
  },
  {
    name: "Zee",
    email: "zee@wav.sg",
    role: "TELEMARKETER",
    icon: Phone,
    desc: "Second telemarketer account for import and calling flows.",
  },
];

const roleBadgeClass: Record<UserRole, string> = {
  MASTER: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  ADVISER: "border-primary/25 bg-primary/10 text-primary",
  TELEMARKETER: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export function LoginPage() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState(roleAccounts[0].email);
  const [password, setPassword] = useState(SEEDED_PASSWORD);
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

  const fillAccount = (account: (typeof roleAccounts)[number]) => {
    setEmail(account.email);
    setPassword(SEEDED_PASSWORD);
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <section className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
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
      </section>

      <aside className="hidden w-[520px] border-l bg-muted/30 p-8 lg:flex lg:flex-col lg:justify-center">
        <div className="mb-5">
          <p className="text-sm font-medium text-muted-foreground">Seeded role accounts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the shared seed password for any account.
          </p>
        </div>

        <div className="space-y-2">
          {roleAccounts.map((account) => {
            const Icon = account.icon;
            return (
              <button
                key={account.email}
                type="button"
                onClick={() => fillAccount(account)}
                className="flex w-full items-start gap-3 rounded-lg border bg-background p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-card"
              >
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{account.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass[account.role]}`}>
                      {account.role}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{account.email}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{account.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
