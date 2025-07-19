import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Document {
  id: string;
  name: string;
  size: string;
  checked: boolean;
}

const documents: Document[] = [
  { id: "1", name: "Zoning Master Plan 2023.pdf", size: "1.2 MB", checked: true },
  { id: "2", name: "Environmental Impact Report.pdf", size: "3.5 MB", checked: false },
  { id: "3", name: "Building Code Regulations.pdf", size: "850 KB", checked: false },
  { id: "4", name: "Heritage Preservation Guidelines.pdf", size: "5.1 MB", checked: false },
];

export const SourcesSidebar = () => {
  return (
    <div className="w-[260px] bg-sidebar-custom border-r h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-medium text-foreground mb-1">Sources</h2>
        <p className="text-sm text-muted-foreground">Select PDF documents to use as context.</p>
      </div>
      
      <div className="flex-1 p-4 space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
            <Checkbox
              checked={doc.checked}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight mb-1">
                {doc.name}
              </p>
              <Badge variant="secondary" className="text-xs">
                {doc.size}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};