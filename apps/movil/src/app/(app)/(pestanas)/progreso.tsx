import { ADVERTENCIA_GENERAL } from '@foodapp/dominio';
import { Parrafo } from '../../../ui/componentes';
import { SeccionPendiente } from '../../../ui/SeccionPendiente';

export default function Progreso() {
  return (
    <SeccionPendiente
      titulo="Progreso"
      descripcion="Evolución de tu peso con una tendencia suavizada, ritmo semanal e ingesta media frente a tu objetivo."
      fase="F6"
    >
      <Parrafo secundario>{ADVERTENCIA_GENERAL}</Parrafo>
    </SeccionPendiente>
  );
}
