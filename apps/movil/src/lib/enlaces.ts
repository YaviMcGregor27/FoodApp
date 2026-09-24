// Direcciones a las que vuelven los enlaces de los correos de Supabase. Deben figurar en la
// lista de URL de redirección permitidas del proyecto (Authentication > URL Configuration).

import * as Linking from 'expo-linking';

export const enlaceConfirmacion = () => Linking.createURL('/confirmar');
export const enlaceNuevaContrasena = () => Linking.createURL('/nueva-contrasena');
