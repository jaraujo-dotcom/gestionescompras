import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileBarChart } from 'lucide-react';

export default function AuditReports() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes de Auditoría</h1>
        <p className="text-muted-foreground">Historial y reportes de auditorías realizadas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5" />
            Reportes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Reportes de auditoría en desarrollo...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
