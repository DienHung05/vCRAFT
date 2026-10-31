// Sinh bởi scripts/demo-photos/export-manifest.mjs từ dữ liệu minh họa của apps/web; chạy lại script khi dữ liệu web đổi.
// Ảnh Bát Tràng minh hoạ từ Wikimedia Commons (CC0 / CC BY / CC BY-SA), tệp nằm ở apps/web/public/images/demo.

import type { JournalStage } from '@vcraft/domain';
import type { MediaCredit, MediaLinkRole, MediaLinkTarget } from '../../entities/index.js';

export interface DemoPhoto {
  /** Tên gốc tệp trong apps/web/public/images/demo: `<id>-<width>.webp`. */
  id: string;
  /** Mô tả mặc định (chỗ dùng đầu tiên); mỗi liên kết có thể ghi đè. */
  alt: string;
  credit: MediaCredit;
  /** Các chiều rộng có sẵn trong thư mục ảnh; bản lớn nhất làm đầu vào của đường xử lý ảnh. */
  widths: readonly number[];
}

export interface DemoPhotoLink {
  photo: string;
  target: MediaLinkTarget;
  /** `traceCode` (sản phẩm), `slug` (hộ) hoặc khóa tin trong `NEWS` của pools.ts. */
  key: string;
  role: MediaLinkRole;
  position: number;
  alt: string;
  caption?: string;
}

