import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  user_id: string;
  request_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      setNotifications((data as Notification[]) || []);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('Todas marcadas como leídas');
  };

  const deleteAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
    toast.success('Notificaciones eliminadas');
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.request_id) {
      navigate(`/requests/${notification.request_id}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'new_comment':
        return <MessageSquare className="w-5 h-5 text-primary" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas al día'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1" /> Marcar todas
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={deleteAll}>
              <Trash2 className="w-4 h-4 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin notificaciones</h3>
            <p className="text-muted-foreground text-center">
              Las notificaciones de solicitudes aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors flex gap-4',
                  !n.is_read && 'bg-primary/5'
                )}
              >
                <div className="mt-0.5 shrink-0">{getTypeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !n.is_read && 'font-semibold')}>
                    {n.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">
                    {n.message.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
