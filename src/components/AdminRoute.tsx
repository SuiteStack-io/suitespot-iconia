import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { userRole, loading } = useAuth();
  const navigate = useNavigate();

  const allowed = userRole === 'admin';

  useEffect(() => {
    if (!loading && !allowed) {
      navigate('/admin', { replace: true });
    }
  }, [allowed, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
};
