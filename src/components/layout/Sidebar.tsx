import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardCheck, Settings, Users, LayoutDashboard, PlayCircle, LogOut, ChevronDown, ShieldCheck, Users2, KeyRound, GitFork, UserCog, Briefcase, SearchCheck, FileBarChart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Logo } from '@/components/ui/Logo';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { profile, roles, signOut, hasRole } = useAuth();
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const isAdmin = hasRole('administrador');

  const workNav = [
    { name: 'Mis Solicitudes', href: '/requests', icon: FileText, show: hasRole('solicitante') || isAdmin },
    { name: 'Aprobación', href: '/review', icon: ClipboardCheck, show: hasRole('gerencia') || hasRole('procesos') || hasRole('integridad_datos') || isAdmin },
    { name: 'Ejecución', href: '/execution', icon: PlayCircle, show: hasRole('ejecutor') || isAdmin },
  ];

  const adminNav = [
    { name: 'Usuarios', href: '/admin/users', icon: Users },
    { name: 'Grupos', href: '/admin/groups', icon: Users2 },
    { name: 'Formularios', href: '/admin/templates', icon: Settings },
    { name: 'Flujos de Aprobación', href: '/admin/workflows', icon: GitFork },
    { name: 'Roles', href: '/admin/roles', icon: UserCog },
  ];

  const auditNav = [
    { name: 'Auditar Maestros', href: '/audit/masters', icon: SearchCheck },
    { name: 'Reportes de Auditoría', href: '/audit/reports', icon: FileBarChart },
  ];

  const showAuditModule = import.meta.env.VITE_SHOW_AUDIT_MODULE === 'true';

  const filteredWorkNav = workNav.filter(item => item.show);
  const isWorkRouteActive = workNav.some(item => location.pathname === item.href || location.pathname.startsWith(item.href + '/'));
  const isAdminRouteActive = adminNav.some(item => location.pathname === item.href);
  const isAuditRouteActive = showAuditModule && auditNav.some(item => location.pathname === item.href);

  const [workOpen, setWorkOpen] = useState(isWorkRouteActive);
  const [adminOpen, setAdminOpen] = useState(isAdminRouteActive);
  const [auditOpen, setAuditOpen] = useState(isAuditRouteActive);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-auto min-w-[32px] rounded-lg" />
          {!collapsed && <span className="font-semibold text-sidebar-foreground">Solicitudes</span>}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {/* Dashboard */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/dashboard')} tooltip="Dashboard">
                <Link to="/dashboard" onClick={handleNavClick}>
                  <LayoutDashboard className="w-5 h-5 shrink-0" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Work Group */}
        {filteredWorkNav.length > 0 && (
          <SidebarGroup>
            {collapsed ? (
              <SidebarMenu>
                {filteredWorkNav.map(item => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.name}>
                      <Link to={item.href} onClick={handleNavClick}>
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={workOpen} onOpenChange={setWorkOpen}>
                <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                  <Briefcase className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-sm font-medium">Solicitudes</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', workOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  <SidebarMenu>
                    {filteredWorkNav.map(item => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)}>
                          <Link to={item.href} onClick={handleNavClick} className="text-sm">
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        )}

        {/* Audit Group */}
        {showAuditModule && (
          <SidebarGroup>
            {collapsed ? (
              <SidebarMenu>
                {auditNav.map(item => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.name}>
                      <Link to={item.href} onClick={handleNavClick}>
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
                <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                  <SearchCheck className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-sm font-medium">Auditor de Maestros</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', auditOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  <SidebarMenu>
                    {auditNav.map(item => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)}>
                          <Link to={item.href} onClick={handleNavClick} className="text-sm">
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        )}

        {/* Admin Group */}
        {isAdmin && (
          <SidebarGroup>
            {collapsed ? (
              <SidebarMenu>
                {adminNav.map(item => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.name}>
                      <Link to={item.href} onClick={handleNavClick}>
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-sm font-medium">Administración</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', adminOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  <SidebarMenu>
                    {adminNav.map(item => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)}>
                          <Link to={item.href} onClick={handleNavClick} className="text-sm">
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User Info */}
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed && profile && (
          <div className="mb-3">
            <p className="font-medium truncate text-sidebar-foreground">{profile.name}</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{profile.email}</p>
            <div className="flex-wrap gap-1 mt-2 flex-col flex items-start justify-start">
              {roles.map(role => (
                <span key={role} className={cn('role-badge', `role-${role}`)}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Cambiar Contraseña">
              <Link to="/change-password" onClick={handleNavClick}>
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Cambiar Contraseña</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { handleNavClick(); signOut(); }} tooltip="Cerrar Sesión">
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
