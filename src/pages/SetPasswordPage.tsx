import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";

export function SetPasswordPage() {
  const navigate = useNavigate();
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setSubmitting(false);
      setError(updateErr.message);
      return;
    }

    // Clear the must_change_password flag in the DB and local store
    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData.session?.user?.id;
    if (authUserId) {
      await supabase
        .from("crm_users")
        .update({ must_change_password: false })
        .eq("auth_user_id", authUserId);
    }
    clearMustChangePassword();

    setSubmitting(false);
    setDone(true);
    setTimeout(() => navigate("/"), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <TrendingUp className="h-6 w-6" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">Dealflow</span>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-semibold">Password set!</p>
            <p className="text-sm text-muted-foreground">Taking you to the dashboard…</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div>
              <h1 className="text-lg font-semibold">Set your password</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Choose a strong password — you'll use it to sign in from now on.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  placeholder="Same as above"
                  autoComplete="new-password"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              className="w-full gap-2"
              disabled={submitting || !password || !confirm}
              onClick={() => void handleSubmit()}
            >
              <Lock className="h-4 w-4" />
              {submitting ? "Saving…" : "Set password & continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
