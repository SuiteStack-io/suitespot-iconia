import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface AdminBreadcrumbProps {
  section: string;
  currentPage: string;
  sectionPath?: string;
}

export function AdminBreadcrumb({ section, currentPage, sectionPath }: AdminBreadcrumbProps) {
  const location = useLocation();
  
  // Auto-determine section path based on section name if not provided
  const getSectionPath = () => {
    if (sectionPath) return sectionPath;
    
    switch (section) {
      case "ICONIA":
        return "/rooms";
      case "Almaza Bay":
        return "/almaza-bay";
      case "System":
        return "/users";
      default:
        return "/admin";
    }
  };

  const sectionPathValue = getSectionPath();
  const isOnAdminDashboard = location.pathname === "/admin";
  const isOnSectionPage = location.pathname === sectionPathValue;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link 
              to="/admin" 
              className={`transition-colors ${
                isOnAdminDashboard 
                  ? "text-primary font-semibold" 
                  : "hover:text-primary"
              }`}
            >
              Admin
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link 
              to={sectionPathValue} 
              className={`transition-colors ${
                isOnSectionPage 
                  ? "text-primary font-semibold" 
                  : "hover:text-primary"
              }`}
            >
              {section}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-primary font-semibold">
            {currentPage}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
