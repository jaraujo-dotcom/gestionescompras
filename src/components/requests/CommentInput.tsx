import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Attachment {
  file: File;
  preview?: string;
}

interface CommentInputProps {
  onSubmit: (comment: string, attachmentPaths: { name: string; path: string; type: string; size: number }[]) => Promise<void>;
  submitting: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain', 'text/csv',
];

export function CommentInput({ onSubmit, submitting }: CommentInputProps) {
  const [comment, setComment] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: Attachment[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} excede el límite de 10MB`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: tipo de archivo no permitido`);
        continue;
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      valid.push({ file, preview });
    }

    setAttachments((prev) => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async (): Promise<{ name: string; path: string; type: string; size: number }[]> => {
    const results: { name: string; path: string; type: string; size: number }[] = [];
    for (const att of attachments) {
      const ext = att.file.name.split('.').pop();
      const filePath = `comments/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('form-attachments').upload(filePath, att.file);
      if (error) throw error;
      results.push({ name: att.file.name, path: filePath, type: att.file.type, size: att.file.size });
    }
    return results;
  };

  const handleSubmit = async () => {
    if ((!comment.trim() && attachments.length === 0)) return;

    setUploading(true);
    try {
      let uploadedFiles: { name: string; path: string; type: string; size: number }[] = [];
      if (attachments.length > 0) {
        uploadedFiles = await uploadFiles();
      }
      await onSubmit(comment.trim(), uploadedFiles);
      setComment('');
      attachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
      setAttachments([]);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const isSubmitting = submitting || uploading;
  const canSubmit = (comment.trim().length > 0 || attachments.length > 0) && !isSubmitting;

  return (
    <div className="space-y-2 pb-4 border-b">
      <div className="flex gap-2">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escriba un comentario de seguimiento..."
          rows={2}
          className="flex-1"
          maxLength={2000}
        />
        <div className="flex flex-col gap-1 self-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || attachments.length >= 5}
            title="Adjuntar archivo"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="icon"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileSelect}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative group flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs max-w-[200px]">
              {att.preview ? (
                <img src={att.preview} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
              ) : (
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{att.file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="shrink-0 ml-auto text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <span className="text-xs text-muted-foreground self-center">{attachments.length}/5</span>
        </div>
      )}
    </div>
  );
}
