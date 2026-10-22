import { useEffect, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 25;

export interface Paginated<T> {
  pageItems: T[];
  /** Index of the first item on the current page — add to a row index for its overall rank. */
  offset: number;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
}

/**
 * Client-side pagination over an already-loaded list. Jumps back to the first
 * page whenever `resetKey` changes (e.g. a filter or time range), and clamps
 * the page when the list shrinks underneath it.
 */
export function usePagination<T>(items: T[], resetKey?: unknown, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const offset = current * pageSize;
  return {
    pageItems: items.slice(offset, offset + pageSize),
    offset,
    page: current,
    pageCount,
    pageSize,
    total: items.length,
    setPage,
  };
}
