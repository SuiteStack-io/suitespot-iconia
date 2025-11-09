import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export function BlogManagement() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Blog Management</h2>
      
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold">Blog Management Coming Soon</h3>
          <p className="text-muted-foreground max-w-md">
            This section will allow you to create and manage blog posts for your website.
          </p>
        </div>
      </Card>
    </div>
  );
}
