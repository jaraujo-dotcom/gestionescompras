import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  requestId: string;
  eventType: 'status_change' | 'new_comment' | 'assignment' | string;
  title: string;
  message: string;
  triggeredBy: string;
  newStatus?: string;
}

/**
 * Fire-and-forget notification sender.
 * Creates in-app notifications and sends emails via edge function.
 */
export function sendNotification(params: NotifyParams): void {
  supabase.functions
    .invoke('send-notification', { body: params })
    .then(({ error }) => {
      if (error) console.error('Notification error:', error);
    })
    .catch((err) => {
      console.error('Failed to send notification:', err);
    });
}
