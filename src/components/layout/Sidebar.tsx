import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, ClipboardList, FileCheck, Shield, Users, Scale, LogOut } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cases", label: "Cases", icon: Briefcase },
  { to: "/review", label: "Review Queue", icon: ClipboardList, roles: ["lawyer", "paralegal", "reviewer"] },
  { to: "/reports", label: "Reports", icon: FileCheck },
  { to: "/team", label: "Team", icon: Users, roles: ["lawyer", "paralegal"] },
  { to: "/audit", label: "Audit", icon: Shield, roles: ["lawyer", "reviewer"] },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, roles, hasAnyRole, signOut } = useAuth();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const visibleNav = nav.filter((n) => !n.roles || hasAnyRole(n.roles));
  const primaryRole = roles[0] ?? "viewer";

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-2">
        <div className="size-9 rounded-md bg-sidebar-accent flex items-center justify-center">
          <Scale className="size-5" />
        </div>
        <div>
          <div className="font-serif text-base leading-tight">Courtroom</div>
          <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60">Intelligence v1.2</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {visibleNav.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
              }`}
            >
              <Icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-3">
        <div className="px-1">
          <div className="text-sm font-medium truncate">{user?.email ?? "Signed in"}</div>
          <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60 capitalize">{primaryRole}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
