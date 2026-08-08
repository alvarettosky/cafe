import { describe, it, expect } from 'vitest';
import { clasificar, esAlcanzable } from '../check-anon-exposure.mjs';

/**
 * Estos tests fijan el criterio con el que `check-anon-exposure.mjs` decide si
 * un objeto esta expuesto. No son decorativos: cada caso corresponde a una
 * respuesta REAL observada contra produccion el 2026-08-07, el dia que se
 * descubrio que cuatro vistas devolvian datos de clientes a cualquier anonimo.
 *
 * El caso que mas importa es `SONDA_MUERTA`. La primera investigacion uso la
 * clave de `.env.local`, que es una legacy desactivada: TODO devolvia 401 y el
 * resultado se habria leido como "nada expuesto". Si alguien relaja ese caso a
 * `OK`, el verificador vuelve a poder aprobar la base con los ojos cerrados.
 */
describe('check-anon-exposure · clasificacion de respuestas', () => {
  it('una fila devuelta a un anonimo es FUGA', () => {
    expect(clasificar(200, [{ id: 1, full_name: 'x' }])).toBe('FUGA');
  });

  it('200 con lista vacia es el estado bueno', () => {
    expect(clasificar(200, [])).toBe('OK_VACIO');
  });

  it('permission denied (42501) es el estado bueno tras la migracion 030', () => {
    expect(
      clasificar(401, { code: '42501', message: 'permission denied for view customer_segments' })
    ).toBe('OK_SIN_PRIVILEGIO');
  });

  it('una clave legacy desactivada NO cuenta como cerrado', () => {
    expect(clasificar(401, { message: 'Legacy API keys are disabled' })).toBe('SONDA_MUERTA');
  });

  it('una clave invalida tampoco cuenta como cerrado', () => {
    expect(clasificar(401, { message: 'Invalid API key' })).toBe('SONDA_MUERTA');
  });

  it('un 500 es "no pude verlo", que no es "no hay nada"', () => {
    expect(clasificar(500, 'Internal Server Error')).toBe('INDETERMINADO');
  });

  it('una respuesta ilegible no se cuenta como vacia', () => {
    expect(clasificar(200, 'esto no es json')).toBe('INDETERMINADO');
  });

  it('no da falsa alarma: solo un 200 con filas produce FUGA', () => {
    const buenos = [
      [200, []],
      [401, { code: '42501', message: 'permission denied' }],
      [500, 'error'],
      [404, 'not found'],
    ] as const;
    for (const [status, body] of buenos) {
      expect(clasificar(status, body)).not.toBe('FUGA');
    }
  });

  it('acepta el cuerpo como string sin cambiar el veredicto', () => {
    expect(clasificar(200, JSON.stringify([{ n: 1 }]))).toBe('FUGA');
    expect(clasificar(200, '[]')).toBe('OK_VACIO');
  });

  /**
   * El codigo de estado se mira ANTES que el texto. Una clave muerta nunca
   * devuelve 200, asi que un 200 con filas es siempre FUGA — aunque una de
   * esas filas contenga por casualidad la frase que identifica a una clave
   * invalida. `customers.notes` y `inventory_movements.reason` son texto libre
   * que escribe una persona: basta una nota de soporte para que la fuga se
   * disfrazara de sonda muerta y el objeto no apareciera en la lista.
   */
  describe('el status manda sobre el texto del cuerpo', () => {
    it('una fuga cuyo contenido menciona "Invalid API key" sigue siendo fuga', () => {
      expect(
        clasificar(200, [{ id: 1, notes: 'el cliente reporta Invalid API key al entrar' }])
      ).toBe('FUGA');
    });

    it('una fuga cuyo contenido menciona la clave legacy sigue siendo fuga', () => {
      expect(
        clasificar(200, [
          { id: 2, reason: 'Legacy API keys are disabled, se rehizo el movimiento' },
        ])
      ).toBe('FUGA');
    });
  });

  /**
   * `esAlcanzable` sostiene el control positivo. Tiene que contar los 200
   * CON filas: si solo contara los vacios, un colapso total del RLS —todo
   * devuelve filas— daria cero alcanzados y el gate lo reportaria como clave
   * muerta, mandando a rotar credenciales con la base abierta de par en par.
   */
  describe('esAlcanzable · qué prueba que la sonda llegó a la base', () => {
    it('cuenta los 200, con y sin filas', () => {
      expect(esAlcanzable('OK_VACIO')).toBe(true);
      expect(esAlcanzable('FUGA')).toBe(true);
    });

    it('no cuenta una clave muerta ni una respuesta ilegible', () => {
      expect(esAlcanzable('SONDA_MUERTA')).toBe(false);
      expect(esAlcanzable('INDETERMINADO')).toBe(false);
    });
  });
});
