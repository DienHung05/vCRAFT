/**
 * Thăm làng trong triển lãm (vCRAFT-9hg.2, 9hg.6): có tọa độ trên bản đồ không có nghĩa là đón khách.
 * Phòng trưng bày đón khách được tách khỏi các xưởng chỉ dùng để sản xuất.
 */
export type WorkshopPurpose = 'PRODUCTION' | 'SHOWROOM' | 'BOTH';

export interface WorkshopFacts {
  readonly purpose: WorkshopPurpose;
  readonly acceptsVisitors: boolean;
}

/** Nơi khách đến được: phòng trưng bày (hoặc vừa làm vừa trưng bày) và đang nhận khách. */
export function isVisitable(workshop: WorkshopFacts): boolean {
  return workshop.purpose !== 'PRODUCTION' && workshop.acceptsVisitors;
}

/** Chia xưởng của hộ thành nơi đón khách và nơi sản xuất, giữ nguyên thứ tự đầu vào. */
export function splitWorkshops<W extends WorkshopFacts>(
  workshops: readonly W[],
): { showrooms: W[]; production: W[] } {
  return {
    showrooms: workshops.filter(isVisitable),
    production: workshops.filter((w) => !isVisitable(w)),
  };
}
