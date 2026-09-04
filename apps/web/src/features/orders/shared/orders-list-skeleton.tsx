/** Canvas `LoadingRows`: five skeleton list rows, no live data. */
export function OrdersListSkeleton({ label }: { readonly label: string }) {
  return (
    <div role="status" aria-label={label} aria-live="polite" className="flex-1">
      <ul className="space-y-1 px-3 pb-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <li
            key={row}
            className="flex items-start gap-3 rounded-field px-3 py-3.5"
          >
            <span className="min-w-0 flex-1">
              <span
                aria-hidden
                className="block h-2.5 w-[60%] rounded-full bg-line"
              />
              <span
                aria-hidden
                className="mt-2 block h-2 w-[40%] rounded-full bg-line"
              />
            </span>
            <span className="flex shrink-0 flex-col items-end gap-2">
              <span aria-hidden className="h-4 w-16 rounded-full bg-line" />
              <span aria-hidden className="h-2.5 w-12 rounded-full bg-line" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
