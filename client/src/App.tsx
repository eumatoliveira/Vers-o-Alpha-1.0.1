import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { MotionRouteTransition } from "@/animation/components/MotionRouteTransition";
import { normalizeMojibakeTree } from "@/utils/mojibake";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import AdminRoute from "./components/AdminRoute";
import ClientRoute from "./components/ClientRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";

const ThankYou = lazy(() => import("./pages/ThankYou"));
const Plans = lazy(() => import("./pages/Plans"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const InternalPdfRender = lazy(() => import("./pages/InternalPdfRender"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminFinanceiro = lazy(() => import("./pages/admin/AdminFinanceiro"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminSistema = lazy(() => import("./pages/admin/AdminSistema"));
const AdminKommo = lazy(() => import("./pages/admin/AdminKommo"));
const AdminAsaas = lazy(() => import("./pages/admin/AdminAsaas"));
const AdminGoogleCalendar = lazy(() => import("./pages/admin/AdminGoogleCalendar"));
const AdminGoogleForms = lazy(() => import("./pages/admin/AdminGoogleForms"));
const AdminContratosSheets = lazy(() => import("./pages/admin/AdminContratosSheets"));
const AdminDreSheets = lazy(() => import("./pages/admin/AdminDreSheets"));
const AdminErros = lazy(() => import("./pages/admin/AdminErros"));
const AdminFeatureFlags = lazy(() => import("./pages/admin/AdminFeatureFlags"));
const AdminClientConfig = lazy(() => import("./pages/admin/AdminClientConfig"));
const AdminAiAssistant = lazy(() => import("./pages/admin/AdminAiAssistant"));

const CEOScorecard = lazy(() => import("./pages/client/CEOScorecard"));
const OperationalWaste = lazy(() => import("./pages/client/OperationalWaste"));
const GrowthEngine = lazy(() => import("./pages/client/GrowthEngine"));
const Financials = lazy(() => import("./pages/client/Financials"));
const Operations = lazy(() => import("./pages/client/Operations"));
const Quality = lazy(() => import("./pages/client/Quality"));
const People = lazy(() => import("./pages/client/People"));
const DataGovernance = lazy(() => import("./pages/client/DataGovernance"));
const Ingestao = lazy(() => import("./pages/client/Ingestao"));
const WarRoomPage = lazy(() => import("./pages/client/WarRoomPage"));
const CeoDashboardPage = lazy(() => import("./pages/client/RoleDashboardPage").then(m => ({ default: m.CeoDashboardPage })));
const GestorDashboardPage = lazy(() => import("./pages/client/RoleDashboardPage").then(m => ({ default: m.GestorDashboardPage })));
const OperacionalDashboardPage = lazy(() => import("./pages/client/RoleDashboardPage").then(m => ({ default: m.OperacionalDashboardPage })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -m-8 rounded-full bg-primary/5 blur-2xl animate-pulse-glow"
        />
      </div>
      <p className="text-xs text-muted-foreground tracking-widest uppercase animate-pulse">
        Carregando...
      </p>
    </div>
  );
}

function AdminRouteFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,201,153,0.2),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(191,235,255,0.22),_transparent_24%),linear-gradient(180deg,_#fcfdff_0%,_#f5f7fb_100%)]" />
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  // Admin routes share the same layout shell — use a stable key so MotionRouteTransition
  // never triggers a full page fade between sub-routes (that caused the white-flash + 700ms delay).
  const transitionKey = isAdmin ? "admin" : location;
  const suspenseFallback = isAdmin ? <AdminRouteFallback /> : <RouteFallback />;

  return (
    <MotionRouteTransition routeKey={transitionKey}>
      <Suspense fallback={suspenseFallback}>
        <Switch location={location}>
          <Route path="/"><Home /></Route>
          <Route path="/obrigado"><ThankYou /></Route>
          <Route path="/login"><Login /></Route>
          <Route path="/esqueceu-a-senha"><ForgotPassword /></Route>
          <Route path="/internal/pdf-render"><InternalPdfRender /></Route>
          <Route path="/dashboard"><ClientRoute><Dashboard /></ClientRoute></Route>
          <Route path="/ceo"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/gestor"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/operacional"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/warroom"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/financeiro"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/operacoes"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/growth"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/qualidade"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/equipe"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/ingestao"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/integracoes"><ClientRoute><Redirect to="/dashboard" /></ClientRoute></Route>
          <Route path="/planos"><Plans /></Route>
          <Route path="/privacy"><Privacy /></Route>
          <Route path="/terms"><Terms /></Route>
          <Route path="/privacidade"><Privacy /></Route>
          <Route path="/termos"><Terms /></Route>

          <Route path="/admin"><AdminRoute><AdminDashboard /></AdminRoute></Route>
          <Route path="/admin/financeiro"><AdminRoute><AdminFinanceiro /></AdminRoute></Route>
          <Route path="/admin/usuarios"><AdminRoute><AdminUsuarios /></AdminRoute></Route>
          <Route path="/admin/sistema"><AdminRoute><AdminSistema /></AdminRoute></Route>
          <Route path="/admin/kommo"><AdminRoute><AdminKommo /></AdminRoute></Route>
          <Route path="/admin/asaas"><AdminRoute><AdminAsaas /></AdminRoute></Route>
          <Route path="/admin/google-calendar"><AdminRoute><AdminGoogleCalendar /></AdminRoute></Route>
          <Route path="/admin/google-forms"><AdminRoute><AdminGoogleForms /></AdminRoute></Route>
          <Route path="/admin/planilha-contratos"><AdminRoute><AdminContratosSheets /></AdminRoute></Route>
          <Route path="/admin/planilha-dre"><AdminRoute><AdminDreSheets /></AdminRoute></Route>
          <Route path="/admin/erros"><AdminRoute><AdminErros /></AdminRoute></Route>
          <Route path="/admin/flags"><AdminRoute><AdminFeatureFlags /></AdminRoute></Route>
          <Route path="/admin/client-config"><AdminRoute><AdminClientConfig /></AdminRoute></Route>
          <Route path="/admin/assistente-ia"><AdminRoute><AdminAiAssistant /></AdminRoute></Route>

          <Route path="/performance"><Redirect to="/ceo" /></Route>
          <Route path="/performance/financials"><Redirect to="/financeiro" /></Route>
          <Route path="/performance/operations"><Redirect to="/operacoes" /></Route>
          <Route path="/performance/waste"><Redirect to="/warroom" /></Route>
          <Route path="/performance/growth"><Redirect to="/growth" /></Route>
          <Route path="/performance/quality"><Redirect to="/qualidade" /></Route>
          <Route path="/performance/people"><Redirect to="/equipe" /></Route>
          <Route path="/performance/data"><Redirect to="/ingestao" /></Route>

          <Route path="/404"><NotFound /></Route>
          <Route><NotFound /></Route>
        </Switch>
      </Suspense>
    </MotionRouteTransition>
  );
}

function GlobalMojibakeFix() {
  useEffect(() => {
    normalizeMojibakeTree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentNode) {
          normalizeMojibakeTree(mutation.target.parentNode as ParentNode);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            normalizeMojibakeTree(node);
          } else if (node.parentNode) {
            normalizeMojibakeTree(node.parentNode as ParentNode);
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <LanguageProvider>
          <TooltipProvider>
            <GlobalMojibakeFix />
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
