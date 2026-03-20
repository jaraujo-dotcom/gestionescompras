import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { RequestStatus } from '@/types/database';
import { Loader2, Clock, GitCommitHorizontal, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sendNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { CommentInput } from './CommentInput';
import { CommentAttachments } from './CommentAttachments';

interface TimelineEntry {
  id: string;
  type: 'comment' | 'status';
  created_at: string;
  userName: string;
  comment?: string;
  attachments?: { name: string; path: string; type: string; size: number }[];
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
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleSubmitComment = async (comment: string, attachmentPaths: { name: string; path: string; type: string; size: number }[]) => {
    if (!user) return;

    const { error } = await supabase.from('request_comments').insert({
      request_id: requestId,
      user_id: user.id,
      comment: comment || '📎 Archivos adjuntos',
      attachments_json: attachmentPaths.length > 0 ? attachmentPaths : undefined,
    } as any);

    if (error) throw error;

    sendNotification({
      requestId,
      eventType: 'new_comment',
      title: `Nuevo comentario${requestNumber ? ` en #${String(requestNumber).padStart(6, '0')}` : ''}`,
      message: `${profile?.name || 'Usuario'}: ${(comment || '📎 Archivos adjuntos').substring(0, 100)}`,
      triggeredBy: user.id,
    });

    toast.success('Comentario agregado');
    fetchComments();
  };

  const entries: TimelineEntry[] = [
    ...comments.map((c) => ({
      id: c.id,
      type: 'comment' as const,
      created_at: c.created_at,
      userName: c.profile?.name || 'Usuario',
      comment: c.comment,
      attachments: Array.isArray(c.attachments_json) ? c.attachments_json : [],
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
        <CommentInput onSubmit={handleSubmitComment} submitting={false} />

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin actividad registrada</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-0">
              {entries.map((entry) => (
                <div key={entry.id} className="relative flex gap-3 py-3">
                  <div
                    className={cn(
                      'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-background',
                      entry.type === 'comment' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {entry.type === 'comment' ? (
                      <MessageCircle className="w-3.5 h-3.5" />
                    ) : (
                      <GitCommitHorizontal className="w-3.5 h-3.5" />
                    )}
                  </div>

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

                    {entry.type === 'comment' && entry.attachments && entry.attachments.length > 0 && (
                      <CommentAttachments attachments={entry.attachments} />
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
