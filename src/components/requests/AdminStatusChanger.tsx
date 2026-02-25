import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RequestStatus, STATUS_LABELS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const availableStatuses = ALL_STATUSES.filter((s) => s !== currentStatus);

  const handleChangeStatus = async (newStatus: RequestStatus) => {
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      await supabase.from('request_status_history').insert({
        request_id: requestId,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by: userId,
        comment: comment.trim() || `Estado cambiado por administrador: ${STATUS_LABELS[currentStatus]} → ${STATUS_LABELS[newStatus]}`,
      });

      toast.success(`Estado cambiado a ${STATUS_LABELS[newStatus]}`);
      setComment('');
      setOpen(false);
      onStatusChanged();
    } catch (error: any) {
      console.error('Error changing status:', error);
      toast.error(`Error al cambiar estado: ${error?.message || 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity" title="Cambiar estado (Admin)">
          <StatusBadge status={currentStatus} />
          <Shield className="w-3.5 h-3.5 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">Cambiar estado:</p>
        <Textarea
          placeholder="Comentario (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="text-xs"
        />
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {availableStatuses.map((status) => (
            <button
              key={status}
              disabled={saving}
              onClick={() => handleChangeStatus(status)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors text-left disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <StatusBadge status={status} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
