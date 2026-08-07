import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSignedUrl } from '@/lib/media'

type ProductThumbSize = 'row' | 'detail'

interface ProductThumbProps {
  /** Dual-mode `products.image_url` value: external URL or crew-media path. */
  imageUrl: string | null | undefined
  /** Product name; its first letter is the fallback glyph. */
  name: string
  size?: ProductThumbSize
  className?: string
}

const sizeClass: Record<ProductThumbSize, string> = {
  row: 'size-12 rounded-lg',
  detail: 'size-16 rounded-xl',
}

/**
 * Square product thumbnail with the letter fallback used across the
 * inventory surfaces. Resolves dual-mode image values internally via
 * useSignedUrl, so callers pass `image_url` straight through; while a
 * signed URL is loading (or on any failure) the letter renders instead.
 */
export function ProductThumb({
  imageUrl,
  name,
  size = 'row',
  className,
}: ProductThumbProps) {
  const url = useSignedUrl(imageUrl)
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const showImage = url !== null && url !== erroredUrl

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-paper-50',
        sizeClass[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => setErroredUrl(url)}
        />
      ) : (
        <span className="font-display text-base font-bold text-ink-500">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  )
}
