import {
  Check,
  ChevronDown,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  PanelLeft,
  PanelTop,
  Phone,
  RefreshCcw,
  Search,
  Sun,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useCrmStore } from "@/store/useCrmStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getHelpContent } from "../../../help";
import {
  adminItems,
  navItems,
  type NavigationItem,
} from "./navigationItems";

interface TopBarProps {
  onSearchOpen: () => void;
  onStartCalling: () => void;
  darkMode: boolean;
  toggleDark: () => void;
}

function LayoutMenuItem({
  checked,
  icon: Icon,
  label,
  onSelect,
}: {
  checked: boolean;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      <Icon className="h-4 w-4 mr-2" />
      {label}
      {checked && <Check className="ml-auto h-4 w-4" />}
    </DropdownMenuItem>
  );
}

function isPathActive(pathname: string, href: string) {
  const baseHref = href.split("?")[0];
  return (
    pathname === baseHref || (baseHref !== "/" && pathname.startsWith(baseHref))
  );
}

function getDropdownChildren(_label: string): NavigationItem[] | null {
  return null;
}

function NavDropdown({
  item,
  items,
  pathname,
  search,
}: {
  item: NavigationItem;
  items: NavigationItem[];
  pathname: string;
  search: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const selectedChild = items.find((child) => isPathActive(pathname, child.href));
  const TriggerIcon = selectedChild?.icon ?? item.icon;
  const active = items.some((child) => isPathActive(pathname, child.href));

  const openMenu = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const closeMenu = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 280);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && setOpen(false)}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onPointerEnter={openMenu}
          onPointerLeave={closeMenu}
          onPointerDown={(event) => event.preventDefault()}
          onClick={(event) => event.preventDefault()}
          className={cn(
            "inline-flex h-14 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
            active
              ? "border-sidebar-primary text-sidebar-foreground"
              : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-primary/50 hover:text-sidebar-foreground",
          )}
        >
          <TriggerIcon className="h-4 w-4" />
          {selectedChild?.label ?? item.label}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={2}
        className="w-48"
        onPointerEnter={openMenu}
        onPointerLeave={closeMenu}
        onInteractOutside={() => setOpen(false)}
        onEscapeKeyDown={() => setOpen(false)}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {items.map((child) => {
          const childActive = isPathActive(pathname, child.href);

          return (
            <DropdownMenuItem key={child.href} asChild>
              <Link
                to={child.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "cursor-pointer",
                  childActive && "bg-primary text-primary-foreground",
                )}
              >
                <child.icon className="h-4 w-4" />
                {child.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({
  onSearchOpen,
  onStartCalling,
  darkMode,
  toggleDark,
}: TopBarProps) {
  const { currentUser, logout } = useAuthStore();
  const { resetToSeed } = useCrmStore();
  const { active: sessionActive } = useCallSessionStore();
  const { layoutMode, setLayoutMode } = useLayoutStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedHelpOptionId, setSelectedHelpOptionId] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    { Accounts: true },
  );
  const helpContent = getHelpContent(location.pathname);
  const selectedHelpOption =
    helpContent.options.find((option) => option.id === selectedHelpOptionId) ??
    helpContent.options[0];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleReset = () => {
    if (confirm("Reset all data to seed? This cannot be undone.")) {
      resetToSeed();
    }
  };

  const renderSearchButton = (className?: string) => (
    <Button
      variant="outline"
      size="sm"
      onClick={onSearchOpen}
      className={cn(
        "gap-1.5 text-muted-foreground",
        layoutMode === "navbar" &&
          "border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground hover:border-sidebar-primary/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className,
      )}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">Search</span>
      <kbd className="hidden xl:inline text-xs bg-muted/10 px-1 rounded">
        Ctrl+K
      </kbd>
    </Button>
  );

  const startCallingButton =
    can(currentUser, "TELEMARKETER") && !can(currentUser, "MASTER") ? (
      <Button
        size="sm"
        onClick={onStartCalling}
        className="gap-1.5"
        variant={sessionActive ? "secondary" : "default"}
      >
        <Phone className="h-4 w-4" />
        <span className="hidden xl:inline">
          {sessionActive ? "Session Active" : "Start Calling"}
        </span>
      </Button>
    ) : null;

  const nav = (
    <nav className="flex min-w-0 items-center justify-center gap-1 overflow-x-auto">
      {[...navItems, ...adminItems].map((item) => {
        if (!can(currentUser, item.minRole)) return null;

        const dropdownChildren = getDropdownChildren(item.label);
        if (dropdownChildren) {
          return (
            <NavDropdown
              key={item.href}
              item={item}
              items={dropdownChildren.filter((child) =>
                can(currentUser, child.minRole),
              )}
              pathname={location.pathname}
              search={location.search}
            />
          );
        }

        const active = isPathActive(location.pathname, item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "inline-flex h-14 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
              active
                ? "border-sidebar-primary text-sidebar-foreground"
                : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-primary/50 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "gap-2 px-2",
            layoutMode === "navbar" &&
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {currentUser?.avatar ||
                currentUser?.name?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden lg:inline text-sm">{currentUser?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{currentUser?.name}</div>
          <div className="text-xs text-muted-foreground">
            {currentUser?.role}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setHelpOpen(true)}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Help
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleDark}>
          {darkMode ? (
            <Sun className="h-4 w-4 mr-2" />
          ) : (
            <Moon className="h-4 w-4 mr-2" />
          )}
          {darkMode ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          Settings
        </DropdownMenuLabel>
        <LayoutMenuItem
          checked={layoutMode === "sidebar"}
          icon={PanelLeft}
          label="Sidebar layout"
          onSelect={() => setLayoutMode("sidebar")}
        />
        <LayoutMenuItem
          checked={layoutMode === "navbar"}
          icon={PanelTop}
          label="Navbar layout"
          onSelect={() => setLayoutMode("navbar")}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleReset}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Reset Data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderMobileNavItem = (item: NavigationItem) => (
    <Link
      key={item.href}
      to={item.href}
      onClick={() => setMobileNavOpen(false)}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isPathActive(location.pathname, item.href)
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );

  const mobileNav = (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-72 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            CRM Pro
          </SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation menu
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-5 space-y-1">
          {[...navItems, ...adminItems].map((item) => {
            if (!can(currentUser, item.minRole)) return null;
            const children = getDropdownChildren(item.label);
            if (!children) return renderMobileNavItem(item);

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
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {children
                      .filter((child) => can(currentUser, child.minRole))
                      .map((child) => renderMobileNavItem(child))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      <header
        className={cn(
          "h-14 shrink-0 border-b",
          layoutMode === "navbar"
            ? "border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg shadow-primary/10"
            : "bg-background",
        )}
      >
        <div className="mx-auto hidden h-full w-full grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] items-center gap-3 px-6 xl:grid">
          {layoutMode !== "navbar" ? (
            <div></div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/"
                className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-sidebar-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <TrendingUp className="h-4 w-4" />
                </span>
                CRM Pro
              </Link>
              {renderSearchButton()}
            </div>
          )}

          {layoutMode === "navbar" ? nav : <div />}

          <div className="flex min-w-0 items-center justify-end gap-2">
            {startCallingButton}
            {layoutMode !== "navbar" && renderSearchButton()}
            <NotificationBell />
            {profileMenu}
          </div>
        </div>

        <div className="flex h-full items-center gap-2 px-3 xl:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            {renderSearchButton("w-full justify-start")}
          </div>
          {startCallingButton}
          <NotificationBell />
          {profileMenu}
        </div>
      </header>

      {mobileNav}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="flex h-[80vh] max-h-[80vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader>
            <div className="border-b px-6 py-4">
              <DialogTitle>Help</DialogTitle>
              {/* <DialogTitle>{helpContent.pageTitle}</DialogTitle> */}
              {/* <DialogDescription>{helpContent.pageSummary}</DialogDescription> */}
            </div>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="min-h-0 border-b bg-muted/40 p-3 md:border-b-0 md:border-r">
              <div className="h-full space-y-1 overflow-y-auto">
                {helpContent.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedHelpOptionId(option.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                      selectedHelpOption?.id === option.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                    )}
                  >
                    {option.title}
                  </button>
                ))}
              </div>
            </div>

            {selectedHelpOption && (
              <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 pb-20">
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedHelpOption.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedHelpOption.summary}
                  </p>
                </div>

                <HelpSection items={selectedHelpOption.body} />
                <HelpSection
                  title="Steps"
                  items={selectedHelpOption.steps}
                  ordered
                />
                <HelpSection title="Tips" items={selectedHelpOption.tips} />
                <HelpSection
                  title="Role Notes"
                  items={selectedHelpOption.roleNotes}
                />
                <HelpSection
                  title="Related Data"
                  items={selectedHelpOption.relatedData}
                  compact
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HelpSection({
  title,
  items,
  ordered = false,
  compact = false,
}: {
  title?: string;
  items?: string[];
  ordered?: boolean;
  compact?: boolean;
}) {
  if (!items?.length) return null;

  if (compact) {
    return (
      <section>
        {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </section>
    );
  }

  const List = ordered ? "ol" : "ul";

  return (
    <section>
      {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
      <List
        className={cn(
          "space-y-2 text-sm text-foreground/80",
          ordered ? "list-decimal pl-5" : "list-disc pl-5",
        )}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </section>
  );
}
