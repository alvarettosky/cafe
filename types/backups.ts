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
  /** Tamano en bytes, como string. */
  size: string;
  /** URL firmada de descarga. Cadena vacia si la firma fallo. */
  downloadUrl: string;
}
