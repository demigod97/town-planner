import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapTab } from "./MapTab";
import { MapPreview } from "./MapPreview";
import { template } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

interface PermitDrawerProps {
  sessionId?: string;
  onTemplateCreated?: (id: string) => void;
}

export const PermitDrawer = ({ sessionId, onTemplateCreated }: PermitDrawerProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      permitType: "",
      address: "",
      applicant: ""
    }
  });

  const watchedAddress = watch("address");

  const onSubmit = async (data: any) => {
    if (!data.permitType || !data.address || !data.applicant) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await template(sessionId || "", data.permitType, data.address, data.applicant);
      
      toast({
        title: "Template queued",
        description: "Your permit template is being generated",
      });
      
      if (onTemplateCreated && result.id) {
        onTemplateCreated(result.id);
      }
      
      reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate template",
        variant: "destructive",
      });
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
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="permitType">Permit Type</Label>
                  <Select {...register("permitType")}>
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
                    {...register("address")}
                    placeholder="123 Main Street, City, State"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="applicant">Applicant Name</Label>
                  <Input
                    id="applicant"
                    {...register("applicant")}
                    placeholder="John Doe"
                    className="bg-background"
                  />
                </div>

                <MapPreview address={watchedAddress} />

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