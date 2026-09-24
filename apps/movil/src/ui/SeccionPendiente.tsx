import type { ReactNode } from 'react';
import { Aviso, Pantalla, Parrafo, Titulo } from './componentes';

interface Props {
  titulo: string;
  descripcion: string;
  fase: string;
  children?: ReactNode;
}

// Marcador honesto para secciones que todavía no están construidas.
export function SeccionPendiente({ titulo, descripcion, fase, children }: Props) {
  return (
    <Pantalla>
      <Titulo>{titulo}</Titulo>
      <Parrafo>{descripcion}</Parrafo>
      <Aviso tipo="info">{`Esta sección todavía no está disponible. Se construirá en la fase ${fase} del desarrollo.`}</Aviso>
      {children}
    </Pantalla>
  );
}
