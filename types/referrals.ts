/**
 * Tipos del programa de referidos (voz a voz).
 * Migracion: `022_fase3_crecimiento.sql` (tablas `referrals`,
 * `referral_program_config`).
 *
 * `Referral` y `ReferralStats` estaban declarados dos veces cada uno, y las dos
 * versiones NO son la misma cosa: alimentan pantallas distintas desde fuentes
 * distintas.
 *
 *   admin  -> RPC `get_referral_stats()` para las metricas, y un SELECT sobre
 *             `referrals` con dos joins a `customers` que se aplanan en el
 *             cliente (`r.referrer?.full_name` -> `referrer_name`)
 *   portal -> RPC `get_my_referrals(p_customer_id)`, que devuelve un sobre
 *             `{ referrals, stats }` ya recortado al cliente que consulta
 *
 * `ReferralStats` es el caso mas enganoso de los tres de A12: las dos versiones
 * cuentan lo mismo con nombres de campo COMPLETAMENTE distintos
 * (`total_referrals` vs `total`, `this_month_referrals` vs `this_month`). Bajo
 * un unico nombre `ReferralStats`, leer `stats.total` en el archivo equivocado
 * devuelve `undefined` en tiempo de ejecucion sin un solo error de compilacion.
 *
 * Mismo patron que produjo el bug `5ce639e` (ver `types/backups.ts`).
 */

/**
 * Metricas globales del programa. Las emite la RPC `get_referral_stats()`,
 * que agrega sobre toda la tabla: solo tiene sentido en la vista de admin.
 */
export interface AdminReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_rewards_given: number;
  /** Porcentaje 0-100 de referidos que acabaron en compra. */
  conversion_rate: number;
  this_month_referrals: number;
}

/**
 * Fila de la tabla de admin: un referido de CUALQUIER cliente, con los nombres
 * de ambas partes ya resueltos.
 *
 * No es la fila cruda de `referrals`. El SELECT trae los joins anidados
 * (`referrer: { full_name }`, `referred: { full_name }`) y el componente los
 * aplana antes de guardarlos en el estado.
 */
export interface AdminReferral {
  id: string;
  /** Aplanado de la columna `referrer_code`. */
  code: string;
  status: string;
  /** Aplanado de la columna `referrer_customer_id`. */
  referrer_id: string;
  /** Aplanado de `referrer.full_name`. `'Desconocido'` si el join no resolvio. */
  referrer_name: string;
  referred_phone: string | null;
  /** Aplanado de `referred.full_name`. null mientras el codigo no se haya usado. */
  referred_customer_name: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  /**
   * VALOR de la recompensa en pesos, no un porcentaje.
   *
   * Se llamaban `*_reward_percent` y la tabla los pintaba como `+{n}%`: una
   * recompensa de 5000 pesos se mostraba como «+5000 %». La columna real es
   * `referrer_reward_value`, y `referral_program_config` guarda aparte el
   * tipo (`percentage` | `fixed`). null mientras no se haya asignado.
   */
  referrer_reward_value: number | null;
  referred_reward_value: number | null;
  /** Aplanado de `referrer_reward_claimed`. */
  reward_claimed: boolean;
}

/**
 * Fila CRUDA de `referrals` tal y como la devuelve PostgREST con los dos embeds
 * de `customers`, antes de aplanarla a `AdminReferral`.
 *
 * Existe para que la forma de entrada y la de salida del `.map()` no se
 * declaren en el mismo sitio con nombres implicitos: los joins llegan anidados
 * (`referrer: { full_name } | null`), no como los campos planos
 * `referrer_name` / `referred_customer_name` que consume la tabla.
 */
export interface AdminReferralRow {
  id: string;
  /** Columna `referrer_code`. NO existe una columna `code`. */
  referrer_code: string;
  status: string;
  referrer_customer_id: string;
  referrer: { full_name: string } | null;
  referred: { full_name: string } | null;
  referred_phone: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  /** Valor absoluto de la recompensa, NO un porcentaje. */
  referrer_reward_value: number | null;
  referred_reward_value: number | null;
  referrer_reward_claimed: boolean;
}

/**
 * Un referido tal y como lo ve el cliente que lo genero, dentro del portal.
 *
 * Recortado respecto de `AdminReferral`: el cliente no ve quien es el referidor
 * (es el mismo) ni los datos de la otra parte.
 *
 * ⚠️ `referred_phone` y `reward_value` SON NULLABLES. La primera version de
 * este tipo los declaraba obligatorios con la justificacion de que «la RPC solo
 * devuelve codigos ya aplicados». **Era falso**: `get_my_referrals` filtra solo
 * por `WHERE r.referrer_customer_id = p_customer_id`, sin mirar el estado, asi
 * que devuelve tambien los `pending` — codigos generados y aun sin usar, donde
 * `referred_phone` es NULL y no hay recompensa asignada. Y el enmascarado
 * `LEFT(NULL,3) || '****' || RIGHT(NULL,2)` evalua a NULL, no a `'****'`.
 *
 * El propio codigo ya lo sabia: `app/portal/referidos/page.tsx` tiene la guarda
 * `{referral.referred_phone || 'Sin usar'}`. Solo el tipo no se habia enterado
 * — el mismo defecto que `types/deliveries.ts` documenta y corrige para las
 * zonas de entrega, reintroducido en el archivo hermano del mismo commit.
 */
export interface PortalReferral {
  id: string;
  code: string;
  status: string;
  /** null mientras el codigo no se haya usado (`status = 'pending'`). */
  referred_phone: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  reward_claimed: boolean;
  /** Valor de la recompensa, no un porcentaje. null si aun no se asigno. */
  reward_value: number | null;
}

/**
 * Contador de los referidos de UN cliente.
 *
 * Cuenta lo mismo que `AdminReferralStats` pero con otros nombres de campo y
 * sobre otro universo (un cliente, no toda la tabla). Son tipos distintos a
 * proposito: no intercambiarlos ni «unificarlos».
 */
export interface PortalReferralStats {
  total: number;
  completed: number;
  pending: number;
  this_month: number;
}

/**
 * Sobre completo que devuelve `get_my_referrals(p_customer_id)`.
 * `referrals` llega null cuando el cliente aun no ha generado ninguno.
 */
export interface PortalReferralData {
  referrals: PortalReferral[] | null;
  stats: PortalReferralStats;
}
