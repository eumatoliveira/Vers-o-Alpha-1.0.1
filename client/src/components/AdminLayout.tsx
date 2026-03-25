import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/index";
import { getAdminLayoutCopy, resolveAdminLegend } from "@/lib/dashboardLocale";
import { getAdminLayoutUiCopy } from "@/lib/adminUiLocale";
import { trpc } from "@/lib/trpc";
import {
  GitBranch,
  BriefcaseBusiness,
  AlertTriangle,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
  Circle,
  ChevronRight,
  SlidersHorizontal,
  Bot,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AnimatePresence, m } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useState, createContext, useContext, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { toast } from "sonner";

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => { },
});

export const useAdminTheme = () => useContext(ThemeContext);

interface AdminLayoutProps {
  children: React.ReactNode;
}

type NavKey =
  | "pipeline"
  | "operations"
  | "aiAssistant"
  | "errors"
  | "clientConfig"
  | "integrations"
  | "kommo"
  | "asaas"
  | "googleCalendar"
  | "googleForms"
  | "contractsSheet"
  | "dreSheet";

type NavItem = {
  key: NavKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { key: "pipeline", href: "/admin?view=pipeline", icon: GitBranch },
  { key: "operations", href: "/admin?view=operacao", icon: BriefcaseBusiness },
  { key: "aiAssistant", href: "/admin/assistente-ia", icon: Bot },
  { key: "clientConfig", href: "/admin/client-config", icon: SlidersHorizontal },
  { key: "errors", href: "/admin/erros", icon: AlertTriangle },
];

const INTEGRATION_NAV_ITEMS: NavItem[] = [
  { key: "kommo", href: "/admin/kommo", icon: ChevronRight, compact: true },
  { key: "asaas", href: "/admin/asaas", icon: ChevronRight, compact: true },
  { key: "googleCalendar", href: "/admin/google-calendar", icon: ChevronRight, compact: true },
  { key: "googleForms", href: "/admin/google-forms", icon: ChevronRight, compact: true },
  { key: "contractsSheet", href: "/admin/planilha-contratos", icon: ChevronRight, compact: true },
  { key: "dreSheet", href: "/admin/planilha-dre", icon: ChevronRight, compact: true },
];

