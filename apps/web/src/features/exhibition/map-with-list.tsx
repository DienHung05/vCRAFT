import { useTranslations } from 'next-intl';
import { VillageMiniMap } from '@/features/village-map/village-mini-map';

export interface PlaceItem {
  id: string;
  name: string;
  household: string;
  address: string;
  visitable: boolean;
  pin: { x: number; y: number };
}

/**
 * Bản đồ kèm danh sách chữ (vCRAFT-9hg.6): bản đồ là minh họa định hướng, danh sách là phương án
 * dễ tiếp cận và luôn hiện bên cạnh, không thay thế nhau.
 */
export function MapWithList({
  places,
  highlight,
}: {
  places: readonly PlaceItem[];
  highlight?: string;
}) {
  const t = useTranslations('exhibition');
  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr] md:items-start">
      <VillageMiniMap
        label={t('mapTitle')}
        pins={places.map((p) => ({ id: p.id, ...p.pin, open: p.visitable, label: p.name }))}
        {...(highlight !== undefined && { highlight })}
      />
      <div>
        <h3 className="text-h3">{t('listTitle')}</h3>
        <ol className="mt-4 space-y-4" data-testid="place-list">
          {places.map((p) => (
            <li key={p.id} className="border-ink/10 border-b pb-4 last:border-b-0">
              <p className="font-medium">{p.name}</p>
              <p className="text-small text-ash">
                {p.household} · {p.address}
              </p>
              <p className="mt-1 text-small">
                {p.visitable ? t('listVisitable') : t('listProduction')}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
