import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapTab } from "./MapTab";
import { MapPreview } from "./MapPreview";
import { template, genTemplate } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { validateRequired } from "@/lib/error-handling";

interface PermitDrawerProps {
  sessionId?: string;
  onTemplateCreated?: (id: string) => void;
}

export const PermitDrawer = ({ sessionId, onTemplateCreated }: PermitDrawerProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [download, setDownload] = useState<string>('');
  const { handleAsyncError } = useErrorHandler();
  
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      permitType: "",
      address: "",
      applicant: ""
    }
  });

  const watchedAddress = watch("address");

  const onSubmit = async (data: any) => {
    try {
      // Validate required fields
      validateRequired(data.permitType, 'Permit Type');
      validateRequired(data.address, 'Property Address');
      validateRequired(data.applicant, 'Applicant Name');
    } catch (error) {
      toast({
        title: "Validation Error",
        description: error.message || "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await handleAsyncError(
        () => genTemplate({
          ...data,
          sessionId: sessionId || ""
        }),
        { operation: 'generate_template', permitType: data.permitType }
      );
      
      setPreview(result.preview_url);
      setDownload(result.docx_url);
      
      toast({
        title: "Template ready",
        description: "Your permit template has been generated and sent to n8n for processing.",
      });
      
      if (onTemplateCreated) {
        onTemplateCreated(result.docx_url);
      }
      
      reset();
    } catch (error) {
      // Error already handled by handleAsyncError
      toast({
        title: "Error",
        description: "Failed to generate template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComponentErrorBoundary>
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
                        <SelectValue placeholder="Select type" />
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
                      placeholder="Enter property address"
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="applicant">Applicant Name</Label>
                    <Input
                      id="applicant"
                      {...register("applicant")}
                      placeholder="Enter applicant name"
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
                  
                  {download && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => window.open(download, '_blank')}
                    >
                      Download Template
                    </Button>
                  )}
                  
                  {preview && (
                    <Button 
                      variant="ghost" 
                      className="w-full mt-1"
                      onClick={() => window.open(preview, '_blank')}
                    >
                      Preview Template
                    </Button>
                  )}
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
    </ComponentErrorBoundary>
  );
};