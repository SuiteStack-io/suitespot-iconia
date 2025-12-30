import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SlideshowManager } from '@/components/SlideshowManager';
import { BlogManagement } from '@/components/BlogManagement';
import { FAQManagement } from '@/components/FAQManagement';
import { SlideMenu } from '@/components/SlideMenu';
import { useAuth } from '@/lib/auth';
import { ArrowLeft } from 'lucide-react';

export default function HomepageManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('homepage');
  const { userRole } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
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
          
          <h1 className="text-3xl font-bold">Content Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4 mb-6">
            <TabsTrigger value="homepage">Homepage</TabsTrigger>
            <TabsTrigger value="our-story">Our Story</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
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

          <TabsContent value="faq" className="space-y-6">
            <FAQManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
