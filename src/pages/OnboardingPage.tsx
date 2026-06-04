import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Lock, User as UserIcon, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import { completeOnboarding, activateSuperAdmin } from "@/services/users";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-domain";

type Step = "password" | "profile";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { currentUser, accountStatus, authEmail, loadSession } = useAuthStore();

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [requestedRole, setRequestedRole] = useState<"ADVISER" | "TELEMARKETER" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill name from the email local-part as a convenience.
  useEffect(() => {
    if (!name && authEmail) {
      const local = authEmail.split("@")[0]?.replace(/[._-]+/g, " ").trim();
      if (local) setName(local.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }, [authEmail, name]);

  // Route guards: only PENDING_PROFILE users belong here.
  if (currentUser) return <Navigate to="/" replace />;
  if (accountStatus === "PENDING_APPROVAL" || accountStatus === "REJECTED")
    return <Navigate to="/pending" replace />;
  if (accountStatus !== "PENDING_PROFILE") return <Navigate to="/login" replace />;

  const isSuperAdmin = authEmail?.toLowerCase() === SUPER_ADMIN_EMAIL;

  const submitPassword = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    // Super admin skips the role-selection step — activate immediately.
    if (isSuperAdmin) {
      try {
        await activateSuperAdmin();
        await loadSession();
        navigate("/", { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(false);
    setStep("profile");
  };

  const submitProfile = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (requestedRole !== "ADVISER" && requestedRole !== "TELEMARKETER") {
      setError("Please select the role you're requesting.");
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboarding(name.trim(), requestedRole);
      await loadSession();
      navigate("/pending", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
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
            {step === "password" ? "Set your password" : "Tell us about you"}
          </p>
          {authEmail && (
            <p className="mt-1 text-sm text-muted-foreground">{authEmail}</p>
          )}
          {!isSuperAdmin && (
            <p className="mt-2 text-xs text-muted-foreground">Step {step === "password" ? "1" : "2"} of 2</p>
          )}
        </div>

        {step === "password" ? (
          <form onSubmit={submitPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
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
              {submitting ? "Saving…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  autoComplete="name"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Requested role</Label>
              <Select
                value={requestedRole}
                onValueChange={(v) => setRequestedRole(v as "ADVISER" | "TELEMARKETER")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select the role you're requesting…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADVISER">Adviser</SelectItem>
                  <SelectItem value="TELEMARKETER">Telemarketer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A manager will review and activate your account.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for approval"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
