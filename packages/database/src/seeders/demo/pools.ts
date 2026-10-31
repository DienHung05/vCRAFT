import type { JournalStage } from '@vcraft/domain';

/** Dữ liệu hư cấu cho làng gốm Bát Tràng; mọi tên người, tên hộ đều là mẫu minh họa, không phải người thật. */

export interface HouseholdSeed {
  name: string;
  owner: string;
  craft: string;
}

/** 20 hộ đã duyệt. Bốn hộ đầu khớp dữ liệu minh họa của apps/web (slug, tên); hộ thứ ba (Lò Đức Phát) do tài khoản household đại diện. */
export const HOUSEHOLDS: readonly HouseholdSeed[] = [
  { name: 'Gốm Minh Hải', owner: 'Nguyễn Minh Hải', craft: 'men lam' },
  { name: 'Gốm Lam Ngọc', owner: 'Trần Thị Ngọc', craft: 'men ngọc và men rạn' },
  { name: 'Lò Đức Phát', owner: 'Lê Đức Phát', craft: 'đồ gia dụng, cốc và bát in logo' },
  { name: 'Gốm Hạnh Thủy', owner: 'Phạm Hạnh Thủy', craft: 'vẽ tay hoa sen, chim lạc' },
  { name: 'Gốm Thanh Tùng', owner: 'Vũ Thanh Tùng', craft: 'bình hoa, lục bình' },
  { name: 'Gốm Bích Hợp', owner: 'Đỗ Thị Bích Hợp', craft: 'ấm chén men nâu' },
  { name: 'Lò Hải Yến', owner: 'Hoàng Hải Yến', craft: 'đồ thờ, lư hương' },
  { name: 'Gốm Quang Vinh', owner: 'Nguyễn Quang Vinh', craft: 'men rạn cổ' },
  { name: 'Gốm Thu Hằng', owner: 'Bùi Thu Hằng', craft: 'đĩa, tô men trắng ngà' },
  { name: 'Gốm Đại Phong', owner: 'Phan Đại Phong', craft: 'tượng và chậu cây' },
  { name: 'Lò Văn Khánh', owner: 'Ngô Văn Khánh', craft: 'bát đĩa số lượng lớn' },
  { name: 'Gốm Mai Anh', owner: 'Lương Mai Anh', craft: 'khay trà, tách trà' },
  { name: 'Gốm Tân Lộc', owner: 'Đinh Tân Lộc', craft: 'bình ngâm rượu' },
  { name: 'Gốm Ngọc Diệp', owner: 'Trịnh Ngọc Diệp', craft: 'men hoa nâu' },
  { name: 'Gốm Phúc An', owner: 'Mai Phúc An', craft: 'đồ trang trí sảnh khách sạn' },
  { name: 'Lò Trường Sơn', owner: 'Cao Trường Sơn', craft: 'gạch gốm và lọ lớn' },
  { name: 'Gốm Kim Liên', owner: 'Tạ Kim Liên', craft: 'chén tống, đĩa trà' },
  { name: 'Gốm Hoàng Long', owner: 'Dương Hoàng Long', craft: 'men xanh rêu' },
  { name: 'Lò Thái Bình', owner: 'Lý Thái Bình', craft: 'ống đựng bút, đồ văn phòng' },
  { name: 'Gốm Lan Chi', owner: 'Hồ Lan Chi', craft: 'hũ trà, bình đựng nước' },
];

export const PENDING_HOUSEHOLD: HouseholdSeed = {
  name: 'Gốm Bảo Châu',
  owner: 'Kiều Bảo Châu',
  craft: 'men lam vẽ tay',
};

export const ARTISAN_FIRST = [
  'Minh',
  'Lan',
  'Hùng',
  'Thảo',
  'Nam',
  'Hoa',
  'Tuấn',
  'Yến',
  'Khoa',
  'Linh',
  'Dũng',
  'Mai',
  'Sơn',
  'Vân',
  'Quân',
  'Hà',
  'Bình',
  'Cúc',
  'Đạt',
  'Oanh',
] as const;
export const ARTISAN_LAST = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Vũ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Ngô',
] as const;
export const CRAFT_ROLES = [
  'Thợ vuốt dáng',
  'Thợ vẽ lam',
  'Thợ tráng men',
  'Thợ nung lò',
  'Thợ hoàn thiện',
] as const;
export const CONTRIBUTIONS = [
  'Vuốt dáng trên bàn xoay',
  'Vẽ họa tiết bằng bút lông',
  'Tráng men và kiểm men',
  'Xếp lò và canh lửa',
  'Mài chân đế, hoàn thiện',
] as const;

