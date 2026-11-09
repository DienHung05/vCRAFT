import type { HouseholdSeed } from './pools.js';

/**
 * Pure text builders for the demo households and artisans (GH#204, GH#298). `seed-demo.ts` and the live
 * refresh script (`refresh-text.ts`) both call them, so a fresh seed and a refreshed database carry identical
 * text. The text is invented but reads as true; it never claims real people, awards, brands or institutions,
 * and never says it is sample, fictional or demo data.
 */

/** Workshop step named in a worker bio for each of the seed's craft roles. */
const CRAFT_STEP_BY_ROLE: Readonly<Record<string, string>> = {
  'Thợ vuốt dáng': 'khâu vuốt dáng trên bàn xoay',
  'Thợ vẽ lam': 'khâu vẽ họa tiết bằng bút lông',
  'Thợ tráng men': 'khâu tráng men và kiểm men',
  'Thợ nung lò': 'khâu xếp lò và canh lửa',
  'Thợ hoàn thiện': 'khâu mài chân đế và hoàn thiện',
};

/** Step used for a role the seed does not know (e.g. a row edited by hand). */
const GENERIC_STEP = 'nhiều khâu trong xưởng';

/** Owner bios (position 0). Placeholders: {name}, {household}, {craft}, {years}. */
const OWNER_TEMPLATES: readonly string[] = [
  '{name} là chủ hộ {household}, giữ lò và lo khâu chọn đất, pha men cho các món {craft}. Gắn bó với nghề gốm {years} năm, mỗi sáng {name} vẫn áp tay vào vách lò để biết lửa đêm qua còn ấm hay đã tắt. Nghề được truyền lại trong gia đình, và nay đang được dạy tiếp cho lớp thợ trẻ trong xưởng.',
  'Đại diện {household}, {name} theo đuổi nghề gốm {years} năm, chuyên {craft}. Việc thích nhất mỗi sáng là chọn đất: bóp thử một nắm đất ủ, nghe độ dẻo trong lòng bàn tay rồi mới quyết định trong ngày vuốt món gì. Cả xưởng tin vào đôi tay ấy hơn mọi thước đo.',
  'Giữ nghề gốm của gia đình qua {years} mùa lò, {name} đứng đầu {household} và chuyên {craft}. Mẻ men mới nào cũng được thử trên một mảnh gốm nhỏ trước khi vào mẻ lớn. Giờ đến lượt {name} kiên nhẫn chỉ cho các bạn trẻ trong xưởng cách nhìn màu men, như ngày trước từng được chỉ.',
  '{years} năm gắn bó với bàn xoay và lò nung, {name} là chủ xưởng {household}, chuyên {craft}. Ít nói, nhưng hễ ai hỏi chuyện nghề là kể không dứt về những mẻ lò đầu tiên của gia đình. Ngày nào ghé xưởng cũng thấy {name} ngồi bên bàn xoay, kiểm lại từng món trước khi cho đi tiếp.',
  'Làm {craft} đã {years} năm, {name} là thợ cả kiêm chủ hộ của {household}. Từ khâu chọn đất, pha men đến canh lò đều qua tay {name}, và cuốn sổ ghi nhiệt độ từng mẻ nung luôn nằm cạnh lò để so lại về sau. Điều khiến nghề này còn đáng mê là lúc mở lò, khi món nào cũng như vừa ra đời.',
  '{years} năm làm gốm mà mỗi mẻ lò vẫn khiến {name} hồi hộp. Chuyên {craft}, {name} nhận trách nhiệm từ chọn đất, pha men đến quyết định món nào được giao ra khỏi {household}. Chiều xuống, ngồi trước hiên nhìn lô gốm mới phơi và uống chén trà nguội là lúc xưởng yên nhất.',
];

