// Almacenamiento de la sesión en iOS y Android.
//
// El almacén seguro del sistema (Keychain / Keystore) limita el tamaño de cada valor, y la
// sesión de Supabase puede superarlo. Por eso la sesión se cifra con AES-256 usando una clave
// aleatoria nueva en cada escritura: la clave se guarda en el almacén seguro y el contenido
// cifrado en AsyncStorage. Es el patrón que recomienda Supabase para Expo.

import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

async function cifrar(clave: string, valor: string): Promise<string> {
  const claveCifrado = crypto.getRandomValues(new Uint8Array(256 / 8));
  const cifrador = new aesjs.ModeOfOperation.ctr(claveCifrado, new aesjs.Counter(1));
  const bytes = cifrador.encrypt(aesjs.utils.utf8.toBytes(valor));
  await SecureStore.setItemAsync(clave, aesjs.utils.hex.fromBytes(claveCifrado));
  return aesjs.utils.hex.fromBytes(bytes);
}

async function descifrar(clave: string, valor: string): Promise<string | null> {
  const claveHex = await SecureStore.getItemAsync(clave);
  if (!claveHex) return null;
  const descifrador = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(claveHex), new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(descifrador.decrypt(aesjs.utils.hex.toBytes(valor)));
}

export const almacenamientoSesion = {
  async getItem(clave: string): Promise<string | null> {
    const cifrado = await AsyncStorage.getItem(clave);
    if (!cifrado) return null;
    return descifrar(clave, cifrado);
  },
  async setItem(clave: string, valor: string): Promise<void> {
    const cifrado = await cifrar(clave, valor);
    await AsyncStorage.setItem(clave, cifrado);
  },
  async removeItem(clave: string): Promise<void> {
    await AsyncStorage.removeItem(clave);
    await SecureStore.deleteItemAsync(clave);
  },
};
