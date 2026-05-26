export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E extends Error>(error: E): Result<never, E> => ({ ok: false, error });

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}

export function mapResult<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

export async function tryAsync<T>(
  fn: () => Promise<T>,
  onError: (e: unknown) => Error,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(onError(e));
  }
}
