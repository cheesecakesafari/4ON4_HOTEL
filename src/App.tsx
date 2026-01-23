import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EmployeeProvider } from "./contexts/EmployeeContext";
import { HotelProvider } from "./contexts/HotelContext";
import { useHotel } from "./contexts/HotelContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RecoverCode from "./pages/RecoverCode";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import HotelLogin from "./pages/HotelLogin";
import HotelRegister from "./pages/HotelRegister";

const queryClient = new QueryClient();

function RootRedirect() {
  const { hotel, isHotelLoading } = useHotel();
  if (isHotelLoading) return null;

  const hostname = window.location.hostname.toLowerCase();
  const isGateway =
    hostname === '4on4.world' ||
    hostname === 'www.4on4.world' ||
    hostname === 'hotelsystem.services' ||
    hostname === 'www.hotelsystem.services' ||
    hostname.endsWith('.netlify.app');
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');

  if (isGateway || isLocal) return <Navigate to="/hotel-register" replace />;
  return <Navigate to="/login" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <HotelProvider>
        <EmployeeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/hotel-login" element={<HotelLogin />} />
              <Route path="/hotel-register" element={<HotelRegister />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/recover" element={<RecoverCode />} />
              <Route path="/dashboard" element={<Dashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </EmployeeProvider>
      </HotelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