export const PRODUCT_TEMPLATES = [
  'Bình hút lộc',
  'Bát chiết yêu',
  'Cốc quai',
  'Bộ ấm chén',
  'Đĩa tròn',
  'Lọ hoa miệng loe',
  'Âu đựng canh',
  'Tách trà',
  'Lục bình',
  'Chậu cây mini',
  'Ống đựng bút',
  'Bình ngâm rượu',
  'Đĩa trà',
  'Hũ đựng trà',
  'Bình đựng nước',
  'Bát ăn cơm',
  'Chén tống',
  'Lư hương',
  'Tô sứ',
  'Khay trà',
] as const;
export const GLAZES = [
  'men lam',
  'men rạn',
  'men ngọc',
  'men nâu',
  'men trắng ngà',
  'vẽ sen',
  'vẽ lam',
  'men hoa nâu',
] as const;

/** Ghi chú theo công đoạn; chọn xoay vòng để mỗi món có lời riêng nhưng dữ liệu vẫn xác định. */
export const STAGE_NOTES: Record<JournalStage, readonly string[]> = {
  clay: [
    'Lọc đất sét sông Hồng, ủ ba tuần cho đất dẻo và đều.',
    'Đất pha cao lanh, giã và lọc hai lần trước khi ủ.',
    'Nhập đất ủ sẵn, kiểm độ dẻo bằng tay trước khi vuốt.',
  ],
  throw: [
    'Vuốt dáng trên bàn xoay, chỉnh thành và miệng bằng tay.',
    'Vuốt từng món, đo lại đường kính miệng sau khi se mặt.',
    'Tạo hình bằng bàn xoay, cắt chân đế khi đất còn ẩm.',
  ],
  dry: [
    'Phơi mộc trong bóng râm hai ngày, tránh nắng gắt gây nứt.',
    'Để phôi se khô tự nhiên, trở mặt mỗi buổi sáng.',
    'Phôi khô trên giá tre ba ngày, kiểm nứt chân tóc trước khi vẽ.',
  ],
  paint: [
    'Vẽ họa tiết lam bằng bút lông trên phôi mộc.',
    'Vẽ hoa văn viền miệng, dùng men lam pha tại xưởng.',
    'Vẽ tay từng món, phủ lớp lót trước khi tráng men.',
  ],
  glaze: [
    'Tráng men một lần bằng cách nhúng, lau sạch chân đế.',
    'Phun men mỏng hai lớp, để ráo trước khi vào lò.',
    'Nhúng men, kiểm độ dày bằng mắt và vá chỗ sót.',
  ],
  fire: [
    'Nung lò gas 1.280 độ C trong 14 giờ, nguội tự nhiên một ngày.',
    'Nung mẻ lò củi, canh lửa hai ca, mở lò sau 36 giờ.',
    'Nung lò gas 1.250 độ C, giữ nhiệt 2 giờ ở đỉnh.',
  ],
  finish: [
    'Kiểm từng món dưới đèn, mài chân đế, dán nhãn mã QR và đóng gói.',
    'Lau, mài chân, loại món rạn lỗi; dán tem truy xuất và đóng thùng.',
    'Hoàn thiện, chụp ảnh nghiệm thu và đóng gói chống va đập.',
  ],
};

export const SKIP_REASONS: Record<JournalStage, string> = {
  clay: 'Mua phôi mộc từ lò trong làng nên hộ không tự xử lý đất.',
  throw: 'Món đúc khuôn, không vuốt tay.',
  dry: 'Phơi cùng mẻ trước, không ghi riêng.',
  paint: 'Món men trơn, không có công đoạn vẽ.',
  glaze: 'Món để mộc một phần, không tráng men toàn thân.',
  fire: 'Nung chung mẻ, không ghi riêng.',
  finish: 'Chưa hoàn thiện.',
};

