import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { FormField, FormSection, TableColumnSchema, FieldDependency } from '@/types/database';
import { toast } from 'sonner';

function GuestFormFields({
  fields, sections, initialData, onSubmit, submitting,
}: {
  fields: FormField[];
  sections: FormSection[];
  initialData: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  submitting: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialData);

  return (
    <div className="space-y-6">
      <DynamicForm
        fields={fields}
        sections={sections}
        values={values}
        onChange={setValues}
      />
      <Button
        className="w-full"
        onClick={() => onSubmit(values)}
        disabled={submitting}
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
        ) : (
          'Enviar datos'
        )}
      </Button>
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface GuestFormData {
  request: { id: string; title: string; request_number: number };
  fields: any[];
  sections: any[];
  data: Record<string, unknown>;
  guest_name: string | null;
}

export default function GuestForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<GuestFormData | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (token) validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/external-form?token=${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError({ message: data.error, code: data.code });
        return;
      }

      // Parse fields
      const parsedFields: FormField[] = (data.fields || []).map((f: any) => ({
        ...f,
        field_type: f.field_type,
        options_json: f.options_json as string[] | null,
        table_schema_json: f.table_schema_json as unknown as TableColumnSchema[] | null,
        dependency_json: f.dependency_json as unknown as FieldDependency | null,
        section_id: f.section_id || null,
      }));

      setFormData({
        request: data.request,
        fields: parsedFields,
        sections: (data.sections || []) as FormSection[],
        data: data.data || {},
        guest_name: data.guest_name,
      });
    } catch (err) {
      console.error('Error validating token:', err);
      setError({ message: 'Error de conexión. Intente nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/external-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, values }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al enviar los datos');
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting:', err);
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const isExpired = error.code === 'expired';
    const isCompleted = error.code === 'completed';

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            {isExpired ? (
              <Clock className="w-12 h-12 mx-auto text-muted-foreground" />
            ) : isCompleted ? (
              <CheckCircle className="w-12 h-12 mx-auto text-primary" />
            ) : (
              <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
            )}
            <h2 className="text-xl font-semibold">
              {isCompleted ? 'Formulario completado' : isExpired ? 'Enlace expirado' : 'Enlace no válido'}
            </h2>
            <p className="text-muted-foreground">{error.message}</p>
            {isExpired && (
              <p className="text-sm text-muted-foreground">
                Solicite un nuevo enlace al responsable de la solicitud.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">¡Datos enviados exitosamente!</h2>
            <p className="text-muted-foreground">
              Su información ha sido recibida. El responsable de la solicitud será notificado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!formData) return null;

  const reqNum = String(formData.request.request_number).padStart(6, '0');

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="Logo" className="h-10 mx-auto" />
          <h1 className="text-2xl font-bold">Formulario Externo</h1>
          {formData.guest_name && (
            <p className="text-muted-foreground">
              Bienvenido, <span className="font-medium">{formData.guest_name}</span>
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">#{reqNum}</span>
              {formData.request.title}
            </CardTitle>
            <CardDescription>
              Complete los campos solicitados a continuación. Una vez enviados, no podrá modificarlos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestFormFields
              fields={formData.fields as FormField[]}
              sections={formData.sections as FormSection[]}
              initialData={formData.data}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
