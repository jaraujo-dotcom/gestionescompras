import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Profile } from '@/types/database';
import { MessageSquare, Send, Loader2, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import { sendNotification } from '@/lib/notifications';

interface Comment {
  id: string;
  request_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profile?: { id: string; name: string };
}

interface RequestCommentsProps {
  requestId: string;
  requestNumber?: number;
}

export function RequestComments({ requestId, requestNumber }: RequestCommentsProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
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
        const commentsWithProfiles = data.map((c) => ({
          ...c,
          profile: profiles?.find((p: { id: string; name: string }) => p.id === c.user_id),
        }));
        setComments(commentsWithProfiles);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Seguimiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Sin comentarios de seguimiento</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 pb-3 border-b last:border-0">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{c.profile?.name || 'Usuario'}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(c.created_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New comment input */}
        <div className="flex gap-2 pt-2 border-t">
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
      </CardContent>
    </Card>
  );
}
