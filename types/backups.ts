/**
 * Contrato de la API de backups.
 *
 * Este tipo es la UNICA definicion de la forma que viaja entre
 * `GET /api/backups/list` (productor) y `app/backups/page.tsx` (consumidor).
 * Antes cada lado declaraba su propio `interface BackupFile` y divergieron:
 * el productor emitia `downloadUrl` y el consumidor leia `webViewLink`, que
 * nunca existio en la respuesta. TypeScript no podia detectarlo porque los
 * dos tipos eran independientes.
 */
export interface BackupFile {
  id: string;
  name: string;
  /** ISO 8601. Fecha de creacion del objeto en Supabase Storage. */
  createdTime: string;
  /**
   * Tamano YA FORMATEADO para mostrar: '1.5 MB', '900 Bytes'.
   * NO es un recuento de bytes — el productor lo genera con formatBytes() en
   * app/api/backups/list/route.ts. No intentes `Number(size)`: da NaN. Y
   * `parseFloat` es peor todavia, porque ordena '900 Bytes' por encima de
   * '1.5 MB'. Si hiciera falta ordenar o comparar por tamano, hay que emitir
   * ademas un campo numerico en bytes desde la ruta.
   */
  size: string;
  /** URL firmada de descarga. Cadena vacia si la firma fallo. */
  downloadUrl: string;
}