export const DEMO_PHOTOS: readonly DemoPhoto[] = [
  {
    id: 'chan-dung-minh-hai',
    alt: 'Bàn tay đang chuốt thành một chiếc bát gốm trắng trên bàn xoay, ngón tay bọc da mỏng',
    credit: {
      title: 'File:Bat-Trang-Ceramic-Village11.jpg',
      author: 'Steven C. Price',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village11.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'bia-minh-hai',
    alt: 'Hai lò nung gạch cao hình chóp, vách gạch cũ nhiều lỗ thông hơi, cỏ mọc quanh chân lò dưới trời trong',
    credit: {
      title: 'File:DSC0252 (22946631901).jpg',
      author: 'Tran Anh Khoa (zorrotran)',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:DSC0252_(22946631901).jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'ban-xoay-xuong',
    alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
    credit: {
      title: 'File:Bát Tràng, studio.jpg',
      author: 'Charles Haynes',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:B%C3%A1t_Tr%C3%A0ng,_studio.jpg',
    },
    widths: [640],
  },
  {
    id: 'ban-tay-vuot-gom',
    alt: 'Hai bàn tay đeo ngón bọc da, đang chuốt thành một chiếc bát gốm trắng trên bàn xoay',
    credit: {
      title: 'File:Bat-Trang-Ceramic-Village8.jpg',
      author: 'Steven C. Price',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village8.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'binh-hoa-lam',
    alt: 'Hai chiếc bình sứ trắng vẽ hoa văn lam: một bình có cảnh nhà bên sông, một bình dáng lục giác',
    credit: {
      title: 'File:Gom Bat Trang-Lo hoa.jpeg',
      author: 'Lưu Ly',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gom_Bat_Trang-Lo_hoa.jpeg',
    },
    widths: [640, 1280],
  },
  {
    id: 'khuon-phoi-san',
    alt: 'Các khuôn thạch cao trắng xếp thành hàng trên giá phơi ngoài sân, cạnh những khuôn đất nung đỏ',
    credit: {
      title: 'File:Bát Tràng, molded ware.jpg',
      author: 'Charles Haynes',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:B%C3%A1t_Tr%C3%A0ng,_molded_ware.jpg',
    },
    widths: [640],
  },
  {
    id: 'than-phoi-tuong',
    alt: 'Những viên than đen ép tròn được dán kín trên một bức tường gạch cũ ở làng gốm',
    credit: {
      title: 'File:Bát Tràng, tường than.JPG',
      author: 'Greenknight dv',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:B%C3%A1t_Tr%C3%A0ng,_t%C6%B0%E1%BB%9Dng_than.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'khuon-binh-lon',
    alt: 'Các khuôn thạch cao cao gần hai mét, buộc dây, dựng trong xưởng đúc bình lớn',
    credit: {
      title: 'File:Bát Tràng, big molds.jpg',
      author: 'Charles Haynes',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:B%C3%A1t_Tr%C3%A0ng,_big_molds.jpg',
    },
    widths: [640],
  },
  {
    id: 'chan-dung-lam-ngoc',
    alt: 'Một người thợ ngồi trên ghế nhựa vàng, nhìn nghiêng, giữa những hàng bình gốm mộc màu be trong xưởng',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2723.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2723.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'bia-lam-ngoc',
    alt: 'Kệ kính bày nhiều hũ gốm quai cung đắp nổi men nâu xanh rạn nhẹ, cạnh những bình men lam trắng',
    credit: {
      title: 'File:Bình vôi (lime container) 3.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:B%C3%ACnh_v%C3%B4i_(lime_container)_3.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ln-hu-men-ngoc',
    alt: 'Chiếc hũ gốm men xanh ngọc nhạt rạn mảnh, thân tròn, miệng nhỏ, quai cung phía trên và hai quai vòng hai bên',
    credit: {
      title: 'File:Bình vôi (lime container) 6.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:B%C3%ACnh_v%C3%B4i_(lime_container)_6.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ln-am-men-xanh',
    alt: 'Bình gốm thân men ngà loang xanh lục, quai cung xanh đậm đắp nổi hình dây leo, miệng tròn nhỏ',
    credit: {
      title: 'File:Bình vôi (lime container) 1.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:B%C3%ACnh_v%C3%B4i_(lime_container)_1.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ln-bo-am-quai-ran',
    alt: 'Nhiều hũ gốm men xám nâu rạn nhẹ, quai cung đắp nổi, xếp trong tủ kính',
    credit: {
      title: 'File:Bình vôi (lime container) 4.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:B%C3%ACnh_v%C3%B4i_(lime_container)_4.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ln-cua-lo-vom',
    alt: 'Cửa lò nung xây bằng gạch đỏ, vòm nhọn, bên trong tối',
    credit: {
      title: 'File:Kiln in Vietnam in Chau Thanh District, 07.jpg',
      author: 'Karel Bilek',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Kiln_in_Vietnam_in_Chau_Thanh_District,_07.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'chan-dung-duc-phat',
    alt: 'Người thợ ngồi quay lưng giữa nền xưởng, quanh là chậu và bình gốm mộc màu hồng, kem, bên cạnh xô nước men trắng',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2733.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2733.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'bia-duc-phat',
    alt: 'Xưởng lớn với giàn khay gốm xếp cao, những giỏ tre và một người thợ ngồi làm việc ở xa',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2736.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2736.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'dp-bat-xep-rom',
    alt: 'Chồng bát và chậu men trắng vẽ lam xếp cùng rơm lót trong một gian kho nhỏ',
    credit: {
      title: 'File:Porcelana vendejo en vilaĝo Bát Tràng (Vjetnamio) 02.jpg',
      author: 'RG72',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Porcelana_vendejo_en_vila%C4%9Do_B%C3%A1t_Tr%C3%A0ng_(Vjetnamio)_02.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'dp-chau-nau',
    alt: 'Chậu và nồi gốm men nâu, men xám đặt cạnh rơm và rổ tre',
    credit: {
      title: 'File:Porcelana vendejo en vilaĝo Bát Tràng (Vjetnamio) 03.jpg',
      author: 'RG72',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Porcelana_vendejo_en_vila%C4%9Do_B%C3%A1t_Tr%C3%A0ng_(Vjetnamio)_03.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'dp-chau-dat-nung',
    alt: 'Những chiếc chậu gốm nâu cao, chạm nổi hoa văn, xếp trước một cửa hàng',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2649.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2649.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'dp-chum-cam',
    alt: 'Hàng chục bình và lọ gốm đất nung màu cam, khắc hoa văn, xếp chồng lên nhau',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2665.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2665.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'chan-dung-hanh-thuy',
    alt: 'Bàn tay cầm một chiếc chén trắng, quanh là những chén gốm xếp trên bàn cạnh xô nước men đỏ; người thợ cúi đầu, không thấy mặt',
    credit: {
      title: 'File:Bat-Trang-Ceramic-Village10.jpg',
      author: 'Steven C. Price',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village10.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'bia-hanh-thuy',
    alt: 'Gian hàng gốm với những kệ đầy bát, đĩa và bình men lam trắng xếp thành dãy',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2647.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2647.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ht-binh-hoa-lam-vo',
    alt: 'Chiếc bình men ngà vẽ cây trúc và chim bằng nét xanh đen, miệng loe, đặt cạnh những bình khác',
    credit: {
      title: 'File:Vase by Chu Dau ceramic 3.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vase_by_Chu_Dau_ceramic_3.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ht-den-dau-su',
    alt: 'Chiếc đèn dầu bằng sứ trắng vẽ rồng lam, bên cạnh những bình sứ vẽ mây',
    credit: {
      title: 'File:Kerosene lamps in Vietnam (đèn dầu bằng sứ).JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Kerosene_lamps_in_Vietnam_(%C4%91%C3%A8n_d%E1%BA%A7u_b%E1%BA%B1ng_s%E1%BB%A9).JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ht-de-lu-chu-dau',
    alt: 'Đế lư tròn men ngà có chân cuộn, vẽ chàm đậm hình đầu thú và rồng',
    credit: {
      title: 'File:Jar support by Chu Dau ceramic.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jar_support_by_Chu_Dau_ceramic.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'ht-binh-ngoc-ho-xuan',
    alt: 'Bình dáng quả lê thon, thân vẽ chim bằng lam trên nền men trắng xanh nhạt',
    credit: {
      title:
        'File:Yuhuchun vase, Chu Dau kiln, Hai Duong, Early Le dynasty, 15th century AD, blue & white glazed ceramic with polychrome - National Museum of Vietnamese History - Hanoi, Vietnam - DSC05693.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Yuhuchun_vase,_Chu_Dau_kiln,_Hai_Duong,_Early_Le_dynasty,_15th_century_AD,_blue_%26_white_glazed_ceramic_with_polychrome_-_National_Museum_of_Vietnamese_History_-_Hanoi,_Vietnam_-_DSC05693.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'binh-men-lam-xam',
    alt: 'Bình gốm Bát Tràng cổ cao, bụng tròn, men xám lam, đắp nổi cành cây và một người cầm cần câu nhuốm vàng',
    credit: {
      title:
        'File:Vase, Bat Trang ceramic with blue glaze - Nguyen dynasty, 19th century AD - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05325.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Vase,_Bat_Trang_ceramic_with_blue_glaze_-_Nguyen_dynasty,_19th_century_AD_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05325.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'bat-ve-sen-men-trong',
    alt: 'Lòng chiếc bát gốm men trong ngả ngà, giữa vẽ lam một đoá sen cách điệu có lá, viền miệng vẽ dải hoa văn nhỏ',
    credit: {
      title: 'File:Bol, M.C. 2019-90 (3 of 4).jpg',
      author: 'Musée Cernuschi, Paris (Paris Musées)',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bol,_M.C._2019-90_(3_of_4).jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'coc-men-trang-quai-tron',
    alt: 'Chiếc cốc sứ trắng thân thẳng, men bóng, quai tròn bên trái, đặt trên nền trắng',
    credit: {
      title: 'File:Mug (AM 2014.19.55-2).jpg',
      author: 'Crown Lynn Potteries Ltd (ảnh: Auckland Museum)',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mug_(AM_2014.19.55-2).jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'news-cho-gom',
    alt: 'Dãy gian hàng gốm men lam trắng dưới mái xanh ở chợ gốm, bàn ghế che bạt phía trước',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2615.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2615.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'news-dat-set',
    alt: 'Đống đất sét nâu đỏ chất cao trong nhà kho rộng, phía sau là hàng ngói đất nung',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2699.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2699.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-clay',
    alt: 'Ảnh minh hoạ công đoạn nhào đất: những tảng đất sét vàng nhạt chất trong kho, xe đẩy dựng gần đó',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2711.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2711.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-throw',
    alt: 'Ảnh minh hoạ công đoạn vuốt dáng: hai bàn tay chuốt thành bát gốm trắng trên bàn xoay',
    credit: {
      title: 'File:Bat-Trang-Ceramic-Village8.jpg',
      author: 'Steven C. Price',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village8.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-dry',
    alt: 'Ảnh minh hoạ công đoạn phơi: khuôn thạch cao và gốm mộc xếp trên giá trong xưởng, chờ khô',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2722.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2722.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-paint',
    alt: 'Ảnh minh hoạ công đoạn vẽ: người thợ cúi xuống vẽ lên những chiếc chén trắng xếp trên bàn, cạnh xô nước men',
    credit: {
      title: 'File:Bat-Trang-Ceramic-Village10.jpg',
      author: 'Steven C. Price',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village10.jpg',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-glaze',
    alt: 'Ảnh minh hoạ công đoạn tráng men: những chiếc chum sứ lớn đã tráng men, vẽ lam và hoa lá, có vòi xếp thành hàng',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2676.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2676.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-fire',
    alt: 'Ảnh minh hoạ công đoạn nung: những ô lửa đang cháy sáng giữa các cột gốm xếp trong lò',
    credit: {
      title: 'File:Xã Bát Tràng、鉢塲社 バチャン村 DSCF2741.JPG',
      author: '松岡明芳 (Akiyoshi Matsuoka)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:X%C3%A3_B%C3%A1t_Tr%C3%A0ng%E3%80%81%E9%89%A2%E5%A1%B2%E7%A4%BE_%E3%83%90%E3%83%81%E3%83%A3%E3%83%B3%E6%9D%91_DSCF2741.JPG',
    },
    widths: [640, 1280],
  },
  {
    id: 'tl-finish',
    alt: 'Ảnh minh hoạ công đoạn hoàn thiện: ba chiếc bình sứ miệng loe vẽ lam hoa sen đặt cạnh nhau',
    credit: {
      title: 'File:Vase by Chu Dau ceramic.JPG',
      author: 'Hungda',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vase_by_Chu_Dau_ceramic.JPG',
    },
    widths: [640, 1280],
  },
];

export const DEMO_PHOTO_LINKS: readonly DemoPhotoLink[] = [
  {
    photo: 'chan-dung-minh-hai',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Bàn tay đang chuốt thành một chiếc bát gốm trắng trên bàn xoay, ngón tay bọc da mỏng',
  },
  {
    photo: 'bia-minh-hai',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'BANNER',
    position: 0,
    alt: 'Hai lò nung gạch cao hình chóp, vách gạch cũ nhiều lỗ thông hơi, cỏ mọc quanh chân lò dưới trời trong',
  },
  {
    photo: 'ban-xoay-xuong',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 0,
    alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
    caption: 'Dãy bàn xoay trong xưởng',
  },
  {
    photo: 'ban-tay-vuot-gom',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 1,
    alt: 'Hai bàn tay đeo ngón bọc da, đang chuốt thành một chiếc bát gốm trắng trên bàn xoay',
    caption: 'Bàn tay chuốt gốm',
  },
  {
    photo: 'binh-hoa-lam',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 2,
    alt: 'Hai chiếc bình sứ trắng vẽ hoa văn lam: một bình có cảnh nhà bên sông, một bình dáng lục giác',
    caption: 'Bình hoa lam',
  },
  {
    photo: 'khuon-phoi-san',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 3,
    alt: 'Các khuôn thạch cao trắng xếp thành hàng trên giá phơi ngoài sân, cạnh những khuôn đất nung đỏ',
    caption: 'Khuôn thạch cao phơi sân',
  },
  {
    photo: 'than-phoi-tuong',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 4,
    alt: 'Những viên than đen ép tròn được dán kín trên một bức tường gạch cũ ở làng gốm',
    caption: 'Than phơi bên tường lò',
  },
  {
    photo: 'khuon-binh-lon',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 5,
    alt: 'Các khuôn thạch cao cao gần hai mét, buộc dây, dựng trong xưởng đúc bình lớn',
    caption: 'Khuôn đúc bình lớn',
  },
  {
    photo: 'chan-dung-lam-ngoc',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Một người thợ ngồi trên ghế nhựa vàng, nhìn nghiêng, giữa những hàng bình gốm mộc màu be trong xưởng',
  },
  {
    photo: 'bia-lam-ngoc',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'BANNER',
    position: 0,
    alt: 'Kệ kính bày nhiều hũ gốm quai cung đắp nổi men nâu xanh rạn nhẹ, cạnh những bình men lam trắng',
  },
  {
    photo: 'ln-hu-men-ngoc',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 0,
    alt: 'Chiếc hũ gốm men xanh ngọc nhạt rạn mảnh, thân tròn, miệng nhỏ, quai cung phía trên và hai quai vòng hai bên',
    caption: 'Chiếc hũ men ngọc',
  },
  {
    photo: 'ln-am-men-xanh',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 1,
    alt: 'Bình gốm thân men ngà loang xanh lục, quai cung xanh đậm đắp nổi hình dây leo, miệng tròn nhỏ',
    caption: 'Bình quai men xanh lục',
  },
  {
    photo: 'ln-bo-am-quai-ran',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 2,
    alt: 'Nhiều hũ gốm men xám nâu rạn nhẹ, quai cung đắp nổi, xếp trong tủ kính',
    caption: 'Hũ quai men rạn xám nâu',
  },
  {
    photo: 'ln-cua-lo-vom',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 3,
    alt: 'Cửa lò nung xây bằng gạch đỏ, vòm nhọn, bên trong tối',
    caption: 'Cửa lò xây vòm',
  },
  {
    photo: 'chan-dung-duc-phat',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Người thợ ngồi quay lưng giữa nền xưởng, quanh là chậu và bình gốm mộc màu hồng, kem, bên cạnh xô nước men trắng',
  },
  {
    photo: 'bia-duc-phat',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'BANNER',
    position: 0,
    alt: 'Xưởng lớn với giàn khay gốm xếp cao, những giỏ tre và một người thợ ngồi làm việc ở xa',
  },
  {
    photo: 'dp-bat-xep-rom',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 0,
    alt: 'Chồng bát và chậu men trắng vẽ lam xếp cùng rơm lót trong một gian kho nhỏ',
    caption: 'Bát chậu xếp rơm',
  },
  {
    photo: 'dp-chau-nau',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 1,
    alt: 'Chậu và nồi gốm men nâu, men xám đặt cạnh rơm và rổ tre',
    caption: 'Chậu men nâu',
  },
  {
    photo: 'dp-chau-dat-nung',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 2,
    alt: 'Những chiếc chậu gốm nâu cao, chạm nổi hoa văn, xếp trước một cửa hàng',
    caption: 'Chậu cây gốm nâu',
  },
  {
    photo: 'dp-chum-cam',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 3,
    alt: 'Hàng chục bình và lọ gốm đất nung màu cam, khắc hoa văn, xếp chồng lên nhau',
    caption: 'Gốm đất nung cam',
  },
  {
    photo: 'chan-dung-hanh-thuy',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Bàn tay cầm một chiếc chén trắng, quanh là những chén gốm xếp trên bàn cạnh xô nước men đỏ; người thợ cúi đầu, không thấy mặt',
  },
  {
    photo: 'bia-hanh-thuy',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'BANNER',
    position: 0,
    alt: 'Gian hàng gốm với những kệ đầy bát, đĩa và bình men lam trắng xếp thành dãy',
  },
  {
    photo: 'ht-binh-hoa-lam-vo',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'GALLERY',
    position: 0,
    alt: 'Chiếc bình men ngà vẽ cây trúc và chim bằng nét xanh đen, miệng loe, đặt cạnh những bình khác',
    caption: 'Bình vẽ tre trúc',
  },
  {
    photo: 'ht-den-dau-su',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'GALLERY',
    position: 1,
    alt: 'Chiếc đèn dầu bằng sứ trắng vẽ rồng lam, bên cạnh những bình sứ vẽ mây',
    caption: 'Đèn dầu sứ',
  },
  {
    photo: 'ht-de-lu-chu-dau',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'GALLERY',
    position: 2,
    alt: 'Đế lư tròn men ngà có chân cuộn, vẽ chàm đậm hình đầu thú và rồng',
    caption: 'Đế lư men ngà vẽ chàm',
  },
  {
    photo: 'ht-binh-ngoc-ho-xuan',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'GALLERY',
    position: 3,
    alt: 'Bình dáng quả lê thon, thân vẽ chim bằng lam trên nền men trắng xanh nhạt',
    caption: 'Bình lê men trắng xanh',
  },
  {
    photo: 'binh-men-lam-xam',
    target: 'PRODUCT',
    key: 'BT7K2QXM',
    role: 'COVER',
    position: 0,
    alt: 'Bình gốm Bát Tràng cổ cao, bụng tròn, men xám lam, đắp nổi cành cây và một người cầm cần câu nhuốm vàng',
  },
  {
    photo: 'bat-ve-sen-men-trong',
    target: 'PRODUCT',
    key: 'HX2M9KQD',
    role: 'COVER',
    position: 0,
    alt: 'Lòng chiếc bát gốm men trong ngả ngà, giữa vẽ lam một đoá sen cách điệu có lá, viền miệng vẽ dải hoa văn nhỏ',
  },
  {
    photo: 'coc-men-trang-quai-tron',
    target: 'PRODUCT',
    key: 'DF6P3WZE',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc cốc sứ trắng thân thẳng, men bóng, quai tròn bên trái, đặt trên nền trắng',
  },
  {
    photo: 'news-cho-gom',
    target: 'NEWS',
    key: 'village-lantern',
    role: 'COVER',
    position: 0,
    alt: 'Dãy gian hàng gốm men lam trắng dưới mái xanh ở chợ gốm, bàn ghế che bạt phía trước',
  },
  {
    photo: 'ban-xoay-xuong',
    target: 'NEWS',
    key: 'h7-class',
    role: 'COVER',
    position: 0,
    alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
  },
  {
    photo: 'news-dat-set',
    target: 'NEWS',
    key: 'village-clay-month',
    role: 'COVER',
    position: 0,
    alt: 'Đống đất sét nâu đỏ chất cao trong nhà kho rộng, phía sau là hàng ngói đất nung',
  },
];

/** Ảnh minh hoạ cho từng công đoạn (không phải ảnh chụp đúng món đồ); gắn vào `JournalEntry.images`. */
export const DEMO_STAGE_PHOTOS: Readonly<Record<JournalStage, string>> = {
  clay: 'tl-clay',
  throw: 'tl-throw',
  dry: 'tl-dry',
  paint: 'tl-paint',
  glaze: 'tl-glaze',
  fire: 'tl-fire',
  finish: 'tl-finish',
};
