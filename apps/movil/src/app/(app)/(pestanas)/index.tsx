import { useSesion } from '../../../sesion/ProveedorSesion';
import { Aviso } from '../../../ui/componentes';
import { SeccionPendiente } from '../../../ui/SeccionPendiente';

export default function Hoy() {
  const { cuenta } = useSesion();
  return (
    <SeccionPendiente
      titulo="Hoy"
      descripcion="Resumen del día: energía y macronutrientes frente a tu objetivo, productos que caducan pronto y tickets pendientes de revisar."
      fase="F4"
    >
      {cuenta && !cuenta.consentimientoDatosSalud ? (
        <Aviso tipo="aviso">
          No has dado el consentimiento para datos de salud. Podrás usar la despensa y las recetas; el perfil corporal y
          el seguimiento de peso necesitarán ese consentimiento.
        </Aviso>
      ) : null}
    </SeccionPendiente>
  );
}
