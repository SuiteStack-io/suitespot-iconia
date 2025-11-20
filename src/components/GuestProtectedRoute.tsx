import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGuestAuth } from "@/lib/guestAuth";

interface GuestProtectedRouteProps {
  children: React.ReactNode;
}

export const GuestProtectedRoute = ({ children }: GuestProtectedRouteProps) => {
  const { guestAccount, loading } = useGuestAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !guestAccount) {
      navigate(`/guest/login?redirect=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  }, [guestAccount, loading, navigate, location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!guestAccount) {
    return null;
  }

  return <>{children}</>;
};
