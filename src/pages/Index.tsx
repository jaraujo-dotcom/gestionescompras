import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">Sistema de Solicitudes</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Iniciar Sesión
            </Button>
            <Button onClick={() => navigate('/register')}>
              Registrarse
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-6">
              Gestión de Solicitudes de Artículos
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Crea, revisa y ejecuta solicitudes de manera eficiente. 
              Control total del flujo de trabajo con roles personalizados.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/register')}>
                Comenzar Ahora
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Ya tengo cuenta
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Solicitudes Flexibles</h3>
              <p className="text-muted-foreground">
                Crea solicitudes con múltiples artículos y campos personalizables.
              </p>
            </div>
            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Flujo de Aprobación</h3>
              <p className="text-muted-foreground">
                Proceso de revisión con comentarios y seguimiento de estados.
              </p>
            </div>
            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Roles Múltiples</h3>
              <p className="text-muted-foreground">
                Un usuario puede tener varios roles: solicitante, revisor, ejecutor.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Sistema de Solicitudes MVP
        </div>
      </footer>
    </div>
  );
};

export default Index;
