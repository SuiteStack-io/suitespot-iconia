import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "@/components/guest/PhotoUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

const ticketSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  ticket_type: z.enum(["not_working", "broken", "repair_needed", "housekeeping", "linen_change"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  photo_urls: z.array(z.string()).optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

interface TicketSubmissionProps {
  reservationId: string;
  guestAccountId: string;
  unitId: string;
}

export function TicketSubmission({ reservationId, guestAccountId, unitId }: TicketSubmissionProps) {
  const [loading, setLoading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      ticket_type: "not_working",
      priority: "medium",
      photo_urls: [],
    },
  });

  const onSubmit = async (data: TicketForm) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("guest_tickets").insert({
        reservation_id: reservationId,
        guest_account_id: guestAccountId,
        title: data.title,
        description: data.description,
        ticket_type: data.ticket_type,
        priority: data.priority,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        photo_url: photoUrls.length > 0 ? photoUrls[0] : null, // Keep for backward compatibility
        status: "open",
      });

      if (error) throw error;

      toast.success("Ticket submitted successfully! Our team will respond shortly.");
      form.reset();
      setPhotoUrls([]);
    } catch (error: any) {
      console.error("Error submitting ticket:", error);
      toast.error(error.message || "Failed to submit ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Report an Issue</CardTitle>
        <CardDescription>
          Let us know if something needs attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="ticket_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="not_working">Not Working</SelectItem>
                      <SelectItem value="broken">Broken</SelectItem>
                      <SelectItem value="repair_needed">Repair Needed</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping Request</SelectItem>
                      <SelectItem value="linen_change">Linen Change</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide more details about the issue"
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PhotoUpload onPhotosUploaded={setPhotoUrls} maxPhotos={5} />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
