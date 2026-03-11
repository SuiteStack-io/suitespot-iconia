import { useAuth } from '@/lib/auth';
import { NotificationSettingsSection } from '@/components/NotificationSettingsSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MyNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              My Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              Control which email notifications you receive
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Preferences</CardTitle>
            <CardDescription>
              Toggle notifications on or off. Changes are saved when you click Save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettingsSection userId={user.id} standalone />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
