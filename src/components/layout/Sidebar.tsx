import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { can, isTelemarketer } from "@/lib/permissions";
import { useState } from "react";
import {
  adminItems,
  navItems,
  type NavigationItem,
} from "./navigationItems";

export function Sidebar() {
  const { currentUser } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const initials =
    currentUser?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CP";

  const getChildren = (item: NavigationItem): NavigationItem[] | null => {
    return item.children?.length ? item.children : null;
  };

  // Auto-expand groups that contain the active route
  const getInitialExpanded = () => {
    const expanded: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.children?.some((c) => location.pathname.startsWith(c.href))) {
        expanded[item.label] = true;
      }
    });
    return expanded;
  };
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(getInitialExpanded);

  const isChildActive = (item: NavigationItem) => {
    const path = item.href.split("?")[0];
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const isGroupActive = (_label: string, children: NavigationItem[]) => {
    return children.some(isChildActive);
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl shadow-primary/10 transition-all duration-200",
        collapsed ? "w-16" : "w-56",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center justify-between border-sidebar-border px-3",
          collapsed && "justify-center gap-1 px-1",
        )}
      >
        <div className={cn("flex items-center", collapsed ? "gap-1" : "gap-3")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <TrendingUp className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              CRM Pro
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {!collapsed && (
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            Main
          </div>
        )}
        {navItems.map((item) => {
          if (!can(currentUser, item.minRole)) return null;
          const children = getChildren(item)?.filter((child) =>
            can(currentUser, child.minRole),
          );
          const active = children?.length
            ? isGroupActive(item.label, children)
            : location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));

          // Collapsed sidebar: show parent icon, highlight if a child is active
          if (children?.length && collapsed) {
            return (
              <Link
                key={item.href}
                to={children[0].href}
                className={cn(
                  "flex items-center justify-center rounded-md border-l-2 px-0 py-2 text-sm transition-all duration-150",
                  active
                    ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                title={item.label}
              >
                <item.icon className="h-4 w-4 shrink-0" />
              </Link>
            );
          }

          if (children?.length && !collapsed) {
            const expanded = expandedGroups[item.label] ?? false;
            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((current) => ({
                      ...current,
                      [item.label]: !expanded,
                    }))
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-all duration-150",
                    active
                      ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                    {children.map((child) => {
                      const childActive = isChildActive(child);
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                            childActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-all duration-150",
                active
                  ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center border-l-0 px-0",
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {adminItems.some((i) => can(currentUser, i.minRole)) && (
          <>
            <div
              className={cn(
                "my-2 border-t border-sidebar-border",
                collapsed && "mx-2",
              )}
            />
            {!collapsed && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                Admin
              </div>
            )}
            {adminItems.map((item) => {
              if (!can(currentUser, item.minRole)) return null;
              const active = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-all duration-150",
                    active
                      ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center border-l-0 px-0",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {currentUser && (
        <div
          className={cn(
            "border-t border-sidebar-border p-2",
            collapsed && "px-2",
          )}
        >
          {/* ADVISER can click their card to open their own profile/settings */}
          {!isTelemarketer(currentUser) && can(currentUser, "ADVISER") && !collapsed ? (
            <Link
              to={`/team/${currentUser.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg bg-sidebar-accent/70 p-2 transition-colors hover:bg-sidebar-accent group",
              )}
              title="My Profile & Settings"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {currentUser.name}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/55">
                  {currentUser.role}
                </p>
              </div>
              <Settings className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-colors" />
            </Link>
          ) : (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg bg-sidebar-accent/70 p-2",
                collapsed && "justify-center",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {currentUser.name}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/55">
                    {currentUser.role}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