const LANGUAGE_OPTIONS: Array<{ code: Language; label: string }> = [
  { code: "pt", label: "PT" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

function GlxSealLogo({ className, darkMode = false }: { className?: string; darkMode?: boolean }) {
  const logoColor = darkMode ? "#f8fafc" : "#111111";
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <path
          id="glx-seal-top"
          d="M 16,60 a 44,44 0 1,1 88,0"
          fill="none"
        />
        <path
          id="glx-seal-bottom"
          d="M 104,60 a 44,44 0 1,1 -88,0"
          fill="none"
        />
      </defs>
      <circle cx="60" cy="60" r="52" fill="none" stroke={logoColor} strokeWidth="4.2" />
      <circle cx="60" cy="60" r="36" fill="none" stroke={logoColor} strokeWidth="2.9" />
      <text
        x="60"
        y="73"
        textAnchor="middle"
        fontSize="37"
        fontWeight="900"
        fill={logoColor}
        fontFamily="Arial, sans-serif"
        letterSpacing="-1.6"
      >
        GLX
      </text>
      <text
        fill={logoColor}
        fontSize="9.6"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        letterSpacing="0.55"
      >
        <textPath href="#glx-seal-top" startOffset="50%" textAnchor="middle">
          GROWTH.LEAN.EXECUTION
        </textPath>
      </text>
      <text
        fill={logoColor}
        fontSize="9.6"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        letterSpacing="0.55"
      >
        <textPath href="#glx-seal-bottom" startOffset="50%" textAnchor="middle">
          GROWTH.LEAN.EXECUTION
        </textPath>
      </text>
    </svg>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { language, setLanguage } = useLanguage();
  const copy = getAdminLayoutCopy(language);
  const uiCopy = getAdminLayoutUiCopy(language);
  const [currentSearch, setCurrentSearch] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  const currentPathWithSearch = location === "/admin" && currentSearch ? `${location}${currentSearch}` : location;
  const legend = resolveAdminLegend(
    language,
    currentPathWithSearch,
  );
  const showLegend = !(location === "/admin" && (!currentSearch || currentSearch.startsWith("?view=")));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeContextType["theme"]>("light");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "GLX Admin");
  const [profileEmail, setProfileEmail] = useState(user?.email || "admin@glx.local");
  const [profileLogo, setProfileLogo] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [integrationsOpen, setIntegrationsOpen] = useState(true);

  const notifications: Array<{ id: number; type: "warning" | "info" | "error"; time: string; title: string }> = [];
  const changePasswordMutation = trpc.emailAuth.changePassword.useMutation();

  const adminHelpSuggestions = uiCopy.helpSuggestions;

  const filteredHelpSuggestions = adminHelpSuggestions
    .filter((item) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      return item.question.toLowerCase().includes(normalizedQuery) || item.hint.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 5);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  const handleLogout = async () => {
    await logout({ redirectTo: "/" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredHelpSuggestions.length > 0) {
      const [firstSuggestion] = filteredHelpSuggestions;
      setSearchMenuOpen(false);
      handleNavClick(firstSuggestion.href);
      return;
    }
    if (searchQuery.trim()) {
      handleNavClick(`/admin/usuarios?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleExportCsv = () => {
    window.dispatchEvent(new CustomEvent("glx-admin-export-csv"));
  };

  const handleExportPdf = () => {
    window.dispatchEvent(new CustomEvent("glx-admin-export-pdf"));
  };

  const handleNavClick = (href: string) => {
    if (typeof window !== "undefined" && href.includes("?")) {
      window.history.pushState({}, "", href);
      setCurrentSearch(window.location.search);
      window.dispatchEvent(new PopStateEvent("popstate"));
      setSidebarOpen(false);
      return;
    }
    setLocation(href);
    setCurrentSearch("");
    setSidebarOpen(false);
  };

  const handleSuggestionClick = (href: string, question: string) => {
    setSearchQuery(question);
    setSearchMenuOpen(false);
    handleNavClick(href);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("glx-admin-profile");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { name?: string; email?: string; logo?: string | null };
      if (parsed.name) setProfileName(parsed.name);
      if (parsed.email) setProfileEmail(parsed.email);
      if (parsed.logo) setProfileLogo(parsed.logo);
    } catch {
      window.localStorage.removeItem("glx-admin-profile");
    }
  }, []);

  const handleProfileLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = () => {
    const shouldChangePassword = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

    if (shouldChangePassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error(language === "en" ? "Fill in the current password, new password and confirmation." : language === "es" ? "Completa la contrasena actual, la nueva contrasena y la confirmacion." : "Preencha senha atual, nova senha e confirmacao.");
        return;
      }

      if (newPassword.length < 6) {
        toast.error(language === "en" ? "The new password must be at least 6 characters long." : language === "es" ? "La nueva contrasena debe tener al menos 6 caracteres." : "A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error(language === "en" ? "The new password confirmation does not match." : language === "es" ? "La confirmacion de la nueva contrasena no coincide." : "A confirmacao da nova senha nao confere.");
        return;
      }
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "glx-admin-profile",
        JSON.stringify({
          name: profileName.trim() || "GLX Admin",
          email: profileEmail.trim() || "admin@glx.local",
          logo: profileLogo,
        }),
      );
    }

    const finishSave = () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileDialogOpen(false);
      toast.success(language === "en" ? "Profile updated successfully." : language === "es" ? "Perfil actualizado con exito." : "Perfil atualizado com sucesso.");
    };

    if (shouldChangePassword) {
      changePasswordMutation.mutate(
        {
          currentPassword,
          newPassword,
        },
        {
          onSuccess: () => {
            finishSave();
          },
          onError: (error: { message?: string }) => {
            toast.error(error.message || (language === "en" ? "Could not change the password." : language === "es" ? "No fue posible cambiar la contrasena." : "Nao foi possivel alterar a senha."));
          },
        },
      );
      return;
    }

    finishSave();
  };

  const sidebarBg = theme === "dark" ? "bg-[#1a1410]" : "bg-[#fffdfa]";
  const sidebarText = theme === "dark" ? "text-gray-300" : "text-[#6b7280]";
  const sidebarHover = theme === "dark" ? "hover:bg-white/5" : "hover:bg-[#fff3eb]";
  const accentColor = "bg-[#ff7a1a]";

  const contentBg = theme === "dark"
    ? "bg-[#0f0d0a]"
    : "bg-[radial-gradient(circle_at_top_left,_rgba(255,201,153,0.2),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(191,235,255,0.22),_transparent_24%),linear-gradient(180deg,_#fcfdff_0%,_#f5f7fb_100%)]";
  const contentText = theme === "dark" ? "text-white" : "text-gray-900";
  const contentTextSecondary = theme === "dark" ? "text-gray-400" : "text-gray-600";
  const headerBg = theme === "dark" ? "bg-[#1a1410]/95" : "bg-white/88";
  const borderColor = theme === "dark" ? "border-white/10" : "border-[#e9edf5]";
  const inputBg = theme === "dark" ? "bg-white/5" : "bg-[#f4f7fb]";

  useEffect(() => {
    if (
      location.startsWith("/admin/kommo") ||
      location.startsWith("/admin/asaas") ||
      location.startsWith("/admin/google-calendar") ||
      location.startsWith("/admin/google-forms") ||
      location.startsWith("/admin/planilha-contratos") ||
      location.startsWith("/admin/planilha-dre")
    ) {
      setIntegrationsOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncSearch = () => setCurrentSearch(window.location.search);
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={cn("min-h-screen", contentBg, contentText)}>
        <AnimatePresence>
          {sidebarOpen ? (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <aside
          className={cn(
            "fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
            sidebarBg,
            theme === "dark" ? "border-r border-white/5" : "border-r border-[#edf1f7]",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex flex-col h-full">
            <div className={cn("flex items-center justify-between h-[76px] px-4", theme === "dark" ? "border-b border-white/5" : "border-b border-[#edf1f7]")}>
              <Link href="/admin" className="flex items-center gap-3">
                <GlxSealLogo darkMode={theme === "dark"} className="h-14 w-14 shrink-0 drop-shadow-[0_12px_20px_rgba(15,23,42,0.16)]" />
                <div className="flex flex-col">
                  <span className={cn("font-semibold text-sm", theme === "dark" ? "text-white" : "text-[#121826]")}>PERFORMANCE</span>
                  <span className={cn("text-[10px] uppercase tracking-wider", theme === "dark" ? "text-gray-500" : "text-[#94a3b8]")}>{copy.panelSubtitle}</span>
                </div>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className={cn("lg:hidden p-1 rounded", sidebarHover, sidebarText)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-3">
              <ul className="space-y-1">
                {PRIMARY_NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href.includes("?")
                      ? currentPathWithSearch === item.href
                      : location === item.href || location.startsWith(`${item.href}/`);
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => handleNavClick(item.href)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer text-left active:scale-[0.98]",
                          isActive
                            ? cn(accentColor, "text-white shadow-lg shadow-orange-500/20")
                            : cn(sidebarText, sidebarHover, theme === "dark" ? "hover:text-white" : "hover:text-[#121826]"),
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {copy.navigation[item.key]}
                      </button>
                    </li>
                  );
                })}

                <li className="pt-4">
                  <button
                    type="button"
                    onClick={() => setIntegrationsOpen((current) => !current)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all",
                      sidebarText,
                      sidebarHover,
                      theme === "dark" ? "hover:text-white" : "hover:text-[#121826]",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Circle className="h-2.5 w-2.5 fill-current" />
                      {copy.navigation.integrations}
                    </span>
                    <ChevronRight className={cn("h-4 w-4 transition-transform", integrationsOpen ? "rotate-90" : "")} />
                  </button>
                </li>

                {integrationsOpen
                  ? INTEGRATION_NAV_ITEMS.map((item) => {
                    const isActive = location === item.href || location.startsWith(`${item.href}/`);
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleNavClick(item.href)}
                          className={cn(
                            "ml-6 flex w-[calc(100%-1.5rem)] items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer text-left active:scale-[0.98]",
                            isActive
                              ? cn(accentColor, "text-white shadow-lg shadow-orange-500/20")
                              : cn(sidebarText, sidebarHover, theme === "dark" ? "hover:text-white" : "hover:text-[#121826]"),
                          )}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {copy.navigation[item.key]}
                        </button>
                      </li>
                    );
                  })
                  : null}
              </ul>
            </nav>

            <div className={cn("px-4 pb-5 pt-3", theme === "dark" ? "border-t border-white/5" : "border-t border-[#edf1f7]")}>
              <div className="rounded-[28px] bg-white/90 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.16)]">
                <div className="mb-4 flex items-start gap-3">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#e2e8f0] bg-white">
                    {profileLogo ? (
                      <img src={profileLogo} alt={uiCopy.profileLogoAlt} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-[#0f172a]">{profileName.slice(0, 1) || "G"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">{uiCopy.profile}</div>
                    <div className="mt-2 truncate text-base font-bold leading-none tracking-tight text-[#0f172a]">
                      {profileName}
                    </div>
                    <div className="mt-2 truncate text-sm text-[#94a3b8]">{profileEmail}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileDialogOpen(true)}
                  className="mb-5 w-full rounded-2xl border border-[#dde6f1] bg-[#fff7f0] px-4 py-3 text-left text-sm font-semibold text-[#0f172a] transition hover:border-[#ffb280] hover:bg-[#fff2e6]"
                >
                  {uiCopy.configureProfile}
                </button>

                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">{uiCopy.language}</div>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="mb-5 h-12 w-full rounded-2xl border border-[#dde6f1] bg-[#f3f7fb] px-4 text-[15px] font-medium text-[#0f172a] outline-none transition focus:border-[#ffb280]"
                >
                  <option value="pt">Portugues</option>
                  <option value="en">English</option>
                  <option value="es">Espanol</option>
                </select>

              </div>
            </div>
          </div>
        </aside>

        <div className="lg:pl-64">
          <header className={cn("sticky top-0 z-30 border-b backdrop-blur-xl", headerBg, borderColor)}>
            <div className="mx-auto flex min-h-[88px] w-full max-w-[1920px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <button onClick={() => setSidebarOpen(true)} className={cn("lg:hidden p-2 rounded-lg", theme === "dark" ? "hover:bg-white/5" : "hover:bg-gray-100")}>
                <Menu className="h-5 w-5" />
              </button>

              <form onSubmit={handleSearch} className="order-3 basis-full sm:order-2 sm:mx-0 sm:max-w-xl sm:flex-1">
                <div className="relative">
                  <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", contentTextSecondary)} />
                  <Input
                    type="search"
                    placeholder={copy.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchMenuOpen(true)}
                    onBlur={() => window.setTimeout(() => setSearchMenuOpen(false), 120)}
                    className={cn("h-12 rounded-full border", theme === "dark" ? "border-white/10" : "border-[#eef2f7]", inputBg, "pl-10 shadow-none focus:ring-2 focus:ring-[#e67e22]/30")}
                  />
                  {searchMenuOpen ? (
                    <div
                      className={cn(
                        "absolute left-0 right-0 top-[calc(100%+10px)] z-40 overflow-hidden rounded-[24px] border shadow-[0_24px_50px_rgba(15,23,42,0.12)]",
                        theme === "dark" ? "border-white/10 bg-[#171411]" : "border-[#e8edf5] bg-white",
                      )}
                    >
                      <div className={cn("px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]", theme === "dark" ? "text-white/50" : "text-[#94a3b8]")}>
                        {uiCopy.helpTitle}
                      </div>
                      <div className="px-2 pb-2">
                        {filteredHelpSuggestions.length > 0 ? filteredHelpSuggestions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSuggestionClick(item.href, item.question)}
                            className={cn(
                              "flex w-full flex-col rounded-[18px] px-3 py-3 text-left transition",
                              theme === "dark" ? "hover:bg-white/5" : "hover:bg-[#f8fbff]",
                            )}
                          >
                            <span className={cn("text-sm font-semibold", theme === "dark" ? "text-white" : "text-[#0f172a]")}>
                              {item.question}
                            </span>
                            <span className={cn("mt-1 text-xs", theme === "dark" ? "text-white/65" : "text-[#64748b]")}>
                              {item.hint}
                            </span>
                          </button>
                        )) : (
                          <div className={cn("px-3 py-4 text-sm", theme === "dark" ? "text-white/65" : "text-[#64748b]")}>
                            {uiCopy.helpEmpty}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="order-2 ml-auto flex flex-wrap items-center justify-end gap-2 sm:order-3 sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "hidden xl:flex h-12 items-center gap-2 rounded-full border px-4",
                    theme === "dark" ? "border-white/10 bg-white/5 text-white" : "border-[#ffd6bd] bg-[#fff8f3] text-[#0f172a]",
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#50d18d]" />
                  {uiCopy.liveData}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn("relative rounded-full", theme === "dark" ? "hover:bg-white/5" : "border border-[#e8edf5] bg-white shadow-sm hover:bg-gray-50")}>
                      <Bell className="h-5 w-5" />
                      {notifications.length > 0 ? <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#e67e22]" /> : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>{copy.notificationsTitle}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.map((notif) => (
                      <DropdownMenuItem key={notif.id} className="flex items-start gap-3 py-3">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full mt-1.5 flex-shrink-0",
                            notif.type === "error" ? "bg-red-500" : notif.type === "warning" ? "bg-[#e67e22]" : "bg-blue-500",
                          )}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {notif.time} {copy.agoSuffix}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    {notifications.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">{copy.noNotifications}</div>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>



                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleExportCsv}
                  className={cn("hidden xl:flex h-12 rounded-full px-5", theme === "dark" ? "hover:bg-white/5" : "border border-[#e8edf5] bg-white shadow-sm hover:bg-gray-50")}
                >
                  {uiCopy.exportCsv}
                </Button>

                <Button
                  type="button"
                  onClick={handleExportPdf}
                  className="hidden md:flex h-12 rounded-full bg-[#ff7a1a] px-5 lg:px-6 text-white shadow-[0_18px_34px_rgba(255,122,26,0.24)] hover:bg-[#f06a09]"
                >
                  {uiCopy.exportPdf}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleLogout}
                  className={cn("hidden xl:flex h-12 rounded-full px-5", theme === "dark" ? "hover:bg-white/5" : "border border-[#e8edf5] bg-white shadow-sm hover:bg-gray-50")}
                >
                  {uiCopy.closeSession}
                </Button>

              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1920px] p-4 sm:p-6 lg:p-7 xl:p-8">
            {showLegend ? (
              <div className={cn("mb-5 rounded-[28px] border p-5 shadow-sm", theme === "dark" ? "border-white/10 bg-[#1a1410]/50" : "border-[#e8edf5] bg-white")}>
                <h2 className={cn("text-base md:text-lg font-semibold", theme === "dark" ? "text-white" : "text-gray-900")}>{legend.title}</h2>
                <p className={cn("text-sm mt-1", theme === "dark" ? "text-gray-400" : "text-gray-600")}>{legend.description}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {legend.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className={cn(
                        "rounded-2xl border px-4 py-2.5 text-xs",
                        theme === "dark" ? "border-white/10 bg-white/5 text-gray-300" : "border-[#edf2f7] bg-[#fcfdff] text-gray-700",
                      )}
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {children}
          </main>
        </div>

        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogContent className="border-[#e8edf5] bg-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-[#0f172a]">{uiCopy.profileDialogTitle}</DialogTitle>
              <DialogDescription className="text-[#667085]">
                {uiCopy.profileDialogDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-2">
              <div className="flex items-center gap-4 rounded-[24px] border border-[#edf2f7] bg-[#fbfcfe] p-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-white">
                  {profileLogo ? (
                    <img src={profileLogo} alt={uiCopy.profileLogoPreviewAlt} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-[#0f172a]">{profileName.slice(0, 1) || "G"}</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-semibold text-[#0f172a]">{uiCopy.profileLogoLabel}</label>
                  <input
                    type="file"
                    accept="image/png"
                    onChange={handleProfileLogoChange}
                    className="block w-full rounded-2xl border border-[#ffd0b0] bg-white px-3 py-2 text-sm text-[#475467] file:mr-4 file:rounded-full file:border-0 file:bg-[#ff7a1a] file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-[#f06a09]"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label htmlFor="admin-profile-name" className="mb-2 block text-sm font-semibold text-[#0f172a]">
                    {uiCopy.name}
                  </label>
                  <Input
                    id="admin-profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    className="h-12 rounded-2xl border-[#d8e2ee] bg-white text-[#0f172a] placeholder:text-[#98a2b3]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-profile-email" className="mb-2 block text-sm font-semibold text-[#0f172a]">
                    {uiCopy.email}
                  </label>
                  <Input
                    id="admin-profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    className="h-12 rounded-2xl border-[#d8e2ee] bg-white text-[#0f172a] placeholder:text-[#98a2b3]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-profile-current-password" className="mb-2 block text-sm font-semibold text-[#0f172a]">
                    {uiCopy.currentPassword}
                  </label>
                  <Input
                    id="admin-profile-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder={uiCopy.currentPasswordPlaceholder}
                    className="h-12 rounded-2xl border-[#d8e2ee] bg-white text-[#0f172a] placeholder:text-[#98a2b3]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-profile-new-password" className="mb-2 block text-sm font-semibold text-[#0f172a]">
                    {uiCopy.newPassword}
                  </label>
                  <Input
                    id="admin-profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={uiCopy.newPasswordPlaceholder}
                    className="h-12 rounded-2xl border-[#d8e2ee] bg-white text-[#0f172a] placeholder:text-[#98a2b3]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-profile-confirm-password" className="mb-2 block text-sm font-semibold text-[#0f172a]">
                    {uiCopy.confirmPassword}
                  </label>
                  <Input
                    id="admin-profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={uiCopy.confirmPasswordPlaceholder}
                    className="h-12 rounded-2xl border-[#d8e2ee] bg-white text-[#0f172a] placeholder:text-[#98a2b3]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-3 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProfileDialogOpen(false)}
                className="rounded-full border border-[#d8e2ee] bg-white px-5 text-[#344054] hover:bg-[#f8fafc]"
              >
                {uiCopy.cancel}
              </Button>
              <Button
                type="button"
                onClick={handleProfileSave}
                disabled={changePasswordMutation.isPending}
                className="rounded-full bg-[#ff7a1a] px-6 text-white hover:bg-[#f06a09]"
              >
                {changePasswordMutation.isPending ? uiCopy.savingProfile : uiCopy.saveProfile}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ThemeContext.Provider>
  );
}

