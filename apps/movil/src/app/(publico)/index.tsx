import { router } from 'expo-router';
import { Boton, Pantalla, Parrafo, Titulo } from '../../ui/componentes';

export default function Bienvenida() {
  return (
    <Pantalla centrada>
      <Titulo>FoodApp</Titulo>
      <Parrafo>
        Controla tu despensa a partir de tus tickets, registra lo que consumes y recibe recetas que aprovechan lo que
        ya tienes.
      </Parrafo>
      <Boton texto="Crear cuenta" onPress={() => router.push('/registro')} />
      <Boton texto="Iniciar sesión" variante="secundario" onPress={() => router.push('/iniciar-sesion')} />
    </Pantalla>
  );
}
