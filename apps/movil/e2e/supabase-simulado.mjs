// Supabase simulado para la prueba de extremo a extremo: autenticación, estado de la cuenta y
// las tablas y funciones de la despensa, en memoria. Imita el comportamiento de las funciones
// de supabase/migrations lo justo para recorrer los flujos de la app; las reglas reales se
// prueban contra PostgreSQL en supabase/pruebas.

import { randomUUID } from 'node:crypto';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function crearSimulador() {
  const ahora = Math.floor(Date.now() / 1000);
  const usuario = {
    id: '00000000-0000-0000-0000-00000000000a',
    email: 'persona@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, role: 'authenticated', aud: 'authenticated', exp: ahora + 3600, iat: ahora, email: usuario.email, session_id: 's1' })}.firma`;
  const sesion = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: 'r1', user: usuario };

  const estado = { registroCompleto: true, productos: [], lotes: [], movimientos: [], eventos: [] };
  const marca = () => new Date(Date.now() + estado.movimientos.length).toISOString();

  function movimiento(lote, kind, delta, eventoId, extra = {}) {
    const antes = lote.available_quantity;
    const despues = Math.round((antes + delta) * 1000) / 1000;
    lote.available_quantity = despues;
    if (despues === 0) lote.status = 'agotado';
    else if (lote.status === 'agotado') lote.status = lote.opened_at ? 'abierto' : 'disponible';
    else if (kind === 'consumo_parcial' && lote.status === 'disponible') lote.status = 'abierto';
    if (kind.startsWith('consumo') && !lote.opened_at) lote.opened_at = new Date().toISOString();
    const m = {
      id: randomUUID(), lot_id: lote.id, kind, delta, quantity_before: antes, quantity_after: despues,
      consumption_event_id: eventoId, reverses_movement_id: null, reason: null, created_at: marca(), ...extra,
    };
    estado.movimientos.push(m);
    return m;
  }

  const rpc = {
    alta_lote(p) {
      let producto = p.p_producto_id
        ? estado.productos.find((x) => x.id === p.p_producto_id)
        : estado.productos.find((x) => x.name.toLowerCase() === p.p_nombre.toLowerCase() && x.unit === p.p_unidad);
      if (!producto) {
        producto = { id: randomUUID(), name: p.p_nombre, category: p.p_categoria, unit: p.p_unidad, default_package_size: p.p_tamano_envase, portion_size: p.p_porcion };
        estado.productos.push(producto);
      } else if (p.p_porcion !== null) {
        producto.portion_size = p.p_porcion;
      }
      const inicial = p.p_tamano_envase !== null ? p.p_tamano_envase * p.p_envases : p.p_cantidad;
      const lote = {
        id: randomUUID(), user_product_id: producto.id, unit: p.p_unidad,
        package_count: p.p_tamano_envase !== null ? p.p_envases : 1, package_size: p.p_tamano_envase,
        initial_quantity: inicial, available_quantity: 0, purchased_on: p.p_fecha_compra,
        date_value: p.p_fecha, date_kind: p.p_tipo_fecha, opened_at: p.p_abierto ? new Date().toISOString() : null,
        location: p.p_ubicacion, status: p.p_abierto ? 'abierto' : 'disponible', created_at: new Date().toISOString(),
      };
      estado.lotes.push(lote);
      movimiento(lote, 'entrada_manual', inicial, null);
      return [200, lote.id];
    },
    registrar_salida(p) {
      const repetido = estado.eventos.find((e) => e.idempotencia === p.p_idempotencia);
      if (repetido) return [200, { evento_id: repetido.id, repetido: true, movimientos: [] }];
      const lotes = estado.lotes
        .filter((l) => l.user_product_id === p.p_producto_id && ['disponible', 'abierto'].includes(l.status) && l.available_quantity > 0)
        .filter((l) => !p.p_lote_id || l.id === p.p_lote_id)
        .sort((a, b) =>
          Number(Boolean(b.opened_at)) - Number(Boolean(a.opened_at)) ||
          (a.date_value ?? '9999').localeCompare(b.date_value ?? '9999') ||
          a.purchased_on.localeCompare(b.purchased_on));
      const total = lotes.reduce((s, l) => s + l.available_quantity, 0);
      if (p.p_cantidad > total) return [400, { code: 'P0001', message: 'CONSUMO_SUPERA_DISPONIBLE', details: String(total) }];
      const evento = { id: randomUUID(), idempotencia: p.p_idempotencia, kind: p.p_tipo === 'desperdicio' ? 'desperdicio' : 'individual' };
      estado.eventos.push(evento);
      let pendiente = p.p_cantidad;
      const resultado = [];
      for (const l of lotes) {
        if (pendiente <= 0) break;
        const parte = Math.min(pendiente, l.available_quantity);
        const antes = l.available_quantity;
        const kind = p.p_tipo === 'desperdicio' ? 'desperdicio' : antes - parte === 0 ? 'consumo_total' : 'consumo_parcial';
        const m = movimiento(l, kind, -parte, evento.id, { reason: p.p_motivo });
        const referencia = l.package_size ?? l.initial_quantity;
        resultado.push({ lote_id: l.id, antes, despues: m.quantity_after, residuo: m.quantity_after > 0 && m.quantity_after < referencia * 0.02 });
        pendiente -= parte;
      }
      return [200, { evento_id: evento.id, repetido: false, movimientos: resultado }];
    },
    ajustar_cantidad(p) {
      const lote = estado.lotes.find((l) => l.id === p.p_lote_id);
      if (!lote) return [400, { code: 'P0001', message: 'LOTE_NO_ENCONTRADO' }];
      if (lote.available_quantity === p.p_nueva_cantidad) return [400, { code: 'P0001', message: 'SIN_CAMBIOS' }];
      const evento = { id: randomUUID(), idempotencia: p.p_idempotencia, kind: 'ajuste' };
      estado.eventos.push(evento);
      movimiento(lote, 'ajuste', p.p_nueva_cantidad - lote.available_quantity, evento.id, { reason: p.p_motivo });
      return [200, { evento_id: evento.id, repetido: false }];
    },
    deshacer_evento(p) {
      const originales = estado.movimientos.filter((m) => m.consumption_event_id === p.p_evento_id);
      if (originales.some((o) => estado.movimientos.some((m) => m.reverses_movement_id === o.id))) {
        return [400, { code: 'P0001', message: 'YA_DESHECHO' }];
      }
      for (const o of originales) {
        movimiento(estado.lotes.find((l) => l.id === o.lot_id), 'correccion', -o.delta, null, { reverses_movement_id: o.id, reason: 'deshacer' });
      }
      return [200, { movimientos_corregidos: originales.length }];
    },
  };

  // Filtros de PostgREST usados por la app: eq, neq, in.
  function filtrar(filas, parametros) {
    let r = filas;
    for (const [clave, valor] of parametros) {
      if (['select', 'order', 'limit'].includes(clave)) continue;
      const [op, ...resto] = valor.split('.');
      const v = resto.join('.');
      if (op === 'eq') r = r.filter((f) => String(f[clave]) === v);
      if (op === 'neq') r = r.filter((f) => String(f[clave]) !== v);
      if (op === 'in') {
        const lista = v.replace(/^\(|\)$/g, '').split(',');
        r = r.filter((f) => lista.includes(String(f[clave])));
      }
    }
    return r;
  }

  async function manejar(ruta) {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    const json = (status, cuerpo) => ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });
    const unico = (peticion.headers()['accept'] ?? '').includes('vnd.pgrst.object');

    if (url.pathname === '/auth/v1/token') {
      const datos = peticion.postDataJSON();
      if (datos.password !== 'clave-correcta-123') {
        return json(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return json(200, sesion);
    }
    if (url.pathname === '/auth/v1/logout') return ruta.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user') return json(200, usuario);

    if (url.pathname === '/rest/v1/rpc/estado_cuenta') {
      const fila = { registro_completo: estado.registroCompleto, correo_verificado: true, consentimiento_datos_salud: false };
      return json(200, unico ? fila : [fila]);
    }
    const funcion = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    if (funcion && rpc[funcion]) {
      const [status, cuerpo] = rpc[funcion](peticion.postDataJSON() ?? {});
      return json(status, cuerpo);
    }

    const tabla = url.pathname.match(/^\/rest\/v1\/(\w+)$/)?.[1];
    const fuentes = { user_product: estado.productos, pantry_lot: estado.lotes, inventory_movement: estado.movimientos };
    if (tabla && fuentes[tabla]) {
      const filas = filtrar(fuentes[tabla], url.searchParams);
      if (peticion.method() === 'PATCH') {
        Object.assign(filas[0] ?? {}, peticion.postDataJSON());
        return ruta.fulfill({ status: 204 });
      }
      const orden = url.searchParams.get('order');
      const ordenadas = [...filas];
      if (orden) {
        const [col, dir] = orden.split('.');
        ordenadas.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1));
      }
      return json(200, unico ? ordenadas[0] ?? null : ordenadas);
    }
    return json(404, {});
  }

  return { estado, manejar };
}
