import { Link } from "react-router-dom";
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

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={getSectionPath()} className="hover:text-primary transition-colors">
              {section}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentPage}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
