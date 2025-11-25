export interface FeatureCategory {
  name: string;
  icon: string;
  features: string[];
}

export const PROPERTY_FEATURES: FeatureCategory[] = [
  {
    name: "Interior Amenities",
    icon: "🏠",
    features: [
      "Air Conditioning",
      "Heating System",
      "Smart TV",
      "WiFi",
      "Fully Equipped Kitchen",
      "Washing Machine",
      "Dryer",
      "Dishwasher",
      "Microwave",
      "Coffee Machine",
      "Iron & Ironing Board",
    ],
  },
  {
    name: "Outdoor Features",
    icon: "🌴",
    features: [
      "Private Pool",
      "Shared Pool",
      "Private Beach Access",
      "Garden",
      "Outdoor Terrace",
      "BBQ Area",
      "Outdoor Dining Area",
      "Balcony",
      "Sea View",
      "Mountain View",
      "Garden View",
    ],
  },
  {
    name: "Bedrooms & Bathrooms",
    icon: "🛏️",
    features: [
      "King Size Bed",
      "Queen Size Bed",
      "Twin Beds",
      "En-suite Bathroom",
      "Bathtub",
      "Walk-in Shower",
      "Hair Dryer",
      "Toiletries Provided",
    ],
  },
  {
    name: "Safety & Convenience",
    icon: "🔒",
    features: [
      "24/7 Security",
      "Gated Community",
      "Private Parking",
      "Elevator Access",
      "Wheelchair Accessible",
      "First Aid Kit",
      "Fire Extinguisher",
      "Safe/Lock Box",
    ],
  },
];

// Flatten all features for easy search
export const ALL_FEATURES = PROPERTY_FEATURES.flatMap(
  (category) => category.features
);
