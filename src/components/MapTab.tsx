import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const libraries: ("places")[] = ["places"];

interface MapTabProps {
  sessionId: string;
}

interface SelectedPlace {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

export const MapTab = ({ sessionId }: MapTabProps) => {
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [address, setAddress] = useState("");

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY", // TODO: Replace with actual API key
    libraries,
  });

  const handlePlaceSelect = useCallback(async (place: google.maps.places.PlaceResult) => {
    if (!place.place_id || !place.geometry?.location) return;

    const selectedPlace: SelectedPlace = {
      placeId: place.place_id,
      address: place.formatted_address || "",
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    setSelectedPlace(selectedPlace);
    setAddress(selectedPlace.address);

    try {
      await fetch("/api/chat/location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          placeId: selectedPlace.placeId,
          geojson: {
            type: "Point",
            coordinates: [selectedPlace.lng, selectedPlace.lat],
          },
        }),
      });
      
      toast("Location saved successfully");
    } catch (error) {
      console.error("Failed to save location:", error);
      toast("Failed to save location");
    }
  }, [sessionId]);

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Property Address
        </label>
        <Input
          placeholder="Enter address to search..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Google Places Autocomplete will be integrated here
        </p>
      </div>

      {isLoaded && selectedPlace ? (
        <div className="border rounded-lg overflow-hidden">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "200px" }}
            center={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
            zoom={16}
            options={mapOptions}
          >
            <Marker position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }} />
          </GoogleMap>
        </div>
      ) : (
        <div className="border rounded-lg h-[200px] bg-muted/50 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {isLoaded ? "Select an address to view map" : "Loading map..."}
          </p>
        </div>
      )}

      {selectedPlace && (
        <div className="text-xs text-muted-foreground">
          <p>Place ID: {selectedPlace.placeId}</p>
          <p>Coordinates: {selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}</p>
        </div>
      )}
    </div>
  );
};