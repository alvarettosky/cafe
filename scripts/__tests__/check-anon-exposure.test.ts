import { describe, it, expect } from 'vitest';
import { clasificar } from '../check-anon-exposure.mjs';

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
});
