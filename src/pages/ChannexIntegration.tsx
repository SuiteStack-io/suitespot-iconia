import { useState } from 'react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionStatus } from '@/components/channex/ConnectionStatus';
import { PropertySync } from '@/components/channex/PropertySync';
import { PropertySettings } from '@/components/channex/PropertySettings';
import { SyncLogs } from '@/components/channex/SyncLogs';
import { RecentBookings } from '@/components/channex/RecentBookings';
import { AlertsPanel } from '@/components/channex/AlertsPanel';

const ChannexIntegration = () => {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('connection');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Channex Integration</h1>
          </div>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="PMS" currentPage="Channex Integration" />
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <AlertsPanel />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="logs">Sync Logs</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="alerts">Alert History</TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <ConnectionStatus />
          </TabsContent>

          <TabsContent value="properties">
            <PropertySync onSwitchToSettings={() => setActiveTab('settings')} />
          </TabsContent>

          <TabsContent value="settings">
            <PropertySettings />
          </TabsContent>

          <TabsContent value="logs">
            <SyncLogs />
          </TabsContent>

          <TabsContent value="bookings">
            <RecentBookings />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsPanel showResolved />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChannexIntegration;
