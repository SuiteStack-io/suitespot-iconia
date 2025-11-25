import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PROPERTY_FEATURES } from "@/constants/propertyFeatures";

interface PropertyDetailsModalProps {
  open: boolean;
  onClose: () => void;
  property: {
    name: string;
    photos: string[] | null;
    beds: number | null;
    baths: number | null;
    max_guests: number | null;
    unit_size: string | null;
    view: string | null;
    address: string | null;
    features: string[] | null;
    min_stay: number | null;
    price_per_night: number | null;
    payment_terms: string | null;
  };
}

export function PropertyDetailsModal({ open, onClose, property }: PropertyDetailsModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = property.photos || [];

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const previousPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-3xl font-semibold">
            {property.name}
          </DialogTitle>
        </DialogHeader>

        {/* Photo Slideshow */}
        {photos.length > 0 && (
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            <img
              src={photos[currentPhotoIndex]}
              alt={`${property.name} - Photo ${currentPhotoIndex + 1}`}
              className="w-full h-full object-cover"
            />
            
            {photos.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                  onClick={previousPhoto}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                  onClick={nextPhoto}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                {/* Photo counter */}
                <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* Property Details */}
        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {property.beds && (
              <div>
                <span className="font-semibold">Bedrooms:</span> {property.beds}
              </div>
            )}
            {property.baths && (
              <div>
                <span className="font-semibold">Bathrooms:</span> {property.baths}
              </div>
            )}
            {property.max_guests && (
              <div>
                <span className="font-semibold">Max Guests:</span> {property.max_guests}
              </div>
            )}
            {property.unit_size && (
              <div>
                <span className="font-semibold">Size:</span> {property.unit_size}
              </div>
            )}
            {property.view && (
              <div className="col-span-2">
                <span className="font-semibold">View:</span> {property.view}
              </div>
            )}
            {property.address && (
              <div className="col-span-2">
                <span className="font-semibold">Address:</span> {property.address}
              </div>
            )}
            {property.min_stay && (
              <div>
                <span className="font-semibold">Min Stay:</span> {property.min_stay} nights
              </div>
            )}
            {property.price_per_night && (
              <div>
                <span className="font-semibold">Price per Night:</span> ${property.price_per_night}
              </div>
            )}
            {property.payment_terms && (
              <div className="col-span-2">
                <span className="font-semibold">Payment Terms:</span> {property.payment_terms}
              </div>
            )}
          </div>

          {/* Features & Amenities */}
          {property.features && property.features.length > 0 && (
            <div>
              <h3 className="font-playfair text-xl font-semibold mb-4">
                Features & Amenities
              </h3>
              <div className="space-y-6">
                {PROPERTY_FEATURES.map((category) => {
                  const categoryFeatures = property.features?.filter(f => 
                    category.features.includes(f)
                  ) || [];
                  
                  if (categoryFeatures.length === 0) return null;
                  
                  return (
                    <div key={category.name}>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <span className="text-lg">{category.icon}</span>
                        {category.name}
                      </h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-7">
                        {categoryFeatures.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                
                {/* Custom Features (features not in predefined categories) */}
                {(() => {
                  const allPredefinedFeatures = PROPERTY_FEATURES.flatMap(cat => cat.features);
                  const customFeatures = property.features?.filter(
                    f => !allPredefinedFeatures.includes(f)
                  ) || [];
                  
                  if (customFeatures.length === 0) return null;
                  
                  return (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <span className="text-lg">✨</span>
                        Additional Features
                      </h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-7">
                        {customFeatures.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
