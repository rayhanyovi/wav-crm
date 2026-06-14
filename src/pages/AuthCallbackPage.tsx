import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const loadSession = useAuthStore((s) => s.loadSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;

    const next = new URLSearchParams(window.location.search).get("next");

    const finish = async () => {
      if (settled) return;
      settled = true;

      await loadSession();
      const { currentUser, accountStatus } = useAuthStore.getState();

      if (currentUser) {
        navigate(next ?? "/", { replace: true });
      } else if (accountStatus === "PENDING_PROFILE") {
        navigate("/onboarding", { replace: true });
      } else if (
        accountStatus === "PENDING_APPROVAL" ||
        accountStatus === "REJECTED"
      ) {
        navigate("/pending", { replace: true });
      } else {
        settled = false; // allow a later auth event to retry
        setError(
          "We couldn't verify your sign-in link. It may have expired or already been used.",
        );
      }
    };

    // supabase-js auto-detects the token in the URL; this fires on success.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void finish();
    });

    // In case the session was already established before this mounted.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void finish();
    });

    // Fallback so we don't spin forever if no session ever arrives.
    const timer = setTimeout(() => void finish(), 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [loadSession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <TrendingUp className="h-6 w-6" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">
            Dealflow
          </span>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              {error}
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/register">
                <ArrowLeft className="h-4 w-4" />
                Request a new link
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Verifying your sign-in link…</span>
          </div>
        )}
      </div>
    </div>
  );
}
