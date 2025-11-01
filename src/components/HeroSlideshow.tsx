import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

export const HeroSlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchImages();

    // Set up real-time subscription for slideshow updates
    const channel = supabase
      .channel('slideshow-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slideshow_images',
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
        .from('slideshow_images')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error('Error fetching slideshow images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        setIsTransitioning(false);
      }, 1000);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  const goToSlide = (index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 1000);
  };

  if (loading || images.length === 0) {
    return (
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-gradient-to-br from-black/60 to-black/40" />
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Slideshow images */}
      {images.map((image, index) => {
        // Only render current, previous, and next images to improve performance
        const isPrevious = index === (currentIndex - 1 + images.length) % images.length;
        const isCurrent = index === currentIndex;
        const isNext = index === (currentIndex + 1) % images.length;
        const shouldRender = isPrevious || isCurrent || isNext;

        if (!shouldRender) return null;

        return (
          <div
            key={image.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
              isCurrent ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={image.image_url}
              alt={`SuiteSpot hero ${index + 1}`}
              className="w-full h-full object-cover"
              loading={isCurrent ? 'eager' : 'lazy'}
              decoding="async"
            />
          </div>
        );
      })}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-black/5" />

      {/* Navigation dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-white w-8'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
