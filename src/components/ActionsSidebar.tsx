import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export const ActionsSidebar = () => {
  const [permitType, setPermitType] = useState("new-construction");
  const [projectAddress, setProjectAddress] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [searchAddress, setSearchAddress] = useState("");

  const handleGenerateTemplate = () => {
    console.log("Generate template clicked", { permitType, projectAddress, applicantName });
  };

  return (
    <div className="w-[340px] bg-sidebar-custom border-l h-full">
      <Tabs defaultValue="actions" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>
        
        <TabsContent value="actions" className="flex-1 p-4 space-y-6">
          <div>
            <h3 className="font-medium text-foreground mb-4">Permit Template Generator</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="permit-type" className="text-sm font-medium">
                  Permit Type
                </Label>
                <Select value={permitType} onValueChange={setPermitType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new-construction">New Construction</SelectItem>
                    <SelectItem value="renovation">Renovation</SelectItem>
                    <SelectItem value="addition">Addition</SelectItem>
                    <SelectItem value="demolition">Demolition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="project-address" className="text-sm font-medium">
                  Project Address
                </Label>
                <Input
                  id="project-address"
                  placeholder="e.g., 123 Elm Street"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="applicant-name" className="text-sm font-medium">
                  Applicant Name
                </Label>
                <Input
                  id="applicant-name"
                  placeholder="e.g., Jane Doe"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <Button 
                onClick={handleGenerateTemplate}
                className="w-full mt-6"
              >
                Generate Template
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="map" className="flex-1 p-4 space-y-4">
          <div>
            <h3 className="font-medium text-foreground mb-4">Address Autocomplete</h3>
            
            <div>
              <Label htmlFor="search-address" className="text-sm font-medium">
                Search Address
              </Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-address"
                  placeholder="Start typing an address..."
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Map Preview */}
            <div className="mt-4">
              <div className="w-full h-[200px] bg-muted rounded-lg flex items-center justify-center border">
                <div className="text-center text-muted-foreground">
                  <div className="text-sm">Map Preview</div>
                  <div className="text-xs mt-1">300 × 200</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};