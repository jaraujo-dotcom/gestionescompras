import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { RequestStatus, STATUS_LABELS, Profile } from '@/types/database';
import { MessageSquare, Send, Loader2, Clock, User, GitCommitHorizontal, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sendNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';

interface TimelineEntry {
  id: string;
  type: 'comment' | 'status';
  created_at: string;
  userName: string;
  // comment fields
  comment?: string;
  // status fields
  toStatus?: RequestStatus;
  statusComment?: string;
}

interface RequestTimelineProps {
  requestId: string;
  requestNumber?: number;
  history: { id: string; created_at: string; to_status: string; comment?: string | null; profile?: { name: string } }[];
}

export function RequestTimeline({ requestId, requestNumber, history }: RequestTimelineProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<{ id: string; user_id: string; comment: string; created_at: string; profile?: { id: string; name: string } }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [requestId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('request_comments')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((c) => c.user_id))];
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', { _ids: userIds });
        setComments(data.map((c) => ({
          ...c,
          profile: profiles?.find((p: { id: string; name: string }) => p.id === c.user_id),
        })));
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('request_comments').insert({
        request_id: requestId,
        user_id: user.id,
        comment: newComment.trim(),
      });

      if (error) throw error;

      sendNotification({
        requestId,
        eventType: 'new_comment',
        title: `Nuevo comentario${requestNumber ? ` en #${String(requestNumber).padStart(6, '0')}` : ''}`,
        message: `${profile?.name || 'Usuario'}: ${newComment.trim().substring(0, 100)}${newComment.trim().length > 100 ? '...' : ''}`,
        triggeredBy: user.id,
      });

      setNewComment('');
      toast.success('Comentario agregado');
      fetchComments();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(`Error al agregar comentario: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Merge comments and history into a single sorted timeline
  const entries: TimelineEntry[] = [
    ...comments.map((c) => ({
      id: c.id,
      type: 'comment' as const,
      created_at: c.created_at,
      userName: c.profile?.name || 'Usuario',
      comment: c.comment,
    })),
    ...history.map((h) => ({
      id: h.id,
      type: 'status' as const,
      created_at: h.created_at,
      userName: h.profile?.name || 'Usuario',
      toStatus: h.to_status as RequestStatus,
      statusComment: h.comment || undefined,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Actividad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New comment input */}
        <div className="flex gap-2 pb-4 border-b">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escriba un comentario de seguimiento..."
            rows={2}
            className="flex-1"
            maxLength={2000}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            size="icon"
            className="self-end"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin actividad registrada</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-0">
              {entries.map((entry) => (
                <div key={entry.id} className="relative flex gap-3 py-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-background',
                      entry.type === 'comment'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {entry.type === 'comment' ? (
                      <MessageCircle className="w-3.5 h-3.5" />
                    ) : (
                      <GitCommitHorizontal className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{entry.userName}</span>
                      {entry.type === 'status' && entry.toStatus && (
                        <StatusBadge status={entry.toStatus} />
                      )}
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>

                    {entry.type === 'comment' && entry.comment && (
                      <div className="mt-1 text-sm bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 whitespace-pre-wrap">
                        {entry.comment}
                      </div>
                    )}

                    {entry.type === 'status' && entry.statusComment && (
                      <p className="mt-1 text-xs text-muted-foreground">{entry.statusComment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
