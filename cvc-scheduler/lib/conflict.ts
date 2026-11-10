/** PT409 is a business conflict, not a retryable serialization failure.
 * Keep 40001 support during the rolling application/database transition.
 */
export function isConflictCode(code: unknown): boolean {
  return code === "PT409" || code === "40001";
}
