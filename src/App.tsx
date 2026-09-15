import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CommerceProvider } from "@/contexts/CommerceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Payments from "./pages/Payments";
import Profile from "./pages/Profile";
import AdminPayments from "./pages/AdminPayments";
import AdminOrders from "./pages/AdminOrders";
import AdminNews from "./pages/AdminNews";
import AdminTickets from "./pages/AdminTickets";
import AdminProducts from "./pages/AdminProducts";
import AdminHub from "./pages/AdminHub";
import ResetPassword from "./pages/ResetPassword";
import { Sales, Cards, Proxy, RDP } from "./pages/Sections";
import Tools from "./pages/Tools";
import MyOrders from "./pages/MyOrders";
import Tickets from "./pages/Tickets";
import NotFound from "./pages/NotFound.tsx";
import AdminVisitors from "./pages/AdminVisitors";
import { useVisitorTracking } from "./hooks/use-visitor-tracking";

const VisitorTracker = () => {
  useVisitorTracking();
  return null;
};

const queryClient = new QueryClient();
const productionUrl = "https://nexuscc.vercel.app";

const hasPasswordRecoveryParams = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);

  return Boolean(
    hashParams.get("type") === "recovery" ||
      hashParams.get("access_token") ||
      hashParams.get("refresh_token") ||
      searchParams.get("type") === "recovery" ||
      searchParams.get("code")
  );
};

const PasswordRecoveryRedirect = ({ children }: { children: JSX.Element }) => {
  if (hasPasswordRecoveryParams()) {
    const target = new URL("/reset-password", productionUrl);
    target.search = window.location.search;
    target.hash = window.location.hash;

    if (window.location.href !== target.href) {
      window.location.replace(target.href);
      return null;
    }
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="top-right" />
      <BrowserRouter>
        <PasswordRecoveryRedirect>
          <AuthProvider>
            <CommerceProvider>
              <VisitorTracker />
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
                <Route path="/cards" element={<ProtectedRoute><Cards /></ProtectedRoute>} />
                <Route path="/proxy" element={<ProtectedRoute><Proxy /></ProtectedRoute>} />
                <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
                <Route path="/rdp" element={<ProtectedRoute><RDP /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
                <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminHub /></ProtectedRoute>} />
                <Route path="/admin/news" element={<ProtectedRoute><AdminNews /></ProtectedRoute>} />
                <Route path="/admin/tickets" element={<ProtectedRoute><AdminTickets /></ProtectedRoute>} />
                <Route path="/admin/products" element={<ProtectedRoute><AdminProducts /></ProtectedRoute>} />
                <Route path="/admin/payments" element={<ProtectedRoute><AdminPayments /></ProtectedRoute>} />
                <Route path="/admin/visitors" element={<ProtectedRoute><AdminVisitors /></ProtectedRoute>} />
                <Route path="/admin/orders" element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CommerceProvider>
          </AuthProvider>
        </PasswordRecoveryRedirect>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
