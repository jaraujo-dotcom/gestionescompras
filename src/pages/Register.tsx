import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp(email, password, name);
      setSuccess(true);
      toast.success('Cuenta creada. Verifique su correo electrónico.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al registrarse';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-status-approved/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-status-approved" />
          </div>
            <h2 className="text-xl font-semibold mb-2">Revise su correo</h2>
            <p className="text-muted-foreground mb-4">
              Hemos enviado un enlace de confirmación a <strong>{email}</strong>
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                Volver al inicio de sesión
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
          <CardDescription>Complete sus datos para registrarse</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Cuenta
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tiene cuenta?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
