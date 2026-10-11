// Read-only work: always clear the timer and observe late rejection. Mutations
// must keep their own uncertain-outcome handling instead of using this helper.
export async function withReadTimeout<T>(work: PromiseLike<T>, milliseconds = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Read timed out")), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
