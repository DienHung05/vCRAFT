import type { DemoPhotoRef, LogStage } from './data';

/**
 * Photos for the "A day in Bát Tràng" strip on the home page: real Commons photos of the village, one per
 * stage of the day. They illustrate a stage of the craft in general and are never attached to a product or
 * to a journal entry (generic stage photos on a specific product were removed, vCRAFT-83g.35).
 */

/** 3:4 photos for the "Một ngày ở Bát Tràng" strip on the home page. */
const DAY: Partial<Record<LogStage, DemoPhotoRef>> = {
  clay: {
    id: 'day-clay',
    alt: 'Những tảng đất sét vàng nhạt chất thành đống trong kho, xe đẩy tay phía sau',
  },
  throw: {
    id: 'ban-tay-vuot-gom',
    alt: 'Hai bàn tay đeo ngón bọc da, đang chuốt thành một chiếc bát gốm trắng trên bàn xoay',
  },
  dry: {
    id: 'day-dry',
    alt: 'Chậu gốm mộc lồng nhau trong xưởng, phía sau là cột gốm khác xếp cao chờ khô',
  },
  paint: {
    id: 'day-paint',
    alt: 'Người thợ ngồi xổm cúi đầu, dùng bút vẽ lên gốm trắng, cạnh xô nước men',
  },
  fire: {
    id: 'day-fire',
    alt: 'Cửa lò gạch vòm với lửa đỏ cháy bên dưới và chiếc xe đẩy dựng bên cạnh',
  },
  finish: {
    id: 'day-finish',
    alt: 'Dãy chum sứ lớn có vòi, tráng men vẽ lam và hoa lá, xếp thẳng hàng',
  },
};

/** Points the photo's alt text at the `photoAlt` messages (vi/en) keyed by its id. */
const localized = (photo: DemoPhotoRef): DemoPhotoRef => ({ ...photo, altKey: photo.id });

export function dayPhoto(stage: LogStage): DemoPhotoRef | undefined {
  const photo = DAY[stage];
  return photo ? localized(photo) : undefined;
}
