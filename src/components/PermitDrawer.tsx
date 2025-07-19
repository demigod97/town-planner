import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapTab } from "./MapTab";
import { toast } from "sonner";

interface PermitDrawerProps {
  sessionId?: string;
  onTemplateCreated?: (id: string) => void;
}

export const PermitDrawer = ({ sessionId, onTemplateCreated }: PermitDrawerProps) => {
  const [permitType, setPermitType] = useState("");
  const [address, setAddress] = useState("");
  const [applicant, setApplicant] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!permitType || !address || !applicant) {
      toast("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          permitType,
          address,
          applicant,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast("Template queued successfully");
        onTemplateCreated?.(data.id);
        
        // Reset form
        setPermitType("");
        setAddress("");
        setApplicant("");
      } else {
        throw new Error("Failed to submit template request");
      }
    } catch (error) {
      console.error("Template submission error:", error);
      toast("Failed to queue template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-[340px] bg-sidebar-custom border-l h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-medium text-foreground">Assistant Actions</h2>
        <p className="text-sm text-muted-foreground">Generate permits and view locations.</p>
      </div>
      
      <div className="flex-1 p-4">
        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          
          <TabsContent value="actions" className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Permit Template Generator
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="permitType">Permit Type</Label>
                  <Select value={permitType} onValueChange={setPermitType}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select permit type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="building">Building Permit</SelectItem>
                      <SelectItem value="zoning">Zoning Variance</SelectItem>
                      <SelectItem value="subdivision">Subdivision</SelectItem>
                      <SelectItem value="site-plan">Site Plan Review</SelectItem>
                      <SelectItem value="special-use">Special Use Permit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Property Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street, City, State"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="applicant">Applicant Name</Label>
                  <Input
                    id="applicant"
                    value={applicant}
                    onChange={(e) => setApplicant(e.target.value)}
                    placeholder="John Doe"
                    className="bg-background"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Generating..." : "Generate Template"}
                </Button>
              </form>
            </div>
          </TabsContent>
          
          <TabsContent value="map" className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Location & Mapping
              </h3>
              
              {sessionId ? (
                <MapTab sessionId={sessionId} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Session required for map functionality
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};