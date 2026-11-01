import type { DemoPhotoRef, LogStage } from './data';

/**
 * Ảnh minh hoạ từng công đoạn (không phải ảnh chụp đúng món đồ; ảnh Bát Tràng có giấy phép CC,
 * xem `photo-credits.ts`). Alt mô tả điều nhìn thấy, mở đầu bằng "Ảnh minh hoạ".
 */

/** Ảnh 3:2 cho từng mốc trên dòng thời gian lửa. Mốc đính chính (`supersedesSeq`) dùng ảnh riêng. */
const TIMELINE: Record<LogStage, DemoPhotoRef> = {
  clay: {
    id: 'tl-clay',
    alt: 'Ảnh minh hoạ công đoạn nhào đất: những tảng đất sét vàng nhạt chất trong kho, xe đẩy dựng gần đó',
  },
  throw: {
    id: 'tl-throw',
    alt: 'Ảnh minh hoạ công đoạn vuốt dáng: hai bàn tay chuốt thành bát gốm trắng trên bàn xoay',
  },
  dry: {
    id: 'tl-dry',
    alt: 'Ảnh minh hoạ công đoạn phơi: khuôn thạch cao và gốm mộc xếp trên giá trong xưởng, chờ khô',
  },
  paint: {
    id: 'tl-paint',
    alt: 'Ảnh minh hoạ công đoạn vẽ: người thợ cúi xuống vẽ lên những chiếc chén trắng xếp trên bàn, cạnh xô nước men',
  },
  glaze: {
    id: 'tl-glaze',
    alt: 'Ảnh minh hoạ công đoạn tráng men: những chiếc chum sứ lớn đã tráng men, vẽ lam và hoa lá, có vòi xếp thành hàng',
  },
  fire: {
    id: 'tl-fire',
    alt: 'Ảnh minh hoạ công đoạn nung: những ô lửa đang cháy sáng giữa các cột gốm xếp trong lò',
  },
  finish: {
    id: 'tl-finish',
    alt: 'Ảnh minh hoạ công đoạn hoàn thiện: ba chiếc bình sứ miệng loe vẽ lam hoa sen đặt cạnh nhau',
  },
};

const TIMELINE_CORRECTED_FIRE: DemoPhotoRef = {
  id: 'tl-fire-2',
  alt: 'Ảnh minh hoạ công đoạn nung: cửa lò gạch vòm, ngọn lửa đỏ cháy bên dưới và chiếc xe đẩy dựng bên cạnh',
};

/** Ảnh vuông (1:1) cho dải thumbnail trên trang chi tiết sản phẩm. */
const SQUARE: Partial<Record<LogStage, DemoPhotoRef>> = {
  throw: {
    id: 'sq-throw',
    alt: 'Ảnh minh hoạ công đoạn vuốt dáng: bàn tay đeo ngón bọc da chuốt gốm trắng trên bàn xoay',
  },
  dry: {
    id: 'sq-dry',
    alt: 'Ảnh minh hoạ công đoạn phơi: chậu gốm mộc lồng nhau và gốm xếp cao phía sau, trong xưởng',
  },
  paint: {
    id: 'sq-paint',
    alt: 'Ảnh minh hoạ công đoạn vẽ: người thợ cúi đầu vẽ lên chén trắng, cạnh xô nước men đỏ',
  },
  glaze: {
    id: 'sq-glaze',
    alt: 'Ảnh minh hoạ công đoạn tráng men: chum sứ lớn đã tráng men vẽ lam và hoa lá, có vòi',
  },
};

/** Ảnh 3:4 cho dải "Một ngày ở Bát Tràng" ở trang chủ. */
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

export function timelinePhoto(stage: LogStage, corrects: boolean): DemoPhotoRef {
  return localized(corrects && stage === 'fire' ? TIMELINE_CORRECTED_FIRE : TIMELINE[stage]);
}

/** Ảnh thumbnail theo công đoạn; công đoạn không có ảnh vuông riêng dùng ảnh 3:2 (cắt giữa). */
export function squarePhoto(stage: LogStage): DemoPhotoRef {
  return localized(SQUARE[stage] ?? TIMELINE[stage]);
}

export function dayPhoto(stage: LogStage): DemoPhotoRef | undefined {
  const photo = DAY[stage];
  return photo ? localized(photo) : undefined;
}
