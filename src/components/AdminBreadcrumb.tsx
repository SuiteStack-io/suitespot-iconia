import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePropertySafe } from "@/lib/propertyContext";

const NON_PROPERTY_SECTIONS = ["PMS", "System"];

interface AdminBreadcrumbProps {
  section: string;
  currentPage: string;
  sectionPath?: string;
}

export function AdminBreadcrumb({ section, currentPage, sectionPath }: AdminBreadcrumbProps) {
  const location = useLocation();
  const propertyCtx = usePropertySafe();
  
  // For property-specific sections, use the active property name
  const displaySection = NON_PROPERTY_SECTIONS.includes(section)
    ? section
    : propertyCtx?.activeProperty?.name || section;

  // Auto-determine section path based on section name if not provided
  const getSectionPath = () => {
    if (sectionPath) return sectionPath;
    
    if (NON_PROPERTY_SECTIONS.includes(section)) {
      switch (section) {
        case "PMS":
          return "/pms/availability";
        case "System":
          return "/users";
        default:
          return "/admin";
      }
    }
    // Property-specific sections default to /rooms
    return "/rooms";
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
              {displaySection}
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
