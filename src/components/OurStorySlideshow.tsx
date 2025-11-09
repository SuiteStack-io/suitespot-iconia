import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

export const OurStorySlideshow = () => {
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = scrollContainerRef.current.offsetWidth * 0.8;
    const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  if (loading || images.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-6 bg-muted/30">
      <div className="container mx-auto relative">
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((image) => (
            <div 
              key={image.id} 
              className="flex-none w-full md:w-1/2 lg:w-1/3 snap-start"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg">
                <img
                  src={image.image_url}
                  alt={`Our Story ${image.sequence_order + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* Desktop Navigation Arrows */}
        {!isMobile && images.length > 3 && (
          <>
            <button
              onClick={() => scroll('left')}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full p-2 transition-all"
              aria-label="Previous images"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full p-2 transition-all"
              aria-label="Next images"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </section>
  );
};
