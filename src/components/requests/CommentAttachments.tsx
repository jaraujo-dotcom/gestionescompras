import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface AttachmentMeta {
  name: string;
  path: string;
  type: string;
  size: number;
}

export function CommentAttachments({ attachments }: { attachments: AttachmentMeta[] }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!attachments?.length) return;
    const paths = attachments.map((a) => a.path);
    supabase.storage
      .from('form-attachments')
      .createSignedUrls(paths, 14400) // 4 hours
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((item) => {
            if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
          });
          setSignedUrls(map);
        }
      });
  }, [attachments]);

  if (!attachments?.length) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att, i) => {
        const url = signedUrls[att.path];
        const isImage = att.type?.startsWith('image/');

        if (isImage && url) {
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={url}
                alt={att.name}
                className="max-w-[200px] max-h-[150px] rounded-md border object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          );
        }

        return (
          <a
            key={i}
            href={url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-muted/50 border rounded-md px-3 py-2 text-xs hover:bg-muted transition-colors max-w-[220px]"
          >
            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{att.name}</p>
              <p className="text-muted-foreground">{formatSize(att.size)}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
