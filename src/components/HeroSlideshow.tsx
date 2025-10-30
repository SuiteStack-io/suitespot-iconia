import { useState, useEffect } from 'react';

// Import all slideshow images
import iconiaZamalek from '@/assets/hero-slideshow/iconia-zamalek.jpg';
import samcrete1 from '@/assets/hero-slideshow/samcrete-1.jpg';
import samcrete2 from '@/assets/hero-slideshow/samcrete-2.jpg';
import samcrete5 from '@/assets/hero-slideshow/samcrete-5.jpg';
import samcrete8 from '@/assets/hero-slideshow/samcrete-8.jpg';
import samcrete15 from '@/assets/hero-slideshow/samcrete-15.jpg';
import samcrete17 from '@/assets/hero-slideshow/samcrete-17.jpg';
import samcrete18 from '@/assets/hero-slideshow/samcrete-18.jpg';

const images = [
  iconiaZamalek,
  samcrete1,
  samcrete2,
  samcrete5,
  samcrete8,
  samcrete15,
  samcrete17,
  samcrete18,
];

export const HeroSlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        setIsTransitioning(false);
      }, 1000);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 1000);
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Slideshow images */}
      {images.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={image}
            alt={`SuiteSpot hero ${index + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40" />

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
