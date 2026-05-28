import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Shield,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/data/types";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole: UserRole;
}

export const navItems: NavigationItem[] = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard, minRole: "TELEMARKETER" },
  { href: "/leads",      label: "Leads",      icon: Users,           minRole: "TELEMARKETER" },
  { href: "/activities", label: "Activities", icon: Activity,        minRole: "TELEMARKETER" },
  { href: "/calendar",   label: "Calendar",   icon: CalendarDays,    minRole: "TELEMARKETER" },
  { href: "/contacts",   label: "Contacts",   icon: UserCheck,       minRole: "ADVISER"      },
];

export const adminItems: NavigationItem[] = [
  { href: "/team",       label: "Team",       icon: UserCog, minRole: "MASTER" },
  { href: "/audit-logs", label: "Audit Logs", icon: Shield,  minRole: "MASTER" },
];