/** Worker bios (position 1 and up). Placeholders: {name}, {Role}, {role}, {Step}, {step}, {household}, {years}. */
const WORKER_TEMPLATES: readonly string[] = [
  '{name} là {role} của {household}, phụ trách {step} đã {years} năm. Vào xưởng từ thuở còn là học trò quét sàn, {name} học nghề từng bước qua tay thợ cả. Thích nhất là lúc mở lò, được nhìn món mình làm ra màu men đẹp.',
  'Ở {household} được {years} năm, {name} đảm nhận {step} với vai {role}. Sáng nào {name} cũng dậy sớm, dọn bàn trước khi cả xưởng vào ca để đôi tay còn tỉnh táo. Ai trong xưởng cũng quý sự cẩn thận ấy.',
  '{Role} ở {household}, {name} có {years} năm kinh nghiệm với {step}. Học nghề từ thợ cả trong xưởng, giờ đến lượt chỉ lại cho những bạn mới vào. Mỗi khi xong một mẻ, {name} lại cầm thử một món lên xem đã đúng ý mình chưa.',
  '{Step} ở {household} do {name} đảm nhận suốt {years} năm qua, trong vai {role}. Nghề gốm dạy cho {name} sự kiên nhẫn: sai một nét là phải làm lại từ đầu. Giờ nghỉ trưa, chén nước chè ngoài hiên xưởng là thú vui nhỏ nhất.',
  '{years} năm gắn bó với {household}, {name} nay là {role} lo {step}. Nhờ làm khâu này, {name} biết rõ từng món đã đi qua tay những ai. Điều đáng quý nhất là cảm giác đất, men và lửa cùng làm nên một món đồ dùng được lâu năm.',
  'Vào {household} học việc từ nhỏ, {name} nay là {role} và giữ {step} đã {years} năm. Trong túi áo luôn có cuốn sổ nhỏ ghi lại những lần thử hỏng, vì tin rằng nghề tiến bộ nhờ chính những lần ấy. Ai mới vào xưởng cũng được mượn xem.',
  '{years} năm làm ở {household}, {name} chuyên {step} trong vai {role}. Tiếng bàn xoay đầu tiên được nghe, ngày thợ cả cho ngồi thử, vẫn còn nhớ rõ. Từ đó đến nay, mỗi lần ngồi vào việc, lòng lại nhẹ đi một chút.',
  'Là {role} ở {household}, {name} đã {years} năm lo {step}. Có thói quen đặt bàn tay lên món đồ vừa xong, thấy mịn mới yên tâm đưa sang khâu sau. Mọi người trong xưởng bảo chính thói quen nhỏ ấy giữ cho chất lượng không bị lệch.',
  '{name} thuộc lớp thợ trẻ của {household}, theo {step} được {years} năm với vai {role}. Học nghề từ thợ cả và cả những bạn cùng xưởng, mỗi người một mẹo nhỏ. Cuối ngày, thích nhất là đứng ngắm hàng gốm vừa xong xếp ngay ngắn trên giá.',
  '{Role} của {household}, {name} lo {step} trong {years} năm qua. Nghề gốm cần tay, mắt và cả sự lắng nghe: gõ nhẹ vào thành món đồ là biết đã đủ chín hay chưa, điều thợ cả đã truyền lại. Cuối buổi, {name} thường là người cuối cùng tắt đèn xưởng.',
];

/** FNV-1a (32-bit): stable across runs and platforms, which keeps the seed deterministic. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Given name: the last word of a Vietnamese full name ("Phan Đại Phong" gives "Phong"). */
const givenName = (fullName: string) => fullName.trim().split(/\s+/).at(-1) || 'Thợ';

const upperFirst = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * The household story with its address filled in. The address of the first workshop ends with ", Hà Nội",
 * which reads redundantly mid-sentence, so that suffix is dropped.
 */
export function householdStory(seed: HouseholdSeed, workshopAddress: string): string {
  return seed.story.replace('{address}', workshopAddress.replace(/, Hà Nội$/, ''));
}

export interface ArtisanBioInput {
  readonly household: HouseholdSeed;
  readonly artisanName: string;
  /** 0 is the household owner; larger values are workers in creation order. */
  readonly position: number;
  /** The artisan's `craft_role`; empty when unknown. */
  readonly craftRole: string;
}

/**
 * A short, deterministic bio of two to three sentences. The template and the years of experience come from a
 * stable hash of the artisan name and position, so the same artisan always gets the same text.
 */
export function artisanBio(input: ArtisanBioInput): string {
  const { household, artisanName, position, craftRole } = input;
  const hash = stableHash(`${artisanName}|${position}`);
  const role = craftRole.trim();
  const step = CRAFT_STEP_BY_ROLE[role] ?? GENERIC_STEP;
  const fill = (template: string, years: number) =>
    template
      .replaceAll('{name}', givenName(artisanName))
      .replaceAll('{household}', household.name)
      .replaceAll('{craft}', household.craft)
      .replaceAll('{years}', String(years))
      .replaceAll('{Step}', upperFirst(step))
      .replaceAll('{step}', step)
      .replaceAll('{Role}', upperFirst(role || 'thợ'))
      .replaceAll('{role}', (role || 'thợ').toLowerCase());
  if (position === 0) {
    const template = OWNER_TEMPLATES[hash % OWNER_TEMPLATES.length] as string;
    return fill(template, 18 + ((hash >>> 8) % 23));
  }
  const template = WORKER_TEMPLATES[hash % WORKER_TEMPLATES.length] as string;
  return fill(template, 3 + ((hash >>> 8) % 17));
}
