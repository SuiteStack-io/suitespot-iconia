import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useIsMobile } from '@/hooks/use-mobile';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

export const OurStorySlideshow = () => {
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchImages();

    // Set up real-time subscription for slideshow updates
    const channel = supabase
      .channel('our-story-slideshow-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'our_story_slideshow',
        },
        () => {
          fetchImages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('our_story_slideshow')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error('Error fetching our story slideshow images:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || images.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-6 bg-muted/30">
      <div className="container mx-auto">
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent>
            {images.map((image) => (
              <CarouselItem key={image.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="aspect-[4/3] overflow-hidden rounded-lg">
                  <img
                    src={image.image_url}
                    alt={`Our Story ${image.sequence_order + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {!isMobile && (
            <>
              <CarouselPrevious className="left-4 bg-background/60 hover:bg-background/80 border-0" />
              <CarouselNext className="right-4 bg-background/60 hover:bg-background/80 border-0" />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
};
