import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, MessageSquareText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { SlideMenu } from '@/components/SlideMenu';
import { useAuth } from '@/lib/auth';

interface Template {
  id: string;
  template_name: string;
  template_type: string;
  message_body: string;
  is_enabled: boolean;
  twilio_content_sid: string | null;
  created_at: string;
  updated_at: string;
}

const PLACEHOLDERS = [
  { tag: '{{guest_name}}', label: 'Guest Name', sample: 'John Smith' },
  { tag: '{{room_name}}', label: 'Room Name', sample: 'Deluxe Suite' },
  { tag: '{{checkin_date}}', label: 'Check-in Date', sample: '2025-03-15' },
  { tag: '{{checkout_date}}', label: 'Check-out Date', sample: '2025-03-20' },
  { tag: '{{property_name}}', label: 'Property Name', sample: 'ICONIA Zamalek' },
];

const TYPE_COLORS: Record<string, string> = {
  welcome: 'bg-green-100 text-green-800',
  midstay: 'bg-blue-100 text-blue-800',
  checkout: 'bg-amber-100 text-amber-800',
};

const MessageTemplates = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .order('template_type');

    if (error) {
      toast.error('Failed to load templates');
      console.error(error);
    } else {
      setTemplates(data || []);
      const bodies: Record<string, string> = {};
      (data || []).forEach(t => { bodies[t.id] = t.message_body; });
      setEditedBodies(bodies);
    }
    setLoading(false);
  };

  const handleSave = async (template: Template) => {
    setSaving(template.id);
    const { error } = await supabase
      .from('whatsapp_message_templates')
      .update({ message_body: editedBodies[template.id] })
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to save template');
    } else {
      toast.success('Template saved');
      fetchTemplates();
    }
    setSaving(null);
  };

  const handleToggle = async (template: Template) => {
    const { error } = await supabase
      .from('whatsapp_message_templates')
      .update({ is_enabled: !template.is_enabled })
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to toggle template');
    } else {
      fetchTemplates();
    }
  };

  const insertPlaceholder = (templateId: string, tag: string) => {
    const textarea = textareaRefs.current[templateId];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = editedBodies[templateId] || '';
    const newBody = current.substring(0, start) + tag + current.substring(end);
    setEditedBodies(prev => ({ ...prev, [templateId]: newBody }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const renderPreview = (body: string) => {
    let preview = body;
    PLACEHOLDERS.forEach(p => {
      preview = preview.replace(new RegExp(p.tag.replace(/[{}]/g, '\\$&'), 'g'), p.sample);
    });
    return preview;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            <Button variant="ghost" onClick={() => navigate('/admin')} size="icon" className="md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Message Templates</h1>
              <p className="text-muted-foreground">Manage WhatsApp message templates for guest communication</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {templates.map(template => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquareText className="h-5 w-5 text-primary" />
                    <span>{template.template_name}</span>
                    <Badge className={TYPE_COLORS[template.template_type] || ''}>
                      {template.template_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${template.id}`} className="text-sm text-muted-foreground">
                      {template.is_enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id={`toggle-${template.id}`}
                      checked={template.is_enabled}
                      onCheckedChange={() => handleToggle(template)}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Placeholders */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Click to insert placeholder:</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLACEHOLDERS.map(p => (
                      <Button
                        key={p.tag}
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholder(template.id, p.tag)}
                        className="text-xs"
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Message body */}
                <div>
                  <Label className="mb-1 block">Message Body</Label>
                  <Textarea
                    ref={(el) => { textareaRefs.current[template.id] = el; }}
                    value={editedBodies[template.id] || ''}
                    onChange={(e) => setEditedBodies(prev => ({ ...prev, [template.id]: e.target.value }))}
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Preview */}
                <div>
                  <Label className="flex items-center gap-1 mb-1">
                    <Eye className="h-3 w-3" /> Preview
                  </Label>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {renderPreview(editedBodies[template.id] || '')}
                  </div>
                </div>

                {/* Twilio SID */}
                {template.twilio_content_sid && (
                  <p className="text-xs text-muted-foreground">
                    Twilio Content SID: {template.twilio_content_sid}
                  </p>
                )}

                <Button
                  onClick={() => handleSave(template)}
                  disabled={saving === template.id || editedBodies[template.id] === template.message_body}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving === template.id ? 'Saving...' : 'Save Template'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessageTemplates;
