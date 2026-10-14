export type CursorPage<T> = {
  items: T[];
  next_cursor?: string | null;
  count: number;
  total?: number;
};
