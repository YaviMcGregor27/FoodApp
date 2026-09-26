// Acceso a la despensa en Supabase. Las lecturas van directas a las tablas (protegidas por
// RLS); todas las escrituras de inventario pasan por las funciones de la base de datos.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { cliente } from '../lib/supabase';
import { mensajeError } from '../logica/erroresAuth';
import {
  type FilaLote,
  type FilaMovimiento,
  type FilaProducto,
  type ParametrosAlta,
  type TipoFecha,
  type Ubicacion,
  mensajeErrorDespensa,
  nuevoId,
} from '../logica/despensa';

const COLUMNAS_PRODUCTO = 'id, name, category, unit, default_package_size, portion_size';
const COLUMNAS_LOTE =
  'id, user_product_id, unit, package_count, package_size, initial_quantity, available_quantity, purchased_on, date_value, date_kind, opened_at, location, status, created_at';

export class ErrorDatos extends Error {}

function fallo(error: { message?: string; code?: string; status?: number; name?: string }): ErrorDatos {
  return new ErrorDatos(mensajeErrorDespensa(error) ?? mensajeError(error, 'general') ?? 'Ha ocurrido un error.');
}

export interface DatosDespensa {
  productos: FilaProducto[];
  lotes: FilaLote[];
}

export async function cargarDespensa(): Promise<DatosDespensa> {
  const sb = cliente();
  const [productos, lotes] = await Promise.all([
    sb.from('user_product').select(COLUMNAS_PRODUCTO).order('name'),
    sb.from('pantry_lot').select(COLUMNAS_LOTE).neq('status', 'descartado'),
  ]);
  if (productos.error) throw fallo(productos.error);
  if (lotes.error) throw fallo(lotes.error);
  return { productos: productos.data as FilaProducto[], lotes: lotes.data as FilaLote[] };
}

export interface DatosProducto extends DatosDespensa {
  movimientos: FilaMovimiento[];
}

export async function cargarProducto(id: string): Promise<DatosProducto> {
  const sb = cliente();
  const [producto, lotes] = await Promise.all([
    sb.from('user_product').select(COLUMNAS_PRODUCTO).eq('id', id).maybeSingle(),
    sb.from('pantry_lot').select(COLUMNAS_LOTE).eq('user_product_id', id).order('created_at'),
  ]);
  if (producto.error) throw fallo(producto.error);
  if (!producto.data) throw new ErrorDatos('No se ha encontrado el producto.');
  if (lotes.error) throw fallo(lotes.error);
  const idsLotes = (lotes.data as FilaLote[]).map((l) => l.id);
  let movimientos: FilaMovimiento[] = [];
  if (idsLotes.length > 0) {
    const m = await sb
      .from('inventory_movement')
      .select('id, lot_id, kind, delta, quantity_before, quantity_after, consumption_event_id, reverses_movement_id, reason, created_at')
      .in('lot_id', idsLotes)
      .order('created_at', { ascending: false })
      .limit(200);
    if (m.error) throw fallo(m.error);
    movimientos = m.data as FilaMovimiento[];
  }
  return { productos: [producto.data as FilaProducto], lotes: lotes.data as FilaLote[], movimientos };
}

export async function altaLote(p: ParametrosAlta): Promise<string> {
  const { data, error } = await cliente().rpc('alta_lote', p);
  if (error) throw fallo(error);
  return data as string;
}

export interface ResultadoSalida {
  evento_id: string;
  repetido: boolean;
  movimientos: { lote_id: string; antes: number; despues: number; residuo: boolean }[];
}

export async function registrarSalida(p: {
  productoId: string;
  cantidad: number;
  tipo: 'consumo' | 'desperdicio';
  loteId: string | null;
  consumidor: 'usuario' | 'otros' | 'reparto';
  parteUsuario: number | null;
  motivo: string | null;
  idempotencia: string;
}): Promise<ResultadoSalida> {
  const { data, error } = await cliente().rpc('registrar_salida', {
    p_producto_id: p.productoId,
    p_cantidad: p.cantidad,
    p_idempotencia: p.idempotencia,
    p_tipo: p.tipo,
    p_lote_id: p.loteId,
    p_consumidor: p.consumidor,
    p_parte_usuario: p.parteUsuario,
    p_motivo: p.motivo,
  });
  if (error) throw fallo(error);
  return data as ResultadoSalida;
}

export async function ajustarCantidad(loteId: string, nuevaCantidad: number, motivo: string): Promise<void> {
  const { error } = await cliente().rpc('ajustar_cantidad', {
    p_lote_id: loteId,
    p_nueva_cantidad: nuevaCantidad,
    p_motivo: motivo,
    p_idempotencia: nuevoId(),
  });
  if (error) throw fallo(error);
}

export async function deshacerEvento(eventoId: string): Promise<void> {
  const { error } = await cliente().rpc('deshacer_evento', { p_evento_id: eventoId });
  if (error) throw fallo(error);
}

export async function actualizarLote(
  loteId: string,
  cambios: { location?: Ubicacion; date_kind?: TipoFecha; date_value?: string | null },
): Promise<void> {
  const datos = { ...cambios, ...(cambios.date_value !== undefined ? { date_origin: cambios.date_value ? 'usuario' : null } : {}) };
  const { error } = await cliente().from('pantry_lot').update(datos).eq('id', loteId);
  if (error) throw fallo(error);
}

/** Carga datos cada vez que la pantalla recibe el foco (al volver de otra pantalla, se actualiza). */
export function useCarga<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await cargar());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ha ocurrido un error.');
    } finally {
      setCargando(false);
    }
  }, [cargar]);

  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  return { datos, error, cargando, recargar };
}
