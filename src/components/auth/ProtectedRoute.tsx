import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, householdId } = useAuth();
  const location = useLocation();

  // Show nothing while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // OPTIMIZATION: Allow Dashboard to render even if householdId is temporarily null
  // The Dashboard will show loading states while data loads
  // Only redirect to onboarding for specific routes that require householdId
  // Exception: allow access to /join and /onboarding pages even without household
  const requiresHousehold = !['/join', '/onboarding', '/'].includes(location.pathname);
  
  if (householdId === null && requiresHousehold) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
