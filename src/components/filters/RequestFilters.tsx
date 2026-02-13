import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RequestStatus, STATUS_LABELS } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';

const ALL_STATUSES: RequestStatus[] = [
  'borrador', 'en_revision', 'devuelta', 'aprobada',
  'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'anulada',
];

export interface RequestFilterValues {
  status: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  groupId: string;
  templateId: string;
}

interface Group {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
}

interface RequestFiltersProps {
  filters: RequestFilterValues;
  onChange: (filters: RequestFilterValues) => void;
  userGroupIds?: string[];
}

export const defaultFilters: RequestFilterValues = {
  status: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  groupId: 'all',
  templateId: 'all',
};

export function RequestFilters({ filters, onChange, userGroupIds }: RequestFiltersProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    const [grpRes, tplRes] = await Promise.all([
      supabase.from('groups').select('id, name').order('name'),
      supabase.from('form_templates').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (grpRes.data) setGroups(grpRes.data);
    if (tplRes.data) setTemplates(tplRes.data);
  };

  const update = (partial: Partial<RequestFilterValues>) => {
    onChange({ ...filters, ...partial });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.groupId !== 'all' || filters.templateId !== 'all';

  const displayGroups = userGroupIds && userGroupIds.length > 0
    ? groups.filter(g => userGroupIds.includes(g.id))
    : groups;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {ALL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {displayGroups.length > 0 && (
        <Select value={filters.groupId} onValueChange={(v) => update({ groupId: v })}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grupos</SelectItem>
            {displayGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.templateId} onValueChange={(v) => update({ templateId: v })}>
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue placeholder="Formulario" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 text-sm", filters.dateFrom && "text-foreground")}>
            <CalendarIcon className="w-3 h-3 mr-1" />
            {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yy', { locale: es }) : 'Desde'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateFrom}
            onSelect={(d) => update({ dateFrom: d })}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 text-sm", filters.dateTo && "text-foreground")}>
            <CalendarIcon className="w-3 h-3 mr-1" />
            {filters.dateTo ? format(filters.dateTo, 'dd/MM/yy', { locale: es }) : 'Hasta'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateTo}
            onSelect={(d) => update({ dateTo: d })}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-sm" onClick={() => onChange(defaultFilters)}>
          <X className="w-3 h-3 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}
