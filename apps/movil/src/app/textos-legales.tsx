import { Stack, useLocalSearchParams } from 'expo-router';
import { TEXTOS_LEGALES, type TipoTexto } from '../logica/legal';
import { Aviso, Pantalla, Parrafo } from '../ui/componentes';

export default function TextosLegales() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const clave: TipoTexto = tipo === 'datos_salud' ? 'datos_salud' : 'terminos';
  const texto = TEXTOS_LEGALES[clave];
  const [aviso, ...parrafos] = texto.parrafos;
  return (
    <Pantalla>
      <Stack.Screen options={{ title: texto.titulo }} />
      <Aviso tipo="aviso">{aviso}</Aviso>
      {parrafos.map((p) => (
        <Parrafo key={p}>{p}</Parrafo>
      ))}
      <Parrafo secundario>Versión {texto.version}</Parrafo>
    </Pantalla>
  );
}
