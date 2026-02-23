import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { GuestAuthProvider } from "@/lib/guestAuth";
import { SelectionAuthProvider } from "@/lib/selectionAuth";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestProtectedRoute } from "@/components/GuestProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Calendar from "./pages/Calendar";
import ReservationDetail from "./pages/ReservationDetail";
import NotFound from "./pages/NotFound";
import Users from "./pages/Users";
import GuestAccounts from "./pages/GuestAccounts";
import Analytics from "./pages/Analytics";
import Guests from "./pages/Guests";
import MyReservations from "./pages/MyReservations";
import Rooms from "./pages/Rooms";
import RoomRates from "./pages/RoomRates";
import PublicHome from "./pages/PublicHome";
import BookingFlow from "./pages/BookingFlow";
import BookingConfirmation from "./pages/BookingConfirmation";
import IconiaZamalek from "./pages/IconiaZamalek";
import About from "./pages/About";
import Locations from "./pages/Locations";
import Suites from "./pages/Suites";
import Wellness from "./pages/Wellness";
import Experiences from "./pages/Experiences";
import Nearby from "./pages/Nearby";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import FAQ from "./pages/FAQ";
import HomepageManagement from "./pages/HomepageManagement";
import Settings from "./pages/Settings";
import BookingComReservations from "./pages/BookingComReservations";
import GuestLogin from "./pages/guest/Login";
import GuestDashboard from "./pages/guest/Dashboard";
import Survey from "./pages/guest/Survey";
import StaySurvey from "./pages/guest/StaySurvey";
import GuestTickets from "./pages/GuestTickets";
import TicketAnalytics from "./pages/TicketAnalytics";
import LocationsManagement from "./pages/LocationsManagement";
import MediaLibrary from "./pages/MediaLibrary";
import PropertyMedia from "./pages/PropertyMedia";
import AlmazaBay from "./pages/AlmazaBay";
import KYCLanding from "./pages/KYCLanding";
import KYCManagement from "./pages/KYCManagement";
import SelectionLogin from "./pages/SelectionLogin";
import SelectionLanding from "./pages/SelectionLanding";
import SelectionSessions from "./pages/SelectionSessions";
import SessionAuditLog from "./pages/SessionAuditLog";
import CheckInOut from "./pages/CheckInOut";
import GuestCheckIn from "./pages/GuestCheckIn";
import Housekeeping from "./pages/Housekeeping";
import ReservationsListPage from "./pages/ReservationsListPage";
import CashSettlement from "./pages/CashSettlement";
import Commissions from "./pages/Commissions";
import GuestForms from "./pages/GuestForms";
import PMSAvailability from "./pages/pms/Availability";
import PMSPrices from "./pages/pms/Prices";
import PMSRestrictions from "./pages/pms/Restrictions";
import RoomTypes from "./pages/RoomTypes";
import ChannexIntegration from "./pages/ChannexIntegration";
import ChannexDebug from "./pages/ChannexDebug";
import ShuffleHistory from "./pages/ShuffleHistory";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <GuestAuthProvider>
          <SelectionAuthProvider>
            <RealtimeProvider>
              <Toaster />
              <Sonner />
            <BrowserRouter>
              <Routes>
              {/* Public Routes - For findyoursuitespot.com */}
              <Route path="/" element={<PublicHome />} />
              <Route path="/book" element={<BookingFlow />} />
              <Route path="/booking-confirmation" element={<BookingConfirmation />} />
              <Route path="/iconia-zamalek" element={<IconiaZamalek />} />
              <Route path="/about" element={<About />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/suites" element={<Suites />} />
              <Route path="/wellness" element={<Wellness />} />
              <Route path="/experiences" element={<Experiences />} />
              <Route path="/nearby" element={<Nearby />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/faq" element={<FAQ />} />
            <Route path="/kyc/:token" element={<KYCLanding />} />
            <Route path="/kyc-management" element={<ProtectedRoute><KYCManagement /></ProtectedRoute>} />
            <Route path="/selection-sessions" element={<ProtectedRoute><SelectionSessions /></ProtectedRoute>} />
            <Route path="/session-audit-log" element={<ProtectedRoute><SessionAuditLog /></ProtectedRoute>} />
              
            {/* Selection Routes - For private inventory selection */}
            <Route path="/selection-login/:token" element={<SelectionLogin />} />
            <Route path="/selection/:token" element={<SelectionLanding />} />
              
              {/* Guest Routes - For guest portal */}
            <Route path="/guest/login" element={<GuestLogin />} />
            <Route
              path="/guest/dashboard"
              element={
                <GuestProtectedRoute>
                  <GuestDashboard />
                </GuestProtectedRoute>
              }
            />
            <Route path="/guest/survey/:ticketId" element={<Survey />} />
            <Route path="/guest/stay-survey/:reservationId" element={<StaySurvey />} />
              
              {/* Admin Routes - For internal management */}
              <Route path="/admin" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/check-in-out" element={<ProtectedRoute><CheckInOut /></ProtectedRoute>} />
              <Route path="/guest-checkin/:reservationId" element={<GuestCheckIn />} />
              <Route path="/housekeeping" element={<ProtectedRoute><Housekeeping /></ProtectedRoute>} />
              <Route path="/reservations-list" element={<ProtectedRoute><ReservationsListPage /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/reservation/:id" element={<ProtectedRoute><ReservationDetail /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/guest-accounts" element={<ProtectedRoute><GuestAccounts /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/guests" element={<ProtectedRoute><Guests /></ProtectedRoute>} />
              <Route path="/guest-forms" element={<ProtectedRoute><GuestForms /></ProtectedRoute>} />
              <Route path="/my-commissions" element={<ProtectedRoute><MyReservations /></ProtectedRoute>} />
              <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/room-rates" element={<ProtectedRoute><RoomRates /></ProtectedRoute>} />
              <Route path="/room-types" element={<ProtectedRoute><RoomTypes /></ProtectedRoute>} />
              <Route path="/homepage-management" element={<ProtectedRoute><HomepageManagement /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/booking-com-reservations" element={<ProtectedRoute><BookingComReservations /></ProtectedRoute>} />
        <Route path="/locations-management" element={<ProtectedRoute><LocationsManagement /></ProtectedRoute>} />
        <Route path="/media-library" element={<ProtectedRoute><MediaLibrary /></ProtectedRoute>} />
        <Route path="/property-media/:unitId" element={<ProtectedRoute><PropertyMedia /></ProtectedRoute>} />
        <Route path="/almaza-bay" element={<ProtectedRoute><AlmazaBay /></ProtectedRoute>} />
        <Route path="/guest-tickets" element={
          <ProtectedRoute>
            <GuestTickets />
          </ProtectedRoute>
        } />
        <Route path="/ticket-analytics" element={
          <ProtectedRoute>
            <TicketAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/cash-settlement" element={<ProtectedRoute><CashSettlement /></ProtectedRoute>} />
        <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
        
        {/* PMS Routes */}
        <Route path="/pms/availability" element={<ProtectedRoute><PMSAvailability /></ProtectedRoute>} />
        <Route path="/pms/prices" element={<ProtectedRoute><PMSPrices /></ProtectedRoute>} />
        <Route path="/pms/restrictions" element={<ProtectedRoute><PMSRestrictions /></ProtectedRoute>} />
        <Route path="/channex" element={<ProtectedRoute><ChannexIntegration /></ProtectedRoute>} />
        <Route path="/channex-debug" element={<ProtectedRoute><ChannexDebug /></ProtectedRoute>} />
        <Route path="/shuffle-history" element={<ProtectedRoute><ShuffleHistory /></ProtectedRoute>} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </RealtimeProvider>
        </SelectionAuthProvider>
        </GuestAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
