import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

export default function AuditMasters() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditar Maestros</h1>
        <p className="text-muted-foreground">Auditoría y validación de datos maestros</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Auditoría de Datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Funcionalidad de auditoría en desarrollo...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
