import {
  Activity,
  BarChart3,
  BookUser,
  Boxes,
  Building2,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  Package,
  Shield,
  TrendingUp,
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

export const accountItems: NavigationItem[] = [
  { href: "/leads", label: "Leads", icon: Users, minRole: "VIEWER" as const },
  { href: "/contacts", label: "Contacts", icon: UserCheck, minRole: "VIEWER" as const },
  { href: "/companies", label: "Companies", icon: Building2, minRole: "VIEWER" as const },
];

export const campaignItems: NavigationItem[] = [
  { href: "/campaigns?tab=campaigns", label: "Campaigns", icon: Megaphone, minRole: "VIEWER" as const },
  { href: "/campaigns?tab=products", label: "Products", icon: Package, minRole: "VIEWER" as const },
  { href: "/campaigns?tab=bundles", label: "Bundles", icon: Boxes, minRole: "VIEWER" as const },
  { href: "/campaigns?tab=performance", label: "Performance", icon: BarChart3, minRole: "VIEWER" as const },
];

export const navItems: NavigationItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "VIEWER" as const },
  { href: "/leads", label: "Accounts", icon: BookUser, minRole: "VIEWER" as const },
  { href: "/deals", label: "Deals", icon: TrendingUp, minRole: "VIEWER" as const },
  { href: "/activities", label: "Activities", icon: Activity, minRole: "VIEWER" as const },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, minRole: "VIEWER" as const },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, minRole: "VIEWER" as const },
];

export const adminItems: NavigationItem[] = [
  { href: "/team", label: "Team", icon: UserCog, minRole: "MANAGER" as const },
  { href: "/audit-logs", label: "Audit Logs", icon: Shield, minRole: "ADMIN" as const },
];
