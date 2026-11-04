import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Pagination({
  total,
  pageSize,
  page,
  onPageChange,
}: {
  total: number;
  pageSize: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function usePagination(pageSize: number) {
  const [page, setPage] = useState(1);
  const slice = <T,>(items: T[]) => items.slice((page - 1) * pageSize, page * pageSize);
  return { page, setPage, slice, pageSize };
}
