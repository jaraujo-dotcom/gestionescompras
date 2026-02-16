import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Profile, AppRole, ROLE_LABELS } from '@/types/database';
import { Loader2, Users, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Group {
  id: string;
  name: string;
}

interface UserWithRoles extends Profile {
  roles: AppRole[];
  groups: Group[];
}

const ALL_ROLES: AppRole[] = ['solicitante', 'gerencia', 'procesos', 'integridad_datos', 'ejecutor', 'administrador'];

export default function UsersList() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [profilesRes, rolesRes, groupsRes, userGroupsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.from('user_roles').select('*'),
        supabase.from('groups').select('*').order('name'),
        supabase.from('user_groups').select('*'),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const groups = (groupsRes.data || []) as Group[];
      setAllGroups(groups);

      const usersWithRoles = (profilesRes.data as Profile[]).map((profile) => ({
        ...profile,
        roles: (rolesRes.data || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
        groups: (userGroupsRes.data || [])
          .filter((ug) => ug.user_id === profile.id)
          .map((ug) => groups.find((g) => g.id === ug.group_id))
          .filter(Boolean) as Group[],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles([...user.roles]);
    setSelectedGroupIds(user.groups.map((g) => g.id));
    setDialogOpen(true);
  };

  const toggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]
    );
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    setSaving(true);

    try {
      const currentRoles = selectedUser.roles;
      const currentGroupIds = selectedUser.groups.map((g) => g.id);

      // Compute diffs for roles
      const rolesToAdd = selectedRoles.filter((r) => !currentRoles.includes(r));
      const rolesToRemove = currentRoles.filter((r) => !selectedRoles.includes(r));

      // Compute diffs for groups
      const groupsToAdd = selectedGroupIds.filter((g) => !currentGroupIds.includes(g));
      const groupsToRemove = currentGroupIds.filter((g) => !selectedGroupIds.includes(g));

      // Insert new roles first (before any deletes)
      if (rolesToAdd.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map((role) => ({ user_id: selectedUser.id, role })));
        if (error) throw error;
      }

      // Insert new groups
      if (groupsToAdd.length > 0) {
        const { error } = await supabase
          .from('user_groups')
          .insert(groupsToAdd.map((group_id) => ({ user_id: selectedUser.id, group_id })));
        if (error) throw error;
      }

      // Remove old roles
      for (const role of rolesToRemove) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id)
          .eq('role', role);
        if (error) throw error;
      }

      // Remove old groups
      for (const groupId of groupsToRemove) {
        const { error } = await supabase
          .from('user_groups')
          .delete()
          .eq('user_id', selectedUser.id)
          .eq('group_id', groupId);
        if (error) throw error;
      }

      toast.success('Roles y grupos actualizados');
      setDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving roles:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <p className="text-muted-foreground">Administre roles y grupos de usuarios</p>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin usuarios</h3>
            <p className="text-muted-foreground">No hay usuarios registrados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Usuarios ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {user.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin roles</span>
                      ) : (
                        user.roles.map((role) => (
                          <span key={role} className={cn('role-badge', `role-${role}`)}>
                            {ROLE_LABELS[role]}
                          </span>
                        ))
                      )}
                    </div>
                    {user.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.groups.map((group) => (
                          <Badge key={group.id} variant="outline" className="text-xs">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                    Editar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Roles & Groups Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Roles y grupos para {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* Roles */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Roles</Label>
              {ALL_ROLES.map((role) => (
                <div key={role} className="flex items-center space-x-3">
                  <Checkbox
                    id={role}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label htmlFor={role} className="flex-1">
                    <span className={cn('role-badge', `role-${role}`)}>
                      {ROLE_LABELS[role]}
                    </span>
                  </Label>
                </div>
              ))}
            </div>

            {/* Groups */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Grupos</Label>
              {allGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay grupos creados</p>
              ) : (
                allGroups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroupIds.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <Label htmlFor={`group-${group.id}`} className="flex-1">
                      <Badge variant="outline">{group.name}</Badge>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
