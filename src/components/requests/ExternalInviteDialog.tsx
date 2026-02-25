import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';

interface ExternalInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestNumber: number;
  onInviteCreated?: () => void;
}

export function ExternalInviteDialog({
  open, onOpenChange, requestId, requestNumber, onInviteCreated,
}: ExternalInviteDialogProps) {
  const { user } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [expirationHours, setExpirationHours] = useState(72);
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('external_invitations' as any).insert({
        request_id: requestId,
        token,
        status: 'pending',
        expires_at: expiresAt,
        guest_name: guestName || null,
        guest_email: guestEmail || null,
        created_by: user.id,
      } as any);

      if (error) throw error;

      // Change request status to esperando_tercero
      await supabase.from('requests').update({ status: 'esperando_tercero' as any }).eq('id', requestId);
      await supabase.from('request_status_history').insert({
        request_id: requestId,
        from_status: 'borrador',
        to_status: 'esperando_tercero' as any,
        changed_by: user.id,
        comment: `Enlace externo generado para ${guestName || 'invitado'}`,
      });

      const link = `${window.location.origin}/external/${token}`;
      setGeneratedLink(link);
      toast.success('Enlace generado exitosamente');
      onInviteCreated?.();
    } catch (error) {
      console.error('Error generating invite:', error);
      toast.error('Error al generar el enlace');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success('Enlace copiado al portapapeles');
  };

  const handleClose = () => {
    setGeneratedLink('');
    setGuestName('');
    setGuestEmail('');
    setExpirationHours(72);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar Tercero Externo</DialogTitle>
          <DialogDescription>
            Genere un enlace temporal para que un tercero complete los campos externos de la solicitud #{String(requestNumber).padStart(6, '0')}.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guestName">Nombre del invitado (opcional)</Label>
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ej: Proveedor ABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestEmail">Email del invitado (opcional)</Label>
              <Input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="proveedor@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expHours">Expiración (horas)</Label>
              <Input
                id="expHours"
                type="number"
                min={1}
                max={720}
                value={expirationHours}
                onChange={(e) => setExpirationHours(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                El enlace expirará en {expirationHours} horas ({Math.round(expirationHours / 24)} días).
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Generar enlace
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Enlace generado</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Comparta este enlace con el tercero. El enlace es de un solo uso y expira en {expirationHours} horas.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
