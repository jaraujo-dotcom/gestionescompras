import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export function Logo({ className, iconClassName }: LogoProps) {
  // TODO: Reemplaza el contenido de este return cuando tengas tu propia imagen
  // Ejemplo:
  // return (
  //   <div className={cn('flex items-center justify-center', className)}>
  //     <img 
  //       src="/logo.png" 
  //       alt="Logo de la Aplicación" 
  //       className={cn('w-full h-full object-contain', iconClassName)} 
  //     />
  //   </div>
  // );

 return (
  <div className={cn('flex items-center justify-center', className)}>
    <img 
      src="/logo.png" 
      alt="Logo" 
      className={cn('w-full h-full object-contain', iconClassName)} 
    />
  </div>
);

}
