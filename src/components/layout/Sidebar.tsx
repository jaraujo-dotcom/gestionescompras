import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardCheck, Settings, Users, LayoutDashboard, PlayCircle, LogOut, ChevronLeft, ChevronRight, Bell, BellRing, ChevronDown, ShieldCheck, Users2, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function Sidebar() {
  const {
    profile,
    roles,
    signOut,
    hasRole
  } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = hasRole('administrador');

  const mainNav = [{
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    show: true
  }, {
    name: 'Notificaciones',
    href: '/notifications',
    icon: Bell,
    show: true
  }, {
    name: 'Mis Solicitudes',
    href: '/requests',
    icon: FileText,
    show: hasRole('solicitante') || isAdmin
  }, {
    name: 'Aprobación',
    href: '/review',
    icon: ClipboardCheck,
    show: hasRole('gerencia') || hasRole('procesos') || hasRole('integridad_datos') || isAdmin
  }, {
    name: 'Ejecución',
    href: '/execution',
    icon: PlayCircle,
    show: hasRole('ejecutor') || isAdmin
  }];

  const adminNav = [{
    name: 'Usuarios',
    href: '/admin/users',
    icon: Users
  }, {
    name: 'Grupos',
    href: '/admin/groups',
    icon: Users2
  }, {
    name: 'Formularios',
    href: '/admin/templates',
    icon: Settings
  }, {
    name: 'Config. Notificaciones',
    href: '/admin/notifications',
    icon: BellRing
  }];

  const filteredMainNav = mainNav.filter(item => item.show);
  const isAdminRouteActive = adminNav.some(item => location.pathname === item.href);
  const [adminOpen, setAdminOpen] = useState(false);

  return <div className={cn('flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold">Solicitudes</span>
          </div>}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="text-sidebar-foreground hover:bg-sidebar-accent">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {filteredMainNav.map(item => {
        const isActive = location.pathname === item.href;
        return <Link key={item.name} to={item.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent text-sidebar-foreground')}>
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>;
        })}

        {/* Admin Group */}
        {isAdmin && (
          collapsed ? (
            adminNav.map(item => {
              const isActive = location.pathname === item.href;
              return <Link key={item.name} to={item.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent text-sidebar-foreground')}>
                <item.icon className="w-5 h-5 shrink-0" />
              </Link>;
            })
          ) : (
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen} className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-sm font-medium">Administración</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', adminOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {adminNav.map(item => {
                  const isActive = location.pathname === item.href;
                  return <Link key={item.name} to={item.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm', isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent text-sidebar-foreground')}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>;
                })}
              </CollapsibleContent>
            </Collapsible>
          )
        )}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed && profile && <div className="mb-3">
            <p className="font-medium truncate">{profile.name}</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{profile.email}</p>
            <div className="flex-wrap gap-1 mt-2 flex-col flex items-start justify-start">
              {roles.map(role => <span key={role} className={cn('role-badge', `role-${role}`)}>
                  {role}
                </span>)}
            </div>
          </div>}
        <Link to="/change-password" className={cn('flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent mb-1', collapsed && 'justify-center px-0')}>
          <KeyRound className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">Cambiar Contraseña</span>}
        </Link>
        <Button variant="ghost" onClick={signOut} className={cn('w-full text-sidebar-foreground hover:bg-sidebar-accent', collapsed ? 'justify-center px-0' : 'justify-start')}>
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
      </div>
    </div>;
}