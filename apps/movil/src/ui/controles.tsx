import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { espacio, radio, useColores } from './tema';

interface OpcionChip<T extends string> {
  valor: T;
  texto: string;
  desactivada?: boolean;
}

/** Selector de una opción entre varias, con botones tipo «chip». */
export function Chips<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  desplazable = false,
  error,
}: {
  etiqueta?: string;
  opciones: OpcionChip<T>[];
  valor: T | null;
  onCambio: (v: T) => void;
  desplazable?: boolean;
  error?: string;
}) {
  const c = useColores();
  const chips = opciones.map((o) => {
    const activo = o.valor === valor;
    return (
      <Pressable
        key={o.valor}
        accessibilityRole="radio"
        accessibilityLabel={o.texto}
        accessibilityState={{ selected: activo, disabled: o.desactivada }}
        disabled={o.desactivada}
        onPress={() => onCambio(o.valor)}
        style={[
          estilos.chip,
          {
            borderColor: activo ? c.primario : c.borde,
            backgroundColor: activo ? c.primario : c.superficie,
            opacity: o.desactivada ? 0.45 : 1,
          },
        ]}
      >
        <Text style={{ color: activo ? c.textoSobrePrimario : c.texto, fontSize: 15, fontWeight: activo ? '600' : '400' }}>
          {o.texto}
        </Text>
      </Pressable>
    );
  });
  return (
    <View style={{ marginBottom: espacio.m }} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
      {etiqueta ? <Text style={[estilos.etiqueta, { color: c.texto }]}>{etiqueta}</Text> : null}
      {desplazable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila}>
          {chips}
        </ScrollView>
      ) : (
        <View style={[estilos.fila, { flexWrap: 'wrap' }]}>{chips}</View>
      )}
      {error ? <Text style={{ color: c.error, fontSize: 14, marginTop: espacio.xs }}>{error}</Text> : null}
    </View>
  );
}

export function Tarjeta({ children, onPress, etiquetaAccesible }: { children: ReactNode; onPress?: () => void; etiquetaAccesible?: string }) {
  const c = useColores();
  const estilo = [estilos.tarjeta, { backgroundColor: c.superficie, borderColor: c.borde }];
  if (!onPress) return <View style={estilo}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      onPress={onPress}
      style={({ pressed }) => [...estilo, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function Etiqueta({ texto, tipo = 'neutra' }: { texto: string; tipo?: 'neutra' | 'aviso' | 'error' | 'info' }) {
  const c = useColores();
  const fondo = tipo === 'error' ? c.fondoError : tipo === 'aviso' ? c.fondoAviso : tipo === 'info' ? c.fondoInfo : c.fondo;
  const color = tipo === 'error' ? c.error : tipo === 'aviso' ? c.aviso : c.textoSecundario;
  return (
    <View style={[estilos.etiquetaPastilla, { backgroundColor: fondo, borderColor: c.borde }]}>
      <Text style={{ color, fontSize: 13, fontWeight: '500' }}>{texto}</Text>
    </View>
  );
}

export function Subtitulo({ children }: { children: ReactNode }) {
  const c = useColores();
  return (
    <Text accessibilityRole="header" style={{ color: c.texto, fontSize: 19, fontWeight: '700', marginTop: espacio.m, marginBottom: espacio.s }}>
      {children}
    </Text>
  );
}

export function TextoFila({ principal, secundario }: { principal: string; secundario?: string | null }) {
  const c = useColores();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.texto, fontSize: 17, fontWeight: '600' }}>{principal}</Text>
      {secundario ? <Text style={{ color: c.textoSecundario, fontSize: 15, marginTop: 2 }}>{secundario}</Text> : null}
    </View>
  );
}

/** Confirmación con dos botones. En la versión web usa el diálogo del navegador. */
export function confirmar(titulo: string, mensaje: string, textoAceptar: string, textoCancelar = 'Cancelar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${titulo}\n\n${mensaje}`) ?? false);
  }
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: textoCancelar, style: 'cancel', onPress: () => resolver(false) },
      { text: textoAceptar, onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) });
  });
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: espacio.xs },
  fila: { flexDirection: 'row', gap: espacio.s },
  chip: { minHeight: 44, borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center' },
  tarjeta: { borderWidth: 1, borderRadius: radio, padding: espacio.m, marginBottom: espacio.s },
  etiquetaPastilla: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginTop: 6 },
});
