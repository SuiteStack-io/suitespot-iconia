import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Zap, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface UnoptimizedImage {
  id: string;
  image_url: string;
  table_name: 'slideshow_images' | 'our_story_slideshow';
  bucket_name: string;
  status: 'pending' | 'optimizing' | 'success' | 'error';
  error_message?: string;
  progress: number;
}

export function BulkImageOptimizer() {
  const { toast } = useToast();
  const [unoptimizedImages, setUnoptimizedImages] = useState<UnoptimizedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    fetchUnoptimizedImages();
  }, []);

  const fetchUnoptimizedImages = async () => {
    try {
      setLoading(true);
      const images: UnoptimizedImage[] = [];

      // Fetch from slideshow_images
      const { data: slideshowData, error: slideshowError } = await supabase
        .from('slideshow_images')
        .select('id, image_url, blur_placeholder, image_url_sm, image_url_md, image_url_lg')
        .or('blur_placeholder.is.null,image_url_sm.is.null,image_url_md.is.null,image_url_lg.is.null');

      if (slideshowError) throw slideshowError;

      slideshowData?.forEach(img => {
        if (!img.blur_placeholder || !img.image_url_sm || !img.image_url_md || !img.image_url_lg) {
          images.push({
            id: img.id,
            image_url: img.image_url,
            table_name: 'slideshow_images',
            bucket_name: 'slideshow',
            status: 'pending',
            progress: 0,
          });
        }
      });

      // Fetch from our_story_slideshow
      const { data: storyData, error: storyError } = await supabase
        .from('our_story_slideshow')
        .select('id, image_url, blur_placeholder, image_url_sm, image_url_md, image_url_lg')
        .or('blur_placeholder.is.null,image_url_sm.is.null,image_url_md.is.null,image_url_lg.is.null');

      if (storyError) throw storyError;

      storyData?.forEach(img => {
        if (!img.blur_placeholder || !img.image_url_sm || !img.image_url_md || !img.image_url_lg) {
          images.push({
            id: img.id,
            image_url: img.image_url,
            table_name: 'our_story_slideshow',
            bucket_name: 'our-story-slideshow',
            status: 'pending',
            progress: 0,
          });
        }
      });

      setUnoptimizedImages(images);

      if (images.length === 0) {
        toast({
          title: 'All images optimized',
          description: 'All slideshow images already have optimized versions.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const optimizeImage = async (image: UnoptimizedImage) => {
    try {
      // Update status to optimizing
      setUnoptimizedImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, status: 'optimizing', progress: 10 } : img
        )
      );

      // Extract file path from URL
      const url = new URL(image.image_url);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts[pathParts.length - 1];

      // Fetch the original image
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(image.bucket_name)
        .download(filePath);

      if (downloadError) throw downloadError;

      setUnoptimizedImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, progress: 30 } : img
        )
      );

      // Call optimization edge function
      const formData = new FormData();
      formData.append('file', fileData, filePath);
      formData.append('bucket', image.bucket_name);
      formData.append('path', filePath);

      const { data: { session } } = await supabase.auth.getSession();

      const optimizeResponse = await supabase.functions.invoke('optimize-image', {
        body: formData,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : {}
      });

      setUnoptimizedImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, progress: 70 } : img
        )
      );

      if (optimizeResponse.error) {
        throw new Error(optimizeResponse.error.message || 'Optimization failed');
      }

      const optimizedUrls = optimizeResponse.data?.optimizedUrls || {};

      // Update database record
      const { error: updateError } = await supabase
        .from(image.table_name)
        .update({
          blur_placeholder: optimizedUrls.blur_placeholder || null,
          image_url_sm: optimizedUrls.image_url_sm || null,
          image_url_md: optimizedUrls.image_url_md || null,
          image_url_lg: optimizedUrls.image_url_lg || null,
        })
        .eq('id', image.id);

      if (updateError) throw updateError;

      setUnoptimizedImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, status: 'success', progress: 100 } : img
        )
      );

      return true;
    } catch (error: any) {
      console.error(`Error optimizing image ${image.id}:`, error);
      setUnoptimizedImages(prev =>
        prev.map(img =>
          img.id === image.id
            ? { ...img, status: 'error', error_message: error.message, progress: 0 }
            : img
        )
      );
      return false;
    }
  };

  const handleBulkOptimize = async () => {
    setOptimizing(true);
    let completed = 0;
    const total = unoptimizedImages.filter(img => img.status === 'pending').length;

    for (const image of unoptimizedImages) {
      if (image.status !== 'pending') continue;

      await optimizeImage(image);
      completed++;
      setOverallProgress(Math.round((completed / total) * 100));
    }

    setOptimizing(false);
    setOverallProgress(100);

    const successCount = unoptimizedImages.filter(img => img.status === 'success').length;
    const errorCount = unoptimizedImages.filter(img => img.status === 'error').length;

    toast({
      title: 'Optimization Complete',
      description: `Successfully optimized ${successCount} images. ${errorCount} failed.`,
      variant: successCount > 0 ? 'default' : 'destructive',
    });
  };

  const getStatusIcon = (status: UnoptimizedImage['status']) => {
    switch (status) {
      case 'optimizing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: UnoptimizedImage['status']) => {
    switch (status) {
      case 'optimizing':
        return <Badge variant="outline" className="bg-blue-50">Optimizing</Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Bulk Image Optimization
          </CardTitle>
          <CardDescription>
            Retroactively optimize existing slideshow images to improve loading performance.
            This will generate responsive sizes (640px, 1280px, 1920px) and blur placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unoptimizedImages.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">All Images Optimized</p>
              <p className="text-sm text-muted-foreground">
                All slideshow images have been optimized with responsive sizes and blur placeholders.
              </p>
              <Button onClick={fetchUnoptimizedImages} variant="outline" className="mt-4">
                Refresh
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Found <strong>{unoptimizedImages.length}</strong> images that need optimization
                  </p>
                  {optimizing && (
                    <div className="mt-2">
                      <Progress value={overallProgress} className="h-2 w-64" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Overall progress: {overallProgress}%
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={fetchUnoptimizedImages}
                    variant="outline"
                    disabled={optimizing}
                  >
                    Refresh
                  </Button>
                  <Button
                    onClick={handleBulkOptimize}
                    disabled={optimizing || unoptimizedImages.filter(img => img.status === 'pending').length === 0}
                  >
                    {optimizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Optimize All
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {unoptimizedImages.map((image) => (
                  <Card key={image.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={image.image_url}
                          alt="Preview"
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {image.image_url.split('/').pop()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {image.table_name === 'slideshow_images' ? 'Homepage Slideshow' : 'Our Story Slideshow'}
                          </p>
                          {image.error_message && (
                            <p className="text-xs text-destructive mt-1">
                              Error: {image.error_message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {image.status === 'optimizing' && (
                            <div className="w-24">
                              <Progress value={image.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground text-center mt-1">
                                {image.progress}%
                              </p>
                            </div>
                          )}
                          {getStatusBadge(image.status)}
                          {getStatusIcon(image.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
