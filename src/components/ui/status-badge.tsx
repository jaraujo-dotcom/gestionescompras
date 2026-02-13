import { cn } from '@/lib/utils';
import { RequestStatus, STATUS_LABELS } from '@/types/database';
import {
  FileEdit,
  Eye,
  RotateCcw,
  CheckCircle,
  PlayCircle,
  CheckCheck,
  XCircle,
  Ban,
  PauseCircle,
} from 'lucide-react';

const statusIcons: Record<RequestStatus, React.ElementType> = {
  borrador: FileEdit,
  en_revision: Eye,
  devuelta: RotateCcw,
  aprobada: CheckCircle,
  en_ejecucion: PlayCircle,
  en_espera: PauseCircle,
  completada: CheckCheck,
  rechazada: XCircle,
  anulada: Ban,
};

interface StatusBadgeProps {
  status: RequestStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({ status, showLabel = true, className }: StatusBadgeProps) {
  const Icon = statusIcons[status];

  return (
    <span className={cn('status-badge', `status-${status}`, className)}>
      <Icon className="w-3.5 h-3.5" />
      {showLabel && <span>{STATUS_LABELS[status]}</span>}
    </span>
  );
}
