import { Navigate } from "react-router-dom";
import { Clock, XCircle, TrendingUp, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

export function PendingApprovalPage() {
  const { currentUser, accountStatus, authEmail, requestedRole, logout } =
    useAuthStore();

  if (currentUser) return <Navigate to="/" replace />;
  if (accountStatus === "PENDING_PROFILE") return <Navigate to="/onboarding" replace />;
  if (accountStatus !== "PENDING_APPROVAL" && accountStatus !== "REJECTED")
    return <Navigate to="/login" replace />;

  const rejected = accountStatus === "REJECTED";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <TrendingUp className="h-6 w-6" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">
            Dealflow
          </span>
        </div>

        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            rejected
              ? "bg-destructive/10 text-destructive"
              : "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          }`}
        >
          {rejected ? <XCircle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
        </div>

        <h1 className="text-xl font-bold">
          {rejected ? "Account not approved" : "Awaiting approval"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rejected ? (
            <>
              Your registration was not approved. Please contact your
              administrator if you think this is a mistake.
            </>
          ) : (
            <>
              Thanks{authEmail ? `, ${authEmail}` : ""}! Your account is set up
              and waiting for a manager to activate it
              {requestedRole ? ` as a ${requestedRole.toLowerCase()}` : ""}. You'll
              be able to sign in once it's approved.
            </>
          )}
        </p>

        <Button onClick={() => void logout()} variant="outline" className="mt-6 gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
