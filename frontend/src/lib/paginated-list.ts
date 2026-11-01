export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export async function collectPages<T>(fetchPage: (cursor: string | null) => Promise<CursorPage<T>>): Promise<T[]> {
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error("La paginación del catálogo repitió una página");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
