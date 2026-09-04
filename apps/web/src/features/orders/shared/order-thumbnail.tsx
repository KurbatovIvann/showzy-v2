/**
 * 44×44 signed thumbnail from a parent-batched `files.getDownloadUrls`
 * query. Copied from mobile `OrderThumbnail` intent — orders must not
 * import a catalog feature. `fileId: null` or a missing URL renders a
 * package placeholder without a request. A download-query failure is a
 * distinct `failed` path. The URL is never persisted.
 */
import { ImageOff, Package } from "lucide-react";

export function OrderThumbnail(props: {
  readonly fileId: string | null;
  readonly url: string | null;
  readonly failed: boolean;
  readonly failedLabel: string;
}) {
  const url = props.url;
  const failed = props.failed;

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas"
      aria-label={failed ? props.failedLabel : undefined}
    >
      {failed ? (
        <ImageOff size={16} className="text-muted" aria-hidden />
      ) : url === null ? (
        <Package size={16} className="text-muted" aria-hidden />
      ) : (
        <img
          src={url}
          alt=""
          data-file-id={props.fileId ?? undefined}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}
