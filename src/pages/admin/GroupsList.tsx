import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Users2, Plus, Trash2, Save, UserPlus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  user_name?: string;
  user_email?: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

export default function GroupsList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  // Members state
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('name');
      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setDialogOpen(true);
  };

  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update({ name: groupName, description: groupDescription || null })
          .eq('id', editingGroup.id);
        if (error) throw error;
        toast.success('Grupo actualizado');
      } else {
        const { error } = await supabase
          .from('groups')
          .insert({ name: groupName, description: groupDescription || null });
        if (error) throw error;
        toast.success('Grupo creado');
      }
      setDialogOpen(false);
      fetchGroups();
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast.error(error?.message?.includes('unique') ? 'Ya existe un grupo con ese nombre' : 'Error al guardar grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: Group) => {
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Los usuarios serán desasignados.`)) return;
    try {
      const { error } = await supabase.from('groups').delete().eq('id', group.id);
      if (error) throw error;
      toast.success('Grupo eliminado');
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Error al eliminar grupo');
    }
  };

  const openMembersDialog = async (group: Group) => {
    setSelectedGroup(group);
    setMembersDialogOpen(true);
    setLoadingMembers(true);
    try {
      const [membersRes, profilesRes] = await Promise.all([
        supabase.from('user_groups').select('*').eq('group_id', group.id),
        supabase.from('profiles').select('*').order('name'),
      ]);
      if (membersRes.error) throw membersRes.error;

      const profiles = (profilesRes.data || []) as Profile[];
      setAllProfiles(profiles);

      const enrichedMembers = (membersRes.data || []).map((m) => {
        const p = profiles.find((pr) => pr.id === m.user_id);
        return { ...m, user_name: p?.name, user_email: p?.email };
      });
      setMembers(enrichedMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Error al cargar miembros');
    } finally {
      setLoadingMembers(false);
    }
  };

  const addMember = async () => {
    if (!selectedUserId || !selectedGroup) return;
    try {
      const { error } = await supabase
        .from('user_groups')
        .insert({ user_id: selectedUserId, group_id: selectedGroup.id });
      if (error) throw error;
      toast.success('Miembro agregado');
      setSelectedUserId('');
      openMembersDialog(selectedGroup);
    } catch (error: any) {
      toast.error(error?.message?.includes('unique') ? 'El usuario ya pertenece a este grupo' : 'Error al agregar miembro');
    }
  };

  const removeMember = async (membershipId: string) => {
    if (!selectedGroup) return;
    try {
      const { error } = await supabase.from('user_groups').delete().eq('id', membershipId);
      if (error) throw error;
      toast.success('Miembro removido');
      openMembersDialog(selectedGroup);
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Error al remover miembro');
    }
  };

  const availableUsers = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Grupos</h1>
          <p className="text-muted-foreground">Administre los grupos y sus miembros</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin grupos</h3>
            <p className="text-muted-foreground">Cree un grupo para organizar usuarios</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{group.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMembersDialog(group)} title="Miembros">
                      <UserPlus className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(group)} title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {group.description || 'Sin descripción'}
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openEditDialog(group)}>
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}</DialogTitle>
            <DialogDescription>
              {editingGroup ? 'Modifique los datos del grupo' : 'Complete los datos para crear un grupo'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ej: Departamento de Compras" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Descripción del grupo..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingGroup ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Miembros de "{selectedGroup?.name}"</DialogTitle>
            <DialogDescription>Gestione los miembros de este grupo</DialogDescription>
          </DialogHeader>
          {loadingMembers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Add member */}
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addMember} disabled={!selectedUserId} size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>

              {/* Current members */}
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin miembros</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div>
                        <p className="text-sm font-medium">{member.user_name || 'Usuario'}</p>
                        <p className="text-xs text-muted-foreground">{member.user_email}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMember(member.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
