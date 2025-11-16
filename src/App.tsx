import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import Blog from "./pages/Blog";
import HomepageManagement from "./pages/HomepageManagement";
import Settings from "./pages/Settings";

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
            <Route path="/blog" element={<Blog />} />
            
            {/* Admin Routes - For internal management */}
            <Route path="/admin" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/reservation/:id" element={<ProtectedRoute><ReservationDetail /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/guests" element={<ProtectedRoute><Guests /></ProtectedRoute>} />
            <Route path="/my-reservations" element={<ProtectedRoute><MyReservations /></ProtectedRoute>} />
            <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
            <Route path="/homepage-management" element={<ProtectedRoute><HomepageManagement /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
