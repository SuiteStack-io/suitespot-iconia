import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Calendar from "./pages/Calendar";
import ReservationDetail from "./pages/ReservationDetail";
import NotFound from "./pages/NotFound";
import Users from "./pages/Users";
import Analytics from "./pages/Analytics";
import Guests from "./pages/Guests";
import MyReservations from "./pages/MyReservations";
import Rooms from "./pages/Rooms";
import PublicHome from "./pages/PublicHome";
import BookingFlow from "./pages/BookingFlow";
import BookingConfirmation from "./pages/BookingConfirmation";
import OurStory from "./pages/OurStory";
import Locations from "./pages/Locations";
import Suites from "./pages/Suites";
import Wellness from "./pages/Wellness";
import Experiences from "./pages/Experiences";
import Nearby from "./pages/Nearby";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes - For findyoursuitespot.com */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/book" element={<BookingFlow />} />
            <Route path="/booking-confirmation" element={<BookingConfirmation />} />
            <Route path="/our-story" element={<OurStory />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/suites" element={<Suites />} />
            <Route path="/wellness" element={<Wellness />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/nearby" element={<Nearby />} />
            
            {/* Admin Routes - For internal management */}
            <Route path="/admin" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reservation/:id" element={<ReservationDetail />} />
            <Route path="/users" element={<Users />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/guests" element={<Guests />} />
            <Route path="/my-reservations" element={<MyReservations />} />
            <Route path="/rooms" element={<Rooms />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
