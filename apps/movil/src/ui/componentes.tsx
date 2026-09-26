// Componentes básicos de interfaz. Textos sin emojis; tamaño táctil mínimo de 44 puntos;
// etiquetas accesibles en todos los controles (docs/03-pantallas.md).

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { anchoMaximo, espacio, radio, useColores } from './tema';

export function Pantalla({
  children,
  centrada = false,
  alRefrescar,
  refrescando = false,
}: {
  children: ReactNode;
  centrada?: boolean;
  /** Si se indica, deslizar hacia abajo recarga los datos. */
  alRefrescar?: () => void;
  refrescando?: boolean;
}) {
  const c = useColores();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[estilos.contenido, centrada && estilos.centrada]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            alRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={c.primario} /> : undefined
          }
        >
          <View style={estilos.columna}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  const c = useColores();
  return (
    <Text accessibilityRole="header" style={[estilos.titulo, { color: c.texto }]}>
      {children}
    </Text>
  );
}

export function Parrafo({ children, secundario = false }: { children: ReactNode; secundario?: boolean }) {
  const c = useColores();
  return <Text style={[estilos.parrafo, { color: secundario ? c.textoSecundario : c.texto }]}>{children}</Text>;
}

interface PropsCampo extends TextInputProps {
  etiqueta: string;
  error?: string;
  ayuda?: string;
}

export function Campo({ etiqueta, error, ayuda, ...props }: PropsCampo) {
  const c = useColores();
  return (
    <View style={estilos.campo}>
      <Text style={[estilos.etiqueta, { color: c.texto }]}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        accessibilityHint={error ?? ayuda}
        placeholderTextColor={c.textoSecundario}
        style={[
          estilos.entrada,
          { color: c.texto, backgroundColor: c.superficie, borderColor: error ? c.error : c.borde },
        ]}
        {...props}
      />
      {error ? (
        <Text style={[estilos.textoPequeno, { color: c.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : ayuda ? (
        <Text style={[estilos.textoPequeno, { color: c.textoSecundario }]}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

interface PropsBoton {
  texto: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'enlace';
  cargando?: boolean;
  desactivado?: boolean;
}

export function Boton({ texto, onPress, variante = 'primario', cargando = false, desactivado = false }: PropsBoton) {
  const c = useColores();
  const inactivo = desactivado || cargando;
  const fondo = variante === 'primario' ? c.primario : 'transparent';
  const colorTexto = variante === 'primario' ? c.textoSobrePrimario : c.primario;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        variante === 'enlace' ? estilos.botonEnlace : null,
        {
          backgroundColor: fondo,
          borderColor: variante === 'secundario' ? c.primario : 'transparent',
          opacity: inactivo ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[estilos.textoBoton, { color: colorTexto }, variante === 'enlace' && estilos.textoEnlace]}>
          {texto}
        </Text>
      )}
    </Pressable>
  );
}

interface PropsCasilla {
  marcada: boolean;
  onCambio: (valor: boolean) => void;
  children: ReactNode;
  etiquetaAccesible: string;
  error?: string;
}

export function Casilla({ marcada, onCambio, children, etiquetaAccesible, error }: PropsCasilla) {
  const c = useColores();
  return (
    <View style={estilos.campo}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={etiquetaAccesible}
        accessibilityState={{ checked: marcada }}
        onPress={() => onCambio(!marcada)}
        style={estilos.filaCasilla}
      >
        <View
          style={[
            estilos.caja,
            { borderColor: error ? c.error : c.primario, backgroundColor: marcada ? c.primario : 'transparent' },
          ]}
        >
          {marcada ? <Text style={[estilos.marca, { color: c.textoSobrePrimario }]}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>
      {error ? <Text style={[estilos.textoPequeno, { color: c.error }]}>{error}</Text> : null}
    </View>
  );
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'info' | 'aviso'; children: ReactNode }) {
  const c = useColores();
  const fondo = tipo === 'error' ? c.fondoError : tipo === 'aviso' ? c.fondoAviso : c.fondoInfo;
  const color = tipo === 'error' ? c.error : tipo === 'aviso' ? c.aviso : c.texto;
  return (
    <View
      accessibilityRole={tipo === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[estilos.aviso, { backgroundColor: fondo }]}
    >
      <Text style={[estilos.parrafo, { color, marginBottom: 0 }]}>{children}</Text>
    </View>
  );
}

export function Cargando() {
  const c = useColores();
  return (
    <View style={[estilos.cargando, { backgroundColor: c.fondo }]}>
      <ActivityIndicator size="large" color={c.primario} accessibilityLabel="Cargando" />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, padding: espacio.m, alignItems: 'center' },
  centrada: { justifyContent: 'center' },
  columna: { width: '100%', maxWidth: anchoMaximo },
  titulo: { fontSize: 26, fontWeight: '700', marginBottom: espacio.m },
  parrafo: { fontSize: 16, lineHeight: 23, marginBottom: espacio.m },
  campo: { marginBottom: espacio.m },
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: espacio.xs },
  entrada: { minHeight: 48, borderWidth: 1, borderRadius: radio, paddingHorizontal: espacio.m, fontSize: 16 },
  textoPequeno: { fontSize: 14, marginTop: espacio.xs, lineHeight: 19 },
  boton: {
    minHeight: 48,
    borderRadius: radio,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    marginBottom: espacio.s,
  },
  botonEnlace: { minHeight: 44, borderWidth: 0 },
  textoBoton: { fontSize: 16, fontWeight: '600' },
  textoEnlace: { fontWeight: '500', textDecorationLine: 'underline' },
  filaCasilla: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, minHeight: 44 },
  caja: { width: 24, height: 24, borderWidth: 2, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  marca: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  aviso: { borderRadius: radio, padding: espacio.m, marginBottom: espacio.m },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
