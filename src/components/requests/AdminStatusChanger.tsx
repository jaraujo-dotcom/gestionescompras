import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RequestStatus, STATUS_LABELS } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ALL_STATUSES: RequestStatus[] = [
  'borrador',
  'en_revision',
  'devuelta',
  'aprobada',
  'en_ejecucion',
  'en_espera',
  'completada',
  'rechazada',
  'anulada',
];

interface AdminStatusChangerProps {
  requestId: string;
  currentStatus: RequestStatus;
  userId: string;
  onStatusChanged: () => void;
}

export function AdminStatusChanger({ requestId, currentStatus, userId, onStatusChanged }: AdminStatusChangerProps) {
  const [newStatus, setNewStatus] = useState<RequestStatus | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const availableStatuses = ALL_STATUSES.filter((s) => s !== currentStatus);

  const handleChangeStatus = async () => {
    if (!newStatus) {
      toast.error('Seleccione un estado');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase.from('request_status_history').insert({
        request_id: requestId,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by: userId,
        comment: comment.trim() || `Estado cambiado por administrador: ${STATUS_LABELS[currentStatus]} → ${STATUS_LABELS[newStatus]}`,
      });

      if (historyError) throw historyError;

      toast.success(`Estado cambiado a ${STATUS_LABELS[newStatus]}`);
      setNewStatus('');
      setComment('');
      onStatusChanged();
    } catch (error: any) {
      console.error('Error changing status:', error);
      toast.error(`Error al cambiar estado: ${error?.message || 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Cambiar Estado (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Estado actual:</span>
          <StatusBadge status={currentStatus} />
        </div>

        <Select value={newStatus} onValueChange={(v) => setNewStatus(v as RequestStatus)}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar nuevo estado..." />
          </SelectTrigger>
          <SelectContent>
            {availableStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          placeholder="Comentario (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />

        <Button onClick={handleChangeStatus} disabled={saving || !newStatus} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
          Cambiar Estado
        </Button>
      </CardContent>
    </Card>
  );
}
