import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TicketMetrics from "@/components/analytics/TicketMetrics";
import ResolutionTimeChart from "@/components/analytics/ResolutionTimeChart";
import TicketTypeChart from "@/components/analytics/TicketTypeChart";
import SurveyAnalytics from "@/components/analytics/SurveyAnalytics";
import StaySurveyAnalytics from "@/components/analytics/StaySurveyAnalytics";
import { BarChart3, ArrowLeft, Download, FileSpreadsheet, Calendar as CalendarIcon } from "lucide-react";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface TicketData {
  id: string;
  created_at: string;
  resolved_at: string | null;
  status: string;
  ticket_type: string;
  priority: string;
  assigned_to: string | null;
}

type TimePeriod = 'week' | 'month' | 'quarter' | 'ytd';

const TicketAnalytics = () => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  const getDateRange = () => {
    if (customDateRange?.from) {
      return {
        startDate: format(customDateRange.from, 'yyyy-MM-dd'),
        endDate: customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : format(customDateRange.from, 'yyyy-MM-dd'),
      };
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timePeriod) {
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'ytd':
        startDate = startOfYear(now);
        endDate = now;
        break;
      default:
        startDate = startOfMonth(now);
    }

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  };

  const getFormattedDateRange = () => {
    const { startDate, endDate } = getDateRange();
    return `${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`;
  };

  const handleTabChange = (value: string) => {
    setTimePeriod(value as TimePeriod);
    setCustomDateRange(undefined);
  };

  useEffect(() => {
    fetchTickets();
  }, [timePeriod, customDateRange]);

  const fetchTickets = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const { data, error } = await supabase
        .from("guest_tickets")
        .select("*")
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      // Fetch all data for export
      const { data: staySurveyData } = await supabase
        .from("stay_surveys")
        .select("*, reservations!inner(booking_reference, units!unit_id(name))")
        .gte('submitted_at', startDate)
        .lte('submitted_at', endDate + 'T23:59:59');
      
      const { data: ticketSurveyData } = await supabase
        .from("ticket_surveys")
        .select("*, guest_tickets(title, ticket_type)")
        .gte('submitted_at', startDate)
        .lte('submitted_at', endDate + 'T23:59:59');

      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Ticket Data
      const ticketSheet = XLSX.utils.json_to_sheet(tickets.map(t => ({
        'ID': t.id,
        'Type': t.ticket_type,
        'Status': t.status,
        'Priority': t.priority,
        'Created At': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
        'Resolved At': t.resolved_at ? format(new Date(t.resolved_at), 'yyyy-MM-dd HH:mm') : 'N/A',
        'Resolution Time (hrs)': t.resolved_at 
          ? Math.round((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60))
          : 'N/A'
      })));
      XLSX.utils.book_append_sheet(workbook, ticketSheet, 'Tickets');
      
      // Sheet 2: Stay Survey Data
      if (staySurveyData && staySurveyData.length > 0) {
        const staySurveySheet = XLSX.utils.json_to_sheet(staySurveyData.map((s: any) => ({
          'Unit': s.reservations?.units?.name || 'N/A',
          'Overall Rating': s.overall_rating,
          'Cleanliness': s.cleanliness_rating || 'N/A',
          'Amenities': s.amenities_rating || 'N/A',
          'Location': s.location_rating || 'N/A',
          'Value': s.value_rating || 'N/A',
          'Would Recommend': s.would_recommend ? 'Yes' : 'No',
          'Feedback': s.feedback || '',
          'Submitted': format(new Date(s.submitted_at), 'yyyy-MM-dd')
        })));
        XLSX.utils.book_append_sheet(workbook, staySurveySheet, 'Stay Surveys');
      }
      
      // Sheet 3: Ticket Survey Data
      if (ticketSurveyData && ticketSurveyData.length > 0) {
        const ticketSurveySheet = XLSX.utils.json_to_sheet(ticketSurveyData.map((s: any) => ({
          'Ticket Type': s.guest_tickets?.ticket_type || 'N/A',
          'Rating': s.rating,
          'Resolution Satisfaction': s.resolution_satisfaction || 'N/A',
          'Response Time Satisfaction': s.response_time_satisfaction || 'N/A',
          'Would Recommend': s.would_recommend ? 'Yes' : 'No',
          'Feedback': s.feedback || '',
          'Submitted': format(new Date(s.submitted_at), 'yyyy-MM-dd')
        })));
        XLSX.utils.book_append_sheet(workbook, ticketSurveySheet, 'Ticket Surveys');
      }
      
      XLSX.writeFile(workbook, `ticket_analytics_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Analytics exported to Excel');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export analytics');
    }
  };

  const handleExportCSV = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(tickets.map(t => ({
        'ID': t.id,
        'Type': t.ticket_type,
        'Status': t.status,
        'Priority': t.priority,
        'Created At': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
        'Resolved At': t.resolved_at ? format(new Date(t.resolved_at), 'yyyy-MM-dd HH:mm') : 'N/A',
      })));
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Tickets exported to CSV');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Failed to export tickets');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="border-b bg-card sticky top-0 z-10 -mx-6 px-6 -mt-6 pt-6 pb-4">
        <AdminBreadcrumb section="ICONIA" currentPage="Tickets Analytics" />
        <div className="flex items-center gap-3 mt-4 justify-between">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            
            {/* Mobile back button - icon only */}
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin')}
              className="md:hidden"
              size="icon"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {/* Desktop back button with text */}
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin')}
              className="hidden md:flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Tickets Analytics</h1>
          </div>
          
          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Export Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Date range filter */}
      <div className="space-y-2">
        <div className="flex justify-center">
          <Tabs value={customDateRange ? '' : timePeriod} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-4 max-w-md">
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="quarter">Quarter</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-sm text-muted-foreground">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getFormattedDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="range"
                selected={customDateRange}
                onSelect={setCustomDateRange}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <TicketMetrics tickets={tickets} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResolutionTimeChart tickets={tickets} />
        <TicketTypeChart tickets={tickets} />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Guest Feedback</h2>
        <StaySurveyAnalytics dateRange={getDateRange()} />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Ticket Resolution Feedback</h2>
        <SurveyAnalytics dateRange={getDateRange()} />
      </div>
    </div>
  );
};

export default TicketAnalytics;
