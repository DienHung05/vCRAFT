'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { ApiError, type StudioClient } from '@vcraft/api-client';
import { MAX_PRODUCT_IMAGES, type ProductDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { UploadList } from '@/features/media/upload-list';
import { type UploadItem, UploadQueue } from '@/features/media/upload-queue';
import { browserAccessToken } from '@/lib/api/live-session';
import { notify } from '@/lib/notify';
import { inputClass } from './workshop-editor';

type Photo = ProductDto['images'][number];

function SortablePhoto({
  photo,
  index,
  onAlt,
  onRemove,
}: {
  photo: Photo;
  index: number;
  onAlt: (alt: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('studio.products');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: photo.mediaId,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className="flex flex-col gap-2 rounded-card bg-surface p-2 ring-1 ring-ink/8"
    >
      <button
        type="button"
        aria-label={t('moveHandle', { n: index + 1 })}
        className="relative block aspect-square cursor-grab touch-none overflow-hidden rounded-input bg-ink/8"
        {...attributes}
        {...listeners}
      >
        {photo.url ? (
          // biome-ignore lint/performance/noImgElement: URL của kho media đã là bản tối ưu.
          <img src={photo.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center p-1 text-[0.7rem] text-ash">
            {t('processing')}
          </span>
        )}
      </button>
      <input
        aria-label={t('alt')}
        placeholder={t('alt')}
        value={photo.alt}
        onChange={(event) => onAlt(event.target.value)}
        className={inputClass}
      />
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        {t('remove')}
      </Button>
    </li>
  );
}

/**
 * Ảnh sản phẩm (FR-PRD-02, FR-MEDIA-01, 02): tối đa 12 ảnh, tải 4 luồng song song có tiến độ, hủy và
 * thử lại từng ảnh; kéo để đổi thứ tự, dùng được cả bằng bàn phím.
 */
export function ProductPhotos({
  product,
  client,
  onSaved,
}: {
  product: ProductDto;
  client: StudioClient;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('studio.products');
  const common = useTranslations('studio');
  const media = useTranslations('media');
  const [photos, setPhotos] = useState(product.images);
  const [uploads, setUploads] = useState<readonly UploadItem<string>[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [state, setState] = useState<'idle' | 'saving' | 'failed' | 'stale'>('idle');
  const seen = useRef(new Set<string>());
  const queue = useRef<UploadQueue<string> | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    for (const item of uploads) {
      if (item.status === 'done' && item.result && !seen.current.has(item.id)) {
        seen.current.add(item.id);
        const mediaId = item.result;
        // Server chống trùng theo SHA-256: tải lại đúng ảnh cũ trả về cùng id.
        setPhotos((current) =>
          current.some((photo) => photo.mediaId === mediaId)
            ? current
            : [...current, { mediaId, url: null, variants: [], alt: product.name }],
        );
      }
    }
  }, [uploads, product.name]);

  const getQueue = () => {
    queue.current ??= new UploadQueue<string>(
      {
        prepare: prepareImage,
        send: async (file, onProgress, signal) => {
          const getToken = browserAccessToken() ?? (async () => null);
          return (await sendMedia(file, 'PRODUCT', getToken, onProgress, signal)).id;
        },
      },
      setUploads,
      MAX_PRODUCT_IMAGES,
    );
    return queue.current;
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setPhotos((current) =>
      arrayMove(
        current,
        current.findIndex((p) => p.mediaId === active.id),
        current.findIndex((p) => p.mediaId === over.id),
      ),
    );
  };

  const valid = photos.every((photo) => photo.alt.trim().length >= 3);
  const save = async () => {
    setState('saving');
    try {
      await client.updateProduct(product.id, product.version, {
        images: photos.map(({ mediaId, alt }) => ({ mediaId, alt })),
      });
      await onSaved();
      setState('idle');
      notify.success(common('saved'));
    } catch (error) {
      setState(error instanceof ApiError && error.status === 409 ? 'stale' : 'failed');
      if (error instanceof ApiError && error.status === 409) await onSaved();
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('photos')}</h2>
      <p className="text-small text-ash">{t('photosHint')}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.mediaId)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="product-photos">
            {photos.map((photo, index) => (
              <SortablePhoto
                key={photo.mediaId}
                photo={photo}
                index={index}
                onAlt={(alt) =>
                  setPhotos(photos.map((p) => (p.mediaId === photo.mediaId ? { ...p, alt } : p)))
                }
                onRemove={() => setPhotos(photos.filter((p) => p.mediaId !== photo.mediaId))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <UploadList
        items={uploads}
        onCancel={(id) => getQueue().cancel(id)}
        onRetry={(id) => getQueue().retry(id)}
      />
      {skipped > 0 ? (
        <p role="status" className="text-small text-seal">
          {media('tooMany', { count: skipped })}
        </p>
      ) : null}
      <label className="w-fit cursor-pointer rounded-input border border-ink/20 px-4 py-2 text-small hover:bg-ink/6">
        {t('addPhotos')}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          onChange={(event) => {
            const room = Math.max(0, MAX_PRODUCT_IMAGES - photos.length);
            const files = [...(event.target.files ?? [])];
            const dropped = Math.max(0, files.length - room);
            setSkipped(dropped + getQueue().add(files.slice(0, room)));
            event.target.value = '';
          }}
        />
      </label>
      {!valid ? (
        <p role="status" className="text-small text-seal">
          {t('altRequired')}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="button" disabled={!valid || state === 'saving'} onClick={() => void save()}>
          {common('save')}
        </Button>
        {state === 'stale' || state === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {common(state === 'stale' ? 'stale' : 'saveFailed')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
