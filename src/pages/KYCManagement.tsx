import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface KYCLink {
  id: string;
  guest_name: string;
  guest_contact: string | null;
  token: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  unit_id: string | null;
  units: {
    name: string;
  } | null;
}

export default function KYCManagement() {
  const navigate = useNavigate();
  const [kycLinks, setKycLinks] = useState<KYCLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKYCLinks();
  }, []);

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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/almaza-bay")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">KYC Link Management</h1>
            <p className="text-muted-foreground">Track and manage all generated KYC links</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All KYC Links ({kycLinks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kycLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No KYC links generated yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    kycLinks.map((link) => (
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
    </div>
  );
}
