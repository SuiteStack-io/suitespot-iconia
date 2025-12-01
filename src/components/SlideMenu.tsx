import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  PanelLeft,
  Home,
  FileText,
  Users,
  Settings,
  UserCircle,
  CalendarDays,
  DoorOpen,
  DoorClosed,
  Sparkles,
  Upload,
  Ticket,
  Mountain,
  ClipboardList,
  ScrollText,
  Shield,
  Image as ImageIcon,
  Map,
  BarChart3,
  DollarSign,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideMenuProps {
  isAdmin: boolean;
}

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

export function SlideMenu({ isAdmin }: SlideMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuSections: MenuSection[] = [
    {
      label: 'ALMAZA BAY',
      items: [
        { title: 'Properties', url: '/almaza-bay', icon: Mountain },
        { title: 'KYC Management', url: '/kyc-management', icon: ClipboardList },
        { title: 'KYC Results', url: '/selection-sessions', icon: FileText },
        { title: 'Session Audit Log', url: '/session-audit-log', icon: ScrollText },
        { title: 'Tickets Analytics', url: '/ticket-analytics', icon: BarChart3 },
      ],
    },
    {
      label: 'ICONIA',
      items: [
        { title: 'Rooms', url: '/rooms', icon: DoorOpen },
        { title: 'Calendar', url: '/calendar', icon: CalendarDays },
        { title: 'Check-In/Out', url: '/check-in-out', icon: DoorClosed },
        { title: 'Housekeeping', url: '/housekeeping', icon: Sparkles },
        { title: 'Booking.com', url: '/booking-com-reservations', icon: Upload },
        { title: 'Tickets', url: '/guest-tickets', icon: Ticket },
        { title: 'App Accounts', url: '/guest-accounts', icon: Shield },
        { title: 'Guests', url: '/guests', icon: Users },
        { title: 'Revenue Analytics', url: '/analytics', icon: DollarSign },
      ],
    },
    {
      label: 'WEBSITE',
      items: [
        { title: 'Content', url: '/homepage-management', icon: Home },
        { title: 'Our Story', url: '/our-story', icon: BookOpen },
        { title: 'Media Library', url: '/media-library', icon: ImageIcon },
        { title: 'Locations', url: '/locations-management', icon: Map },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { title: 'Settings', url: '/settings', icon: Settings },
        { title: 'Users', url: '/users', icon: Users },
        { title: 'Guest Login', url: '/guest/login', icon: UserCircle },
      ],
    },
  ];

  // Filter sections based on admin status
  const filteredSections = isAdmin
    ? menuSections
    : menuSections.filter(section => section.label === 'ICONIA');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <PanelLeft className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-[hsl(30,5%,20%)] border-[hsl(30,8%,30%)] p-0">
        <div className="flex flex-col h-full py-6">
          {/* Header */}
          <div className="px-6 mb-6">
            <h2 className="text-lg font-semibold text-white">Navigation</h2>
          </div>

          {/* Menu Sections */}
          <nav className="flex-1 overflow-y-auto px-3">
            {filteredSections.map((section, sectionIndex) => (
              <div key={section.label} className={sectionIndex > 0 ? 'mt-6' : ''}>
                {/* Section Label */}
                <div className="px-3 mb-2">
                  <h3 className="text-xs font-semibold text-[hsl(30,12%,60%)] uppercase tracking-wider">
                    {section.label}
                  </h3>
                </div>

                {/* Menu Items */}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.url;

                    return (
                      <SheetTrigger key={item.url} asChild>
                        <Button
                          variant="ghost"
                          onClick={() => navigate(item.url)}
                          className={cn(
                            'w-full justify-start gap-3 h-10 px-3 rounded-md',
                            'text-[hsl(30,15%,70%)] hover:text-white hover:bg-[hsl(30,8%,25%)]',
                            isActive && 'bg-cyan-500/10 text-cyan-400 hover:text-cyan-400 hover:bg-cyan-500/20'
                          )}
                        >
                          <Icon className={cn('h-4 w-4', isActive && 'text-cyan-400')} />
                          <span className="text-sm">{item.title}</span>
                        </Button>
                      </SheetTrigger>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
