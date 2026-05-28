import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useCrmStore } from "@/store/useCrmStore";
import { Phone, TrendingUp, Users } from "lucide-react";
import type { User } from "@/data/types";

const roleConfig = {
  MASTER: {
    icon: TrendingUp,
    color: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-100 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    desc: "Full access. See all advisers' leads, manage team, view audit logs.",
  },
  ADVISER: {
    icon: Users,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/25",
    desc: "See own leads, log calls, set appointments, run calling sessions.",
  },
  TELEMARKETER: {
    icon: Phone,
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    desc: "Cold call prospects, qualify leads, hand off to assigned adviser.",
  },
};

export function LoginPage() {
  const { login } = useAuthStore();
  const { users } = useCrmStore();
  const navigate = useNavigate();

  const handleSelect = (user: User) => {
    login(user);
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-card p-6 sm:p-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <TrendingUp className="h-6 w-6" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">Dealflow</span>
        </div>
        <p className="text-lg font-medium text-foreground/80">WAV Telemarketing &amp; Advisory CRM</p>
        <p className="mt-1 text-sm text-muted-foreground">Select a role to explore the prototype</p>
      </div>

      {/* Role cards */}
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => {
          const cfg = roleConfig[user.role];
          if (!cfg) return null;
          const Icon = cfg.icon;
          return (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className={`
                group flex min-h-[148px] items-start gap-4 rounded-lg border bg-card/90 p-5 text-left
                ${cfg.border}
                cursor-pointer shadow-sm shadow-primary/5 backdrop-blur
                transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10 active:translate-y-0
              `}
            >
              <div className={`mt-0.5 rounded-lg p-2.5 shadow-sm transition-transform duration-150 group-hover:scale-105 ${cfg.bg} ${cfg.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-semibold text-foreground">{user.name}</span>
                  <span className={`rounded-full bg-background px-2 py-0.5 text-xs font-medium shadow-sm ${cfg.color}`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="mt-1.5 text-sm text-foreground/70">{cfg.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">Prototype demo — no passwords required</p>
    </div>
  );
}
