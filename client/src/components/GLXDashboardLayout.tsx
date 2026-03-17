import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  Calendar,
  UserX,
  TrendingUp,
  Target,
  FileText,
  Star,
  Users,
  Database,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Bell,
  ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Theme Context
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const DashboardThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
});

export const useDashboardTheme = () => useContext(DashboardThemeContext);

const navigation = [
  { name: "Home CEO", href: "/glx", icon: LayoutDashboard },
  { name: "Receita/Margem/Caixa", href: "/glx/financials", icon: DollarSign },
  { name: "Operação", href: "/glx/operations", icon: Calendar },
  { name: "No-show (Waste)", href: "/glx/no-show", icon: UserX },
  { name: "Funil Comercial", href: "/glx/funnel", icon: TrendingUp },
  { name: "Marketing ROI", href: "/glx/marketing", icon: Target },
  { name: "Protocolos/Forecast", href: "/glx/protocols", icon: FileText },
  { name: "Qualidade/NPS", href: "/glx/quality", icon: Star },
  { name: "Pessoas", href: "/glx/people", icon: Users },
  { name: "Data Governance", href: "/glx/data", icon: Database },
];

interface GLXDashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function GLXDashboardLayout({
  children,
  title,
  subtitle,
  actions,
}: GLXDashboardLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('glx-dashboard-theme') !== 'light';
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('glx-dashboard-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const themeClasses = isDark
    ? "bg-[#1a1a1a] text-white"
    : "bg-[#f5f5f5] text-gray-900";

  const sidebarClasses = isDark
    ? "bg-[#0f0f0f] border-[#2a2a2a]"
    : "bg-white border-gray-200";

  const cardClasses = isDark
    ? "bg-[#252525] border-[#333]"
    : "bg-white border-gray-200 shadow-sm";

  return (
    <DashboardThemeContext.Provider value={{ isDark, toggleTheme }}>
      <div className={cn("min-h-screen flex", themeClasses)}>
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col border-r transition-transform duration-300",
            sidebarClasses,
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-inherit">
            <Link href="/glx" className="flex items-center gap-2">
              <img
                src="/images/logo-badge.jpg"
                alt="GLX"
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="font-semibold text-orange-500">PERFORMANCE</span>
            </Link>
            <button
              className="lg:hidden p-1"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || 
                  (item.href !== "/glx" && location.startsWith(item.href));
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-orange-500 text-white"
                          : isDark
                          ? "text-gray-400 hover:text-white hover:bg-[#252525]"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom section */}
          <div className={cn("p-3 border-t", isDark ? "border-[#2a2a2a]" : "border-gray-200")}>
            <Link
              href="/glx/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isDark
                  ? "text-gray-400 hover:text-white hover:bg-[#252525]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <Settings className="w-5 h-5" />
              Configurações
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header
            className={cn(
              "h-16 flex items-center justify-between px-4 lg:px-6 border-b",
              isDark ? "border-[#2a2a2a] bg-[#1a1a1a]" : "border-gray-200 bg-white"
            )}
          >
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-800"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{title}</h1>
                {subtitle && (
                  <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {actions}
              
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className={cn(
                  "rounded-full",
                  isDark ? "hover:bg-[#252525]" : "hover:bg-gray-100"
                )}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </Button>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full relative",
                  isDark ? "hover:bg-[#252525]" : "hover:bg-gray-100"
                )}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
              </Button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-2 px-2",
                      isDark ? "hover:bg-[#252525]" : "hover:bg-gray-100"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user?.name?.charAt(0) || "U"}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">
                      {user?.name || "Usuário"}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/glx/settings" className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Configurações
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-red-500 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </DashboardThemeContext.Provider>
  );
}

// Reusable KPI Card component
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: string; isPositive: boolean };
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  highlight,
  className,
}: KPICardProps) {
  const { isDark } = useDashboardTheme();

  return (
    <div
      className={cn(
        "rounded-xl p-4 border transition-all",
        isDark
          ? highlight
            ? "bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30"
            : "bg-[#252525] border-[#333] hover:border-[#444]"
          : highlight
          ? "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200"
          : "bg-white border-gray-200 hover:border-gray-300 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn("text-xs font-medium uppercase tracking-wide", isDark ? "text-gray-400" : "text-gray-500")}>
            {title}
          </p>
          <p className={cn("text-2xl font-bold mt-1", highlight && "text-orange-500")}>
            {value}
          </p>
          {subtitle && (
            <p className={cn("text-xs mt-1", isDark ? "text-gray-500" : "text-gray-400")}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs mt-2 font-medium",
                trend.isPositive ? "text-green-500" : "text-red-500"
              )}
            >
              {trend.value} vs período anterior
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isDark ? "bg-[#333]" : "bg-gray-100"
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// Section Card component
interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  children,
  actions,
  className,
}: SectionCardProps) {
  const { isDark } = useDashboardTheme();

  return (
    <div
      className={cn(
        "rounded-xl border p-4 lg:p-6",
        isDark ? "bg-[#252525] border-[#333]" : "bg-white border-gray-200 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && (
            <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

// Alert Card component
interface AlertCardProps {
  type: "warning" | "danger" | "success" | "info";
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function AlertCard({ type, title, description, action }: AlertCardProps) {
  const { isDark } = useDashboardTheme();
  
  const colors = {
    warning: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-500" },
    danger: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-500" },
    success: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-500" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500" },
  };

  return (
    <div className={cn("rounded-lg p-3 border", colors[type].bg, colors[type].border)}>
      <p className={cn("font-medium text-sm", colors[type].text)}>{title}</p>
      <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-gray-500")}>
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className={cn("text-xs font-medium mt-2", colors[type].text, "hover:underline")}
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}

// Data Table component
interface DataTableProps {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  className?: string;
}

export function DataTable({ headers, rows, className }: DataTableProps) {
  const { isDark } = useDashboardTheme();

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr className={cn("border-b", isDark ? "border-[#333]" : "border-gray-200")}>
            {headers.map((header, i) => (
              <th
                key={i}
                className={cn(
                  "text-left text-xs font-medium uppercase tracking-wide py-3 px-4",
                  isDark ? "text-gray-400" : "text-gray-500"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                "border-b transition-colors",
                isDark
                  ? "border-[#333] hover:bg-[#2a2a2a]"
                  : "border-gray-100 hover:bg-gray-50"
              )}
            >
              {row.map((cell, j) => (
                <td key={j} className="py-3 px-4 text-sm">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