export const VILLAGE_PARTS = [
  'Xóm 1',
  'Xóm 2',
  'Xóm 3',
  'Xóm 5',
  'Thôn Giang Cao',
  'Thôn Kim Lan',
] as const;

export interface NewsSeed {
  /** Khóa ổn định để sinh id (UUID v5). */
  key: string;
  category: 'HOUSEHOLD_UPDATE' | 'VILLAGE_EVENT' | 'CRAFT_STORY';
  /** Chỉ số trong HOUSEHOLDS; `null` = tin chung của làng. */
  h: number | null;
  title: string;
  summary: string;
  /** Văn bản thuần; `{hộ}` được thay bằng tên hộ. */
  body: string;
  /** Số ngày trước mốc đóng băng. */
  daysAgo: number;
  pinned?: boolean;
}

/** 18 tin mẫu (6 tin chung của làng, 12 tin của hộ). Văn bản thuần, hư cấu, không phải tin thật. */
export const NEWS: readonly NewsSeed[] = [
  {
    key: 'village-lantern',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Chợ gốm đêm Bát Tràng trở lại vào cuối tuần',
    summary: 'Hơn hai chục hộ mở xưởng buổi tối, khách được tự tay vuốt thử một chiếc cốc.',
    body: 'Chợ gốm đêm mở cửa từ 17:00 đến 21:30 vào thứ Sáu và thứ Bảy hằng tuần. Mỗi hộ tham gia dựng một quầy nhỏ trước xưởng, có hướng dẫn vuốt gốm cho khách mới và bàn tô men miễn phí cho trẻ em.\n\nKhách nên đi bộ từ cổng làng để dễ tìm chỗ gửi xe. Thông tin từng xưởng xem ở trang hồ sơ của hộ.',
    daysAgo: 2,
    pinned: true,
  },
  {
    key: 'village-cooperative',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Báo giá chung: nhiều hộ cùng nhận một đơn lớn',
    summary: 'Ban quản lý giới thiệu cách các hộ chia số lượng khi khách đặt đơn vài nghìn món.',
    body: 'Khi một đơn quá lớn cho một xưởng, Ban quản lý mời các hộ phù hợp cùng đề xuất số lượng và giá. Khách nhận một bản chào giá chung, mỗi hộ chỉ làm phần mình đã xác nhận.\n\nMọi hộ đều thấy rõ phần của mình trước khi đơn bắt đầu sản xuất, và tiến độ được báo theo từng hộ.',
    daysAgo: 9,
    pinned: true,
  },
  {
    key: 'village-trace',
    category: 'CRAFT_STORY',
    h: null,
    title: 'Quét mã QR để xem nhật ký làm ra chiếc bát',
    summary: 'Mỗi món có một mã riêng dẫn tới các công đoạn từ nắn đất đến ra lò.',
    body: 'Mã QR in dưới chân sản phẩm mở ra nhật ký sản xuất: ngày vuốt, ngày phơi, ngày vẽ, ngày nung và người làm. Các mốc được ghi nối tiếp và không sửa được về sau, chỉ có thể thêm mốc đính chính.\n\nNhờ vậy người mua biết chiếc bát mình cầm do hộ nào làm và làm như thế nào.',
    daysAgo: 16,
  },
  {
    key: 'village-kiln-safety',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Tập huấn an toàn lò nung cho các hộ',
    summary: 'Buổi tập huấn ngắn về kiểm tra ống khói, bình chữa cháy và lối thoát hiểm.',
    body: 'Cuối tuần trước, các hộ có lò nung tham dự buổi tập huấn tại nhà văn hóa làng. Nội dung gồm kiểm tra định kỳ ống khói, vị trí bình chữa cháy và cách sơ tán khách khi xưởng đông người.\n\nCác hộ sẽ nhận bảng kiểm để dán tại xưởng.',
    daysAgo: 24,
  },
  {
    key: 'village-clay-month',
    category: 'CRAFT_STORY',
    h: null,
    title: 'Vì sao gốm Bát Tràng cần ủ đất nhiều tháng',
    summary: 'Đất được ủ, nhào và lọc nhiều lần để gốm không nứt khi vào lò.',
    body: 'Đất sét được ngâm, lọc cặn rồi ủ trong hố nhiều tháng. Đất ủ lâu dẻo hơn và ít bọt khí, nên thành phẩm ít nứt khi nung.\n\nNhiều thợ cả vẫn chọn mua đất ủ sẵn trong làng thay vì trộn mới để giữ chất đất quen thuộc.',
    daysAgo: 33,
  },
  {
    key: 'village-spring-fair',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Hội làng mùa xuân: thi vuốt gốm và trưng bày mới',
    summary: 'Các hộ trưng bày mẫu mới và thi vuốt gốm trong ba ngày hội làng.',
    body: 'Hội làng diễn ra ba ngày với phần thi vuốt gốm cho nghệ nhân trẻ, khu trưng bày mẫu mới của các hộ và buổi giao lưu với khách đặt hàng số lượng lớn.\n\nLịch chi tiết được đăng tại nhà văn hóa làng và trên trang này.',
    daysAgo: 48,
  },
  {
    key: 'h0-blue-glaze',
    category: 'CRAFT_STORY',
    h: 0,
    title: 'Men lam của {hộ}: nung thử ba mươi lần mới chọn được màu',
    summary: 'Chủ hộ kể về những mẻ men lam thất bại trước khi ra màu xanh hiện nay.',
    body: 'Hộ {hộ} thử nhiều tỉ lệ men và nhiệt độ lò khác nhau. Mẻ đầu ngả xám, mẻ sau chảy men. Sau ba mươi lần, màu lam sâu và đều mới được giữ lại làm mẫu chuẩn.\n\nNhững chiếc bình hút lộc men lam của hộ đều dùng công thức này.',
    daysAgo: 5,
  },
  {
    key: 'h0-open-kiln',
    category: 'HOUSEHOLD_UPDATE',
    h: 0,
    title: '{hộ} mở lò cho khách xem mẻ nung',
    summary: 'Sáng thứ Bảy, khách có thể đứng xem lúc mở lò và chọn sản phẩm ngay tại xưởng.',
    body: 'Hộ {hộ} mở lò vào 8:00 sáng thứ Bảy. Khách xem được cách thợ lấy từng món ra khỏi lò, kiểm men và loại món lỗi. Số chỗ có hạn nên nên báo trước qua điện thoại của xưởng.',
    daysAgo: 12,
  },
  {
    key: 'h1-crackle',
    category: 'CRAFT_STORY',
    h: 1,
    title: 'Men rạn của {hộ} nứt thành tiếng trong lò',
    summary: 'Vết rạn trên men xuất hiện khi gốm nguội và được nhuộm trà để lộ đường vân.',
    body: 'Men rạn nứt khi gốm nguội dần, thợ nghe được những tiếng tách nhỏ trong lò. Hộ {hộ} nhuộm trà lên mặt men để đường rạn hiện rõ, mỗi chiếc có một mạng vân riêng.',
    daysAgo: 7,
  },
  {
    key: 'h2-logo-cup',
    category: 'HOUSEHOLD_UPDATE',
    h: 2,
    title: '{hộ} nhận thêm đơn cốc quai in logo cho doanh nghiệp',
    summary: 'Hộ mở thêm ca vuốt buổi chiều để kịp các đơn quà tặng số lượng lớn.',
    body: 'Hộ {hộ} vừa tăng thêm một ca làm buổi chiều. Cốc men trắng quai tròn in logo được kiểm từng chiếc trước khi đóng gói. Doanh nghiệp muốn đặt riêng có thể gửi yêu cầu báo giá trên hệ thống để hộ đề xuất số lượng và giá.',
    daysAgo: 4,
  },
  {
    key: 'h2-batch-code',
    category: 'CRAFT_STORY',
    h: 2,
    title: 'Mỗi lô cốc của {hộ} có một mã truy xuất riêng',
    summary: 'Lô 300 chiếc được ghi nhật ký chung: ngày vuốt, ngày nung và người làm.',
    body: 'Với lô cốc nhiều chiếc, hộ {hộ} ghi một nhật ký chung cho cả lô thay vì từng chiếc. Người mua quét mã QR dưới đáy cốc là xem được các công đoạn và tên nghệ nhân.',
    daysAgo: 19,
  },
  {
    key: 'h3-lotus',
    category: 'CRAFT_STORY',
    h: 3,
    title: 'Hoa sen vẽ tay của {hộ}: một nét một hơi thở',
    summary: 'Nghệ nhân vẽ lam từng cánh sen bằng cọ lông mềm, không dùng khuôn.',
    body: 'Mỗi cánh sen được vẽ bằng một nét cọ liền. Hộ {hộ} cho biết thợ vẽ phải tập nhiều tháng để nét đều tay. Men lam hơi nhạt khi vẽ nhưng đậm lại sau khi nung.',
    daysAgo: 11,
  },
  {
    key: 'h4-vase',
    category: 'HOUSEHOLD_UPDATE',
    h: 4,
    title: '{hộ} ra mắt dòng lục bình cao một mét',
    summary: 'Lục bình lớn được vuốt hai đoạn rồi ghép, phù hợp sảnh khách sạn và nhà hàng.',
    body: 'Hộ {hộ} vuốt thân lục bình thành hai đoạn rồi ghép khi đất còn ẩm để chịu lửa tốt. Mẫu mới cao khoảng một mét, có thể đặt riêng men và họa tiết theo yêu cầu.',
    daysAgo: 21,
  },
  {
    key: 'h5-teaset',
    category: 'HOUSEHOLD_UPDATE',
    h: 5,
    title: 'Bộ ấm chén men nâu của {hộ} có thêm phiên bản quà Tết',
    summary: 'Hộp gỗ đóng sẵn, có thể khắc tên người nhận theo đơn đặt trước.',
    body: 'Hộ {hộ} chuẩn bị bộ ấm chén men nâu đóng hộp cho mùa Tết. Khách đặt trước có thể khắc tên lên đáy ấm. Đơn số lượng lớn nên gửi qua báo giá chung để các hộ cùng chia việc.',
    daysAgo: 27,
  },
  {
    key: 'h6-altar',
    category: 'CRAFT_STORY',
    h: 6,
    title: 'Lư hương của {hộ}: vì sao chân đế phải dày',
    summary: 'Đồ thờ cần vững và nặng tay, thợ để lại độ dày chân đế theo kinh nghiệm nhiều đời.',
    body: 'Lư hương là đồ thờ nên phải đứng vững và chịu nhiệt. Hộ {hộ} giữ chân đế dày hơn gốm dân dụng và nung thêm một lần để men không bong.',
    daysAgo: 35,
  },
  {
    key: 'h7-class',
    category: 'HOUSEHOLD_UPDATE',
    h: 7,
    title: '{hộ} mở lớp học vuốt gốm cho người mới',
    summary: 'Lớp ba giờ mỗi sáng Chủ nhật, mang về một sản phẩm tự làm sau khi nung.',
    body: 'Lớp học của hộ {hộ} nhận tối đa tám người mỗi buổi. Học viên vuốt một chiếc bát, xưởng nung giúp và gửi lại sau hai tuần. Đăng ký trước qua số điện thoại ghi tại hồ sơ hộ.',
    daysAgo: 14,
  },
  {
    key: 'h8-white-plate',
    category: 'CRAFT_STORY',
    h: 8,
    title: 'Men trắng ngà của {hộ} cho món ăn lên màu đẹp',
    summary: 'Đĩa và tô men trắng ngà được nhiều quán ăn chọn vì nền men ấm, ít chói.',
    body: 'Men trắng ngà của hộ {hộ} hơi ngả vàng nhẹ nên món ăn nhìn ấm hơn so với men trắng tinh. Các nhà hàng thường đặt theo bộ có cùng độ dày thành để xếp chồng gọn.',
    daysAgo: 30,
  },
  {
    key: 'h12-wine-jar',
    category: 'HOUSEHOLD_UPDATE',
    h: 12,
    title: '{hộ} hoàn thiện lứa bình ngâm rượu men nâu',
    summary: 'Lứa mới có nắp gốm khít và kiểm kín nước trước khi giao.',
    body: 'Hộ {hộ} thử kín từng bình bằng cách đổ đầy nước và để qua đêm. Bình rò sẽ bị loại. Lứa này có nắp gốm cùng men, khít hơn nắp gỗ trước đây.',
    daysAgo: 40,
  },
];
