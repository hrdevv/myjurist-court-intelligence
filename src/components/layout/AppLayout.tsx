import { ReactNode, useState } from "react";
import { Sidebar, SidebarContent } from "./Sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DEMO_LEGAL_OUTPUTS_ENABLED } from "@/lib/demo-mode";
import { AlertTriangle, Menu, Scale } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between gap-2 bg-sidebar text-sidebar-foreground px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0">
              <Scale className="size-4" />
            </div>
            <span className="font-serif text-sm truncate">Courtroom Intelligence</span>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Open navigation menu"
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-sidebar-accent/50 transition-colors"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <div className="bg-warning/15 border-b border-warning/30 px-4 md:px-6 py-2 text-xs flex items-start gap-2 text-warning-foreground">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>{DEMO_LEGAL_OUTPUTS_ENABLED ? "Demo legal outputs enabled" : "Demo legal outputs disabled"}</strong>
            {" "}· Mock-only surfaces, including demo team data and demo draft generation, are opt-in via
            {" "}<span className="font-mono">VITE_DEMO_LEGAL_OUTPUTS=enabled</span>.
            Production environments must keep this disabled until persisted review/report APIs are live.
          </span>
        </div>
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-2xl sm:text-3xl text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
