import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paginated } from '@/lib/usePagination';

/** Footer row for a paginated table card. Renders nothing when everything fits on one page. */
export function Pagination({ p }: { p: Paginated<unknown> }) {
  if (p.total <= p.pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line-2 text-[13px] text-ink-3">
      <span>
        Showing {p.offset + 1}–{p.offset + p.pageItems.length} of {p.total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs">Page {p.page + 1} of {p.pageCount}</span>
        <button
          onClick={() => p.setPage(p.page - 1)}
          disabled={p.page === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn border border-line hover:bg-canvas-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          onClick={() => p.setPage(p.page + 1)}
          disabled={p.page >= p.pageCount - 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn border border-line hover:bg-canvas-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
