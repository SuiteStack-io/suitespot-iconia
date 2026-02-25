import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { PropertyList } from "@/components/settings/PropertyList";

export default function Settings() {
  const navigate = useNavigate();
  const { userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <SlideMenu userRole={userRole} />
          
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="md:hidden"
            size="icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="hidden md:flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your system configuration</p>
          </div>
        </div>

        <div className="space-y-6">
          <PropertyList />
        </div>
      </div>
    </div>
  );
}
