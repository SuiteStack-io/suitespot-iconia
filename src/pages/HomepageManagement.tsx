import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SlideshowManager } from '@/components/SlideshowManager';
import { BlogManagement } from '@/components/BlogManagement';

export default function HomepageManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('homepage');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Content Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="homepage">Homepage</TabsTrigger>
            <TabsTrigger value="our-story">Our Story</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
          </TabsList>

          <TabsContent value="homepage" className="space-y-6">
            <SlideshowManager
              tableName="slideshow_images"
              bucketName="slideshow"
              title="Homepage Slideshow Management"
            />
          </TabsContent>

          <TabsContent value="our-story" className="space-y-6">
            <SlideshowManager
              tableName="our_story_slideshow"
              bucketName="our-story-slideshow"
              title="Our Story Slideshow Management"
            />
          </TabsContent>

          <TabsContent value="blog" className="space-y-6">
            <BlogManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
