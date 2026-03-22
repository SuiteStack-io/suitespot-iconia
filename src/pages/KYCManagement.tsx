import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePropertyId, withPropertyFilter } from "@/hooks/usePropertyFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, Search, X, Send, Mail, MessageCircle, Plus, Check, XCircle, ArrowLeft } from "lucide-react";
import { InventorySelectionModal } from "@/components/InventorySelectionModal";
import { SelectionCredentialsModal } from "@/components/SelectionCredentialsModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";

interface KYCLink {
  id: string;
  guest_name: string;
  guest_contact: string | null;
  token: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  unit_id: string | null;
  outcome: string | null;
  outcome_at: string | null;
  units: {
    name: string;
  } | null;
}

interface Property {
  id: string;
  name: string;
}

export default function KYCManagement() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [kycLinks, setKycLinks] = useState<KYCLink[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<KYCLink[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  
  // KYC generation states
  const [showKYCInputModal, setShowKYCInputModal] = useState(false);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [kycLink, setKycLink] = useState("");
  const [kycGuestName, setKycGuestName] = useState("");
  const [kycGuestContact, setKycGuestContact] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Accept/Reject states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedKYCLink, setSelectedKYCLink] = useState<KYCLink | null>(null);
  const [selectionCredentials, setSelectionCredentials] = useState<{
    link: string;
    username: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    fetchKYCLinks();
    fetchProperties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [kycLinks, searchQuery, statusFilter, propertyFilter, dateFrom, dateTo]);

  const fetchKYCLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("kyc_links")
        .select(`
          *,
          units:unit_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setKycLinks(data || []);
    } catch (error) {
      console.error("Error fetching KYC links:", error);
      toast.error("Failed to load KYC links");
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name")
        .eq("location", "Almaza Bay")
        .order("name");

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...kycLinks];

    // Search by guest name or contact
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (link) =>
          link.guest_name.toLowerCase().includes(query) ||
          link.guest_contact?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((link) => link.status === statusFilter);
    }

    // Filter by property
    if (propertyFilter !== "all") {
      filtered = filtered.filter((link) => link.unit_id === propertyFilter);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (link) => new Date(link.created_at) >= dateFrom
      );
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (link) => new Date(link.created_at) <= endOfDay
      );
    }

    setFilteredLinks(filtered);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPropertyFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = 
    searchQuery || 
    statusFilter !== "all" || 
    propertyFilter !== "all" || 
    dateFrom || 
    dateTo;

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/kyc/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const copyWhatsAppMessage = (token: string, guestName: string) => {
    const link = `${window.location.origin}/kyc/${token}`;
    const message = `Welcome to SuiteSpot Almaza!
We're excited to guide you through the next step.
Please fill out the short form below so we can tailor the perfect home options for your stay:
${link}`;
    navigator.clipboard.writeText(message);
    toast.success("WhatsApp message copied");
  };

  const openLink = (token: string) => {
    window.open(`/kyc/${token}`, '_blank');
  };

  const sendReminderEmail = async (link: KYCLink) => {
    if (!link.guest_contact) {
      toast.error("No email address available for this guest");
      return;
    }

    try {
      const kycLink = `${window.location.origin}/kyc/${link.token}`;
      
      const { error } = await supabase.functions.invoke('send-kyc-reminder', {
        body: {
          guestName: link.guest_name,
          guestEmail: link.guest_contact,
          kycLink: kycLink,
          propertyName: link.units?.name,
        },
      });

      if (error) throw error;
      
      toast.success("Reminder email sent successfully");
    } catch (error) {
      console.error("Error sending reminder email:", error);
      toast.error("Failed to send reminder email");
    }
  };

  const sendReminderWhatsApp = (token: string, guestName: string) => {
    const link = `${window.location.origin}/kyc/${token}`;
    const message = `Hi ${guestName}!

Welcome to SuiteSpot Almaza! 🏖️

We're excited to help you find your perfect home at Almaza Bay.

Please complete our short questionnaire to help us tailor the best options for your stay:
${link}

We'll get back to you within 3 hours with personalized recommendations!`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success("WhatsApp opened with reminder message");
  };

  const handleGenerateKYC = async () => {
    if (!kycGuestName.trim()) {
      toast.error("Please enter guest name");
      return;
    }

    if (!kycGuestContact.trim()) {
      toast.error("Please enter phone number");
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const uniqueToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const { error } = await supabase
        .from('kyc_links')
        .insert({
          unit_id: selectedPropertyId,
          guest_name: kycGuestName,
          guest_contact: kycGuestContact,
          token: uniqueToken,
          status: 'pending',
          created_by: authUser?.id
        });

      if (error) throw error;

      const link = `${window.location.origin}/kyc/${uniqueToken}`;
      setKycLink(link);
      setShowKYCInputModal(false);
      setShowKYCModal(true);
      
      // Refresh the list
      fetchKYCLinks();
      
      toast.success("KYC link generated successfully");
    } catch (error: any) {
      console.error("Error generating KYC link:", error);
      toast.error(error.message || "Failed to generate KYC link");
    }
  };

  const openGenerateDialog = () => {
    setKycGuestName("");
    setKycGuestContact("");
    setSelectedPropertyId(null);
    setShowKYCInputModal(true);
  };

  const handleAccept = async (link: KYCLink) => {
    setSelectedKYCLink(link);
    setShowInventoryModal(true);
  };

  const handleReject = async (link: KYCLink) => {
    setSelectedKYCLink(link);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedKYCLink) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("kyc_links")
        .update({
          outcome: "rejected",
          outcome_at: new Date().toISOString(),
          outcome_by: user?.id
        })
        .eq("id", selectedKYCLink.id);

      if (error) throw error;

      // Copy rejection message
      const message = "Thank you for your interest. Unfortunately, we do not have any availability that suits your needs at the moment.";
      navigator.clipboard.writeText(message);
      toast.success("Rejected. Message copied to clipboard for WhatsApp");

      setShowRejectModal(false);
      setSelectedKYCLink(null);
      fetchKYCLinks();
    } catch (error) {
      console.error("Error rejecting KYC:", error);
      toast.error("Failed to reject application");
    }
  };

  const handleCredentialsGenerated = (credentials: {
    link: string;
    username: string;
    password: string;
  }) => {
    setSelectionCredentials(credentials);
    setShowCredentialsModal(true);
    fetchKYCLinks();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
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
            
            <div>
              <h1 className="text-3xl font-bold">KYC Link Management</h1>
              <p className="text-muted-foreground">Track and manage all generated KYC links</p>
            </div>
          </div>
          <Button onClick={openGenerateDialog} className="font-medium">
            <Plus className="h-4 w-4 mr-2" />
            Generate KYC
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              All KYC Links ({filteredLinks.length}
              {hasActiveFilters && ` of ${kycLinks.length}`})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters Section */}
            <div className="space-y-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search Guest</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Name or contact..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                     <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Property Filter */}
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                <div className="space-y-2">
                  <Label className="invisible">Clear</Label>
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {hasActiveFilters
                          ? "No KYC links match the selected filters"
                          : "No KYC links generated yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">{link.guest_name}</TableCell>
                        <TableCell>{link.guest_contact || "-"}</TableCell>
                        <TableCell>{link.units?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={link.status === "completed" ? "default" : "secondary"}
                          >
                            {link.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {link.outcome ? (
                            <Badge
                              variant={link.outcome === "accepted" ? "default" : "destructive"}
                            >
                              {link.outcome}
                            </Badge>
                          ) : link.status === "completed" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAccept(link)}
                                title="Accept application"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(link)}
                                title="Reject application"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(link.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {link.completed_at
                            ? format(new Date(link.completed_at), "MMM d, yyyy HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(link.token)}
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyWhatsAppMessage(link.token, link.guest_name)}
                              title="Copy WhatsApp message"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openLink(link.token)}
                              title="Open link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {link.status === "pending" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="icon"
                                    title="Resend reminder"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => sendReminderEmail(link)}
                                    disabled={!link.guest_contact}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send via Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => sendReminderWhatsApp(link.token, link.guest_name)}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Send via WhatsApp
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Input Modal */}
      <Dialog open={showKYCInputModal} onOpenChange={setShowKYCInputModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">Generate KYC Link</DialogTitle>
            <DialogDescription>
              Enter guest details to generate a personalized KYC link
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Guest Name *</Label>
              <Input
                placeholder="Enter guest name"
                value={kycGuestName}
                onChange={(e) => setKycGuestName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                placeholder="Enter phone number"
                value={kycGuestContact}
                onChange={(e) => setKycGuestContact(e.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label>Property (Optional)</Label>
              <Select value={selectedPropertyId || "none"} onValueChange={(value) => setSelectedPropertyId(value === "none" ? null : value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - General Inquiry</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleGenerateKYC}
            >
              Generate Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KYC Success Modal */}
      <Dialog open={showKYCModal} onOpenChange={setShowKYCModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">KYC Link Generated</DialogTitle>
            <DialogDescription>
              Share this unique link with your guest to collect their information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input 
                value={kycLink} 
                readOnly 
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(kycLink);
                  toast.success("Link copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const message = `Welcome to SuiteSpot Almaza!
We're excited to guide you through the next step.
Please fill out the short form below so we can tailor the perfect home options for your stay:
${kycLink}`;
                navigator.clipboard.writeText(message);
                toast.success("WhatsApp message copied to clipboard");
              }}
            >
              Copy to WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">Reject Application</DialogTitle>
            <DialogDescription>
              This will mark the application as rejected and copy the rejection message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm italic">
                "Thank you for your interest. Unfortunately, we do not have any availability that suits your needs at the moment."
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmReject}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inventory Selection Modal */}
      {selectedKYCLink && (
        <InventorySelectionModal
          open={showInventoryModal}
          onClose={() => {
            setShowInventoryModal(false);
            setSelectedKYCLink(null);
          }}
          kycLinkId={selectedKYCLink.id}
          guestName={selectedKYCLink.guest_name}
          onCredentialsGenerated={handleCredentialsGenerated}
        />
      )}

      {/* Selection Credentials Modal */}
      <SelectionCredentialsModal
        open={showCredentialsModal}
        onClose={() => {
          setShowCredentialsModal(false);
          setSelectionCredentials(null);
        }}
        credentials={selectionCredentials}
      />
    </div>
  );
}
