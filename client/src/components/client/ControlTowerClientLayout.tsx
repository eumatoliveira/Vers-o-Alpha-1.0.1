import { useMemo, useState, type ReactNode } from "react";
import { m } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  canAccessClientDomain,
  getDefaultDashboardPathByRole,
  resolveClientDashboardRole,
  type ClientDashboardRole,
  type ClientDomainModule,
} from "@/lib/clientDashboardRole";
import {
  Activity,
  Bell,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  Database,
  DollarSign,
  LogOut,
  LayoutGrid,
  Menu,
  Moon,
  ShieldAlert,
  Star,
  Sun,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardParticleField from "@/animation/components/DashboardParticleField";
import { useClientDashboardTheme } from "@/contexts/ClientDashboardThemeContext";
import { getPlanDashboardSidebarLabels } from "@shared/controlTowerRules";

type NavItem = {
  key: ClientDomainModule | "perfil";
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function buildNav(role: ClientDashboardRole, plan: string | null | undefined): NavItem[] {
  const common: NavItem[] = [];
  const planLabels = getPlanDashboardSidebarLabels(plan);

  if (role === "CEO") {
    common.push(
      { key: "ceo", path: "/ceo", label: "Visao CEO", icon: BarChart3 },
      { key: "warroom", path: "/warroom", label: "War Room", icon: ShieldAlert },
      { key: "financeiro", path: "/financeiro", label: planLabels.financeiro, icon: DollarSign },
      { key: "operacoes", path: "/operacoes", label: planLabels.agenda, icon: BriefcaseBusiness },
      { key: "growth", path: "/growth", label: planLabels.marketing, icon: TrendingUp },
      { key: "ingestao", path: "/integracoes", label: "Integracoes", icon: Database },
      { key: "qualidade", path: "/qualidade", label: planLabels.operacao, icon: Star },
      { key: "equipe", path: "/equipe", label: "Equipe", icon: Users },
    );
    return common;
  }

  if (role === "MANAGER") {
    common.push(
      { key: "perfil", path: "/gestor", label: "Gestor Dashboard", icon: BarChart3 },
      { key: "warroom", path: "/warroom", label: "War Room", icon: ShieldAlert },
      { key: "financeiro", path: "/financeiro", label: planLabels.financeiro, icon: DollarSign },
      { key: "operacoes", path: "/operacoes", label: planLabels.agenda, icon: BriefcaseBusiness },
      { key: "growth", path: "/growth", label: planLabels.marketing, icon: TrendingUp },
      { key: "ingestao", path: "/integracoes", label: "Integracoes", icon: Database },
      { key: "qualidade", path: "/qualidade", label: planLabels.operacao, icon: Star },
      { key: "equipe", path: "/equipe", label: "Equipe", icon: Users },
    );
    return common;
  }

  if (role === "TECHNICAL") {
    return [{ key: "ingestao", path: "/integracoes", label: "Integracoes", icon: Database }];
  }

  return [{ key: "perfil", path: "/operacional", label: "Operacional", icon: Activity }];
}

interface ControlTowerClientLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  moduleKey?: ClientDomainModule;
  actions?: ReactNode;
  variant?: "default" | "analytics-compact" | "analytics-full-shell-light";
}

export default function ControlTowerClientLayout({
  children,
  title,
  subtitle,
  moduleKey,
  actions,
  variant = "default",
}: ControlTowerClientLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = resolveClientDashboardRole(user as any);
  const nav = useMemo(
    () =>
      buildNav(role, user?.plan).filter(item => {
        if (item.key === "perfil") return true;
        return canAccessClientDomain(role, item.key as ClientDomainModule, user?.plan);
      }),
    [role, user?.plan],
  );
  const { isDark, toggleTheme } = useClientDashboardTheme();

  const handleLogout = async () => {
    await logout({ redirectTo: "/login" });
  };

  const goHomeForRole = () => {
    setLocation(getDefaultDashboardPathByRole(role));
    setSidebarOpen(false);
  };

  if (variant === "analytics-compact") {
    const compactPlanLabels = getPlanDashboardSidebarLabels(user?.plan);
    const compactNav = [
      { id: "dashboard", icon: LayoutGrid, label: "Dashboard", path: getDefaultDashboardPathByRole(role) },
      { id: "operacoes", icon: CalendarDays, label: compactPlanLabels.agenda, path: canAccessClientDomain(role, "operacoes", user?.plan) ? "/operacoes" : getDefaultDashboardPathByRole(role) },
      { id: "equipe", icon: Users, label: "Equipe", path: canAccessClientDomain(role, "equipe", user?.plan) ? "/equipe" : getDefaultDashboardPathByRole(role) },
      { id: "analytics", icon: BarChart3, label: compactPlanLabels.marketing, path: canAccessClientDomain(role, "growth", user?.plan) ? "/growth" : canAccessClientDomain(role, "financeiro", user?.plan) ? "/financeiro" : getDefaultDashboardPathByRole(role) },
    ];

    return (
      <div className={cn("min-h-screen", isDark ? "bg-black text-white" : "bg-[#f3f4f6] text-[#1f2937]")}>
        {sidebarOpen ? <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <header
          className={cn(
            "sticky top-0 z-50 h-16 border-b shadow-sm",
            isDark ? "border-zinc-800 bg-[#121212]" : "border-slate-700/40 bg-[#1f2d45] text-white",
          )}
        >
          <div className="flex h-full items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded p-2 hover:bg-white/10 sm:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </button>
              <button type="button" onClick={goHomeForRole} className="flex items-center gap-2">
                <img
                  src="/images/logo-badge.jpg"
                  alt="GLX"
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className={cn("text-xl font-light", isDark ? "text-zinc-400" : "text-slate-200")}>Partners</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className={cn("rounded-full p-2 transition-colors", isDark ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-slate-200 hover:bg-white/10")}
                aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
                title={isDark ? "Light mode" : "Dark mode"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className={cn("hidden rounded-full p-2 transition-colors sm:inline-flex", isDark ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-slate-200 hover:bg-white/10")}
                aria-label="Notificações"
                title="Notificações"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cn("rounded-full p-2 transition-colors", isDark ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-slate-200 hover:bg-white/10")}
                aria-label="Perfil"
                title="Perfil"
              >
                <Users className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  isDark ? "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" : "border-white/20 bg-white/10 text-slate-100 hover:bg-white/15",
                )}
                title="Ajuda"
              >
                <CircleHelp className="h-4 w-4" />
                <span>Help</span>
              </button>
              {actions}
            </div>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-4rem)]">
          <aside
            className={cn(
              "fixed bottom-0 left-0 top-16 z-30 hidden w-16 flex-col items-center border-r py-6 sm:flex",
              isDark ? "border-zinc-800 bg-[#121212]" : "border-gray-200 bg-white",
            )}
          >
            <div className="flex flex-1 flex-col items-center gap-6">
              {compactNav.map((item) => {
                const Icon = item.icon;
                const active = location === item.path || (item.id === "operacoes" && moduleKey === "operacoes");
                return (
                  <Link key={item.id} href={item.path}>
                    <div
                      title={item.label}
                      className={cn(
                        "rounded-lg p-2 transition-colors",
                        active
                          ? "bg-[#FF6600]/10 text-[#FF6600] ring-1 ring-[#FF6600]/20"
                          : isDark
                            ? "text-zinc-500 hover:text-white"
                            : "text-gray-500 hover:text-[#FF6600]",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              title="Sair"
              onClick={handleLogout}
              className={cn("rounded-lg p-2 transition-colors", isDark ? "text-zinc-500 hover:text-white" : "text-gray-500 hover:text-[#FF6600]")}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </aside>

          <m.aside
            className={cn(
              "fixed inset-y-16 left-0 z-50 w-72 border-r transition-transform duration-300 sm:hidden",
              isDark ? "border-zinc-800 bg-[#121212]" : "border-gray-200 bg-white",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex h-full flex-col">
              <div className={cn("flex h-14 items-center justify-between border-b px-4", isDark ? "border-zinc-800" : "border-gray-200")}>
                <p className="text-sm font-semibold">{title}</p>
                <button className="rounded p-1 hover:bg-white/10" onClick={() => setSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.path;
                  return (
                    <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)}>
                      <div
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                          active
                            ? "bg-[#FF6600]/10 text-[#FF6600] ring-1 ring-[#FF6600]/20"
                            : isDark
                              ? "text-zinc-300 hover:bg-white/5 hover:text-white"
                              : "text-slate-600 hover:bg-gray-100 hover:text-slate-900",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
              <div className={cn("space-y-2 border-t p-4", isDark ? "border-zinc-800" : "border-gray-200")}>
                <Button variant="outline" className={cn("w-full justify-start", isDark ? "border-white/10 bg-transparent text-white" : "border-gray-300 bg-white")} onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            </div>
          </m.aside>

          <main className="min-w-0 flex-1 sm:pl-16">
            <div className="p-4 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  if (variant === "analytics-full-shell-light") {
    return (
      <div className="min-h-screen bg-[#eef0f3] text-[#111827]">
        {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <m.aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[#14110f]/95 transition-transform duration-300 supports-[backdrop-filter]:backdrop-blur-2xl lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <button type="button" className="flex items-center gap-3" onClick={goHomeForRole}>
                <img
                  src="/images/logo-badge.jpg"
                  alt="GLX"
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="text-left text-white">
                  <p className="text-sm font-semibold leading-tight">PERFORMANCE</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">CONTROL TOWER</p>
                </div>
              </button>
              <button className="rounded p-1 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.path || (item.key === moduleKey && !!moduleKey);
                  return (
                    <li key={item.path}>
                      <Link href={item.path} onClick={() => setSidebarOpen(false)}>
                        <div
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                            active
                              ? "bg-[#e67e22] text-white shadow-lg shadow-orange-500/20"
                              : "text-slate-300 hover:bg-white/10 hover:text-white",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="space-y-3 border-t border-white/10 p-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Perfil</p>
                <p className="mt-1 text-sm font-medium text-white">{role}</p>
                <p className="truncate text-xs text-slate-400">{user?.email ?? "n/a"}</p>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                {(["pt", "en", "es"] as const).map(code => (
                  <button
                    key={code}
                    type="button"
                    className={cn(
                      "rounded px-2 py-1 text-[11px] font-semibold uppercase",
                      language === code ? "bg-[#e67e22] text-white" : "text-slate-300 hover:bg-white/10",
                    )}
                    onClick={() => setLanguage(code)}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full justify-start border-white/15 bg-transparent text-slate-100 hover:border-red-400 hover:bg-white/5 hover:text-white"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </m.aside>

        <div className="relative lg:pl-72">
          <header className="sticky top-0 z-20 h-16 border-b border-white/10 bg-[#14110f]/92 text-white supports-[backdrop-filter]:backdrop-blur-xl">
            <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button className="rounded p-2 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
                  {subtitle ? <p className="truncate text-xs text-slate-400">{subtitle}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <m.div
                  className="hidden items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 md:flex"
                  whileHover={{ scale: 1.02 }}
                >
                  <m.span
                    className="h-2 w-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  Dados ao vivo
                </m.div>
                <button
                  type="button"
                  className="hidden rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
                  aria-label="Notificações"
                  title="Notificações"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Perfil"
                  title="Perfil"
                >
                  <Users className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/10"
                  title="Ajuda"
                >
                  <CircleHelp className="h-4 w-4" />
                  <span>Help</span>
                </button>
                {actions}
              </div>
            </div>
          </header>

          <main className="relative z-10 space-y-4 bg-[#eef0f3] px-4 py-4 lg:px-6">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#1f2937] dark:bg-[#000000] dark:text-white">
      {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <m.aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-gray-200 bg-white/95 transition-transform duration-300 lg:translate-x-0 supports-[backdrop-filter]:backdrop-blur-2xl dark:border-white/10 dark:bg-[#14110f]/85",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-white/10">
            <button type="button" className="flex items-center gap-3" onClick={goHomeForRole}>
              <img
                src="/images/logo-badge.jpg"
                alt="GLX"
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight">PERFORMANCE</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">CONTROL TOWER</p>
              </div>
            </button>
            <button className="rounded p-1 text-slate-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = location === item.path;
                return (
                  <li key={item.path}>
                    <Link href={item.path} onClick={() => setSidebarOpen(false)}>
                      <div
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                          active
                            ? "bg-[#e67e22] text-white shadow-lg shadow-orange-500/20"
                            : "text-slate-600 hover:bg-gray-100 hover:text-[#1f2937] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-gray-200 p-4 space-y-3 dark:border-white/10">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.2em] text-orange-500 dark:text-orange-300">Perfil</p>
              <p className="mt-1 text-sm font-medium">{role}</p>
              <p className="text-xs text-slate-500 truncate dark:text-slate-400">{user?.email ?? "n/a"}</p>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              {(["pt", "en", "es"] as const).map(code => (
                <button
                  key={code}
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold uppercase",
                    language === code
                      ? "bg-[#e67e22] text-white"
                      : "text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10",
                  )}
                  onClick={() => setLanguage(code)}
                >
                  {code}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full justify-start border-gray-300 bg-white text-slate-700 hover:border-red-400 hover:text-red-600 dark:border-white/15 dark:bg-transparent dark:text-slate-100 dark:hover:text-slate-100"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </m.aside>

      <div className="relative lg:pl-72">
        {isDark ? <DashboardParticleField /> : null}
        <header className="sticky top-0 z-20 h-16 border-b border-gray-200 bg-white/85 supports-[backdrop-filter]:backdrop-blur-xl dark:border-white/10 dark:bg-[#14110f]/70">
          <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded p-2 hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold leading-tight">{title}</h1>
                {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <m.div className="hidden items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 md:flex dark:text-emerald-200" whileHover={{ scale: 1.02 }}>
                <m.span className="h-2 w-2 rounded-full bg-emerald-400" animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.1, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
                Dados ao vivo
              </m.div>
              {actions}
            </div>
          </div>
        </header>

        <main className="relative z-10 space-y-4 px-4 py-4 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
