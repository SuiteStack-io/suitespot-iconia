import { useState, useEffect } from 'react';
import { usePropertySafe } from '@/lib/propertyContext';
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
  Wallet,
  Banknote,
  ChevronDown,
  FileSignature,
  Zap,
  Lock,
  Layers,
  Radio,
  ArrowLeftRight,
  Tag,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { PropertySwitcher } from '@/components/PropertySwitcher';

interface SlideMenuProps {
  userRole: string | null;
}

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  showFor?: ('admin' | 'manager' | 'front_desk' | 'housekeeping')[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
  showFor?: ('admin' | 'manager' | 'front_desk' | 'housekeeping')[];
  collapsible?: boolean;
}

export function SlideMenu({ userRole }: SlideMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [almazaBayOpen, setAlmazaBayOpen] = useState(false);
  const { hasPermission } = useAuth();
  const propertyCtx = usePropertySafe();
  const activePropertyName = propertyCtx?.activeProperty?.name;

  const menuSections: MenuSection[] = [
    {
      label: activePropertyName?.toUpperCase() || 'ALMAZA BAY',
      items: [
        { title: 'Properties', url: '/almaza-bay', icon: Mountain },
        { title: 'KYC Management', url: '/kyc-management', icon: ClipboardList },
        { title: 'KYC Results', url: '/selection-sessions', icon: FileText },
        { title: 'Session Audit Log', url: '/session-audit-log', icon: ScrollText },
        { title: 'Tickets Analytics', url: '/ticket-analytics', icon: BarChart3 },
      ],
      showFor: ['admin'],
      collapsible: true,
    },
    {
      label: 'OPERATIONS',
      items: [
        { title: 'Rooms', url: '/rooms', icon: DoorOpen, showFor: ['admin'] },
        { title: 'Room Types', url: '/room-types', icon: Layers, showFor: ['admin'] },
        { title: 'Room Rates', url: '/room-rates', icon: DollarSign, showFor: ['admin'] },
        { title: 'Reservations List', url: '/reservations-list', icon: ClipboardList },
        { title: 'Check-In/Out', url: '/check-in-out', icon: DoorClosed },
        { title: 'Housekeeping', url: '/housekeeping', icon: Sparkles },
        { title: 'Booking.com', url: '/booking-com-reservations', icon: Upload },
        { title: 'Tickets', url: '/guest-tickets', icon: Ticket },
        { title: 'App Accounts', url: '/guest-accounts', icon: Shield },
        { title: 'My Commissions', url: '/my-commissions', icon: Wallet, showFor: ['manager', 'admin'] },
        { title: 'My Notifications', url: '/my-notifications', icon: Settings },
      ],
    },
    {
      label: 'FRONT DESK',
      items: [
        { title: 'Room Rates', url: '/front-desk/room-rates', icon: Tag },
        { title: 'Guests', url: '/guests', icon: Users },
        { title: 'Guest Forms', url: '/guest-forms', icon: FileSignature },
        { title: 'Guest Inbox', url: '/admin/inbox', icon: MessageCircle },
      ],
      showFor: userRole === 'admin' || hasPermission('can_access_front_desk') ? undefined : [],
    },
    {
      label: 'PMS',
      items: [
        { title: 'Availability', url: '/pms/availability', icon: CalendarDays },
        { title: 'Prices', url: '/pms/prices', icon: DollarSign },
        { title: 'Restrictions', url: '/pms/restrictions', icon: Lock },
        { title: 'Channel Markup', url: '/pms/channel-markup', icon: Tag },
        { title: 'Channex Integration', url: '/channex', icon: Radio },
        { title: 'Channex Debug', url: '/channex-debug', icon: Zap },
        { title: 'Shuffle History', url: '/shuffle-history', icon: ArrowLeftRight },
      ],
      showFor: ['admin'],
    },
    {
      label: 'MANAGEMENT',
      items: [
        { title: 'Commissions', url: '/commissions', icon: Wallet },
        { title: 'Cash Settlement', url: '/cash-settlement', icon: Banknote },
        { title: 'Revenue Analytics', url: '/analytics', icon: DollarSign },
      ],
      showFor: ['admin'],
    },
    {
      label: 'WEBSITE',
      items: [
        { title: 'Content', url: '/homepage-management', icon: Home },
        { title: 'Media Library', url: '/media-library', icon: ImageIcon },
        { title: 'Locations', url: '/locations-management', icon: Map },
      ],
      showFor: ['admin'],
    },
    {
      label: 'SYSTEM',
      items: [
        { title: 'Settings', url: '/settings', icon: Settings },
        { title: 'Users', url: '/users', icon: Users },
        { title: 'Guest Login', url: '/guest/login', icon: UserCircle },
      ],
      showFor: ['admin'],
    },
  ];

  // Filter sections based on user role
  const filteredSections = menuSections
    .filter(section => {
      if (!section.showFor) return true; // Show to all if not specified
      return section.showFor.includes(userRole as any);
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (!item.showFor) return true; // Show to all if not specified
        return item.showFor.includes(userRole as any);
      }),
    }));

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
          <div className="px-6 mb-4">
            <SheetTrigger asChild>
              <button
                onClick={() => navigate('/admin')}
                className="text-lg font-semibold text-white hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Admin
              </button>
            </SheetTrigger>
          </div>

          {/* Property Switcher */}
          <div className="px-3 mb-4">
            <PropertySwitcher />
          </div>

          {/* Menu Sections */}
          <nav className="flex-1 overflow-y-auto px-3">
            {filteredSections.map((section, sectionIndex) => {
              const isCollapsible = section.collapsible;
              const isOpen = section.label === 'ALMAZA BAY' ? almazaBayOpen : true;
              const setOpen = section.label === 'ALMAZA BAY' ? setAlmazaBayOpen : undefined;

              const sectionContent = (
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
              );

              if (isCollapsible && setOpen) {
                return (
                  <Collapsible
                    key={section.label}
                    open={isOpen}
                    onOpenChange={setOpen}
                    className={sectionIndex > 0 ? 'mt-6' : ''}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-3 mb-2 group cursor-pointer">
                      <h3 className="text-xs font-semibold text-[hsl(30,12%,60%)] uppercase tracking-wider group-hover:text-[hsl(30,15%,70%)] transition-colors">
                        {section.label}
                      </h3>
                      <ChevronDown className={cn(
                        'h-4 w-4 text-[hsl(30,12%,60%)] transition-transform duration-200',
                        isOpen && 'rotate-180'
                      )} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {sectionContent}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              return (
                <div key={section.label} className={sectionIndex > 0 ? 'mt-6' : ''}>
                  <div className="px-3 mb-2">
                    <h3 className="text-xs font-semibold text-[hsl(30,12%,60%)] uppercase tracking-wider">
                      {section.label}
                    </h3>
                  </div>
                  {sectionContent}
                </div>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}