import { SeccionPendiente } from '../../../ui/SeccionPendiente';

export default function Escanear() {
  return (
    <SeccionPendiente
      titulo="Escanear ticket"
      descripcion="Fotografía un ticket de compra, revisa lo que hemos leído y confirma qué añadir a la despensa. Nada se añade sin tu confirmación."
      fase="F3"
    />
  );
}
