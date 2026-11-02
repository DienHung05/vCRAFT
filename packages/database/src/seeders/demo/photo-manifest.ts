// Hand-maintained single source of the demo photo manifest (the old export script that generated it from the
// web's static demo data is retired). Wikimedia Commons photos (CC0 / CC BY / CC BY-SA) live in
// apps/web/public/images/demo; `scripts/demo-photos/sources.json` has their origin and `pnpm demo:media` publishes them.
//
// Rule for this file: a photo may be attached to an object only when it shows that kind of object with the
// attributes in its name and description. Generic stage photos, photos of objects made elsewhere and photos of
// the wrong event are NOT attached to anything; products and news without a matching photo show a preset
// illustration instead.

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
  /** Vietnamese description of what the picture shows at this place. */
  alt: string;
  /** English description of the same; shown on `/en`. */
  altEn: string;
  caption?: string;
}

export const DEMO_PHOTOS: readonly DemoPhoto[] = [
  {
    id: 'chan-dung-minh-hai',
    alt: 'Hai bàn tay đeo ngón bọc da đang gọt chân một chiếc bát gốm trắng trên bàn xoay',
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
    alt: 'Những viên than đen ép tròn được dán kín trên một bức tường gạch cũ bên con hẻm nhỏ',
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
    alt: 'Bàn tay cầm một chiếc chén trắng, quanh là những chén gốm xếp trên bàn cạnh một xô đỏ đựng nước men trắng; người thợ cúi đầu, không thấy mặt',
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
    id: 'binh-men-lam-xam',
    alt: 'Bình cổ cao, bụng tròn, men xám lam, đắp nổi cành cây và một người cầm cần câu nhuốm vàng',
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
    id: 'ong-gom-lam-may',
    alt: 'Chiếc ống gốm Bát Tràng hình trụ cao, thân màu ngà vẽ lam hình mây cuộn, quanh miệng có một dải hoa văn hình học',
    credit: {
      title:
        'File:Tube for papers, Bat Trang ceramic - Nguyen dynasty, 19th century AD - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05329.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Tube_for_papers,_Bat_Trang_ceramic_-_Nguyen_dynasty,_19th_century_AD_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05329.JPG',
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
    alt: 'Hai bàn tay đeo ngón bọc da đang gọt chân một chiếc bát gốm trắng trên bàn xoay',
    altEn:
      "Close-up of two hands in leather finger caps trimming the foot of a white bowl on a potter's wheel",
  },
  {
    photo: 'ban-xoay-xuong',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 0,
    alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
    altEn: "Many low wooden potter's wheels scattered over the red-brick floor of a pottery studio",
    caption: 'Dãy bàn xoay trong xưởng',
  },
  {
    photo: 'ban-tay-vuot-gom',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 1,
    alt: 'Hai bàn tay đeo ngón bọc da, đang chuốt thành một chiếc bát gốm trắng trên bàn xoay',
    altEn:
      "Two hands in leather finger caps shaping a white ceramic bowl on a potter's wheel, a stack of bowls behind",
    caption: 'Bàn tay chuốt gốm',
  },
  {
    photo: 'binh-hoa-lam',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 2,
    alt: 'Hai chiếc bình sứ trắng vẽ hoa văn lam: một bình có cảnh nhà bên sông, một bình dáng lục giác',
    altEn:
      'Two white porcelain vases painted in blue: one with a riverside house scene, one with a hexagonal body',
    caption: 'Bình hoa lam',
  },
  {
    photo: 'khuon-phoi-san',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 3,
    alt: 'Các khuôn thạch cao trắng xếp thành hàng trên giá phơi ngoài sân, cạnh những khuôn đất nung đỏ',
    altEn: 'White plaster moulds in rows on a drying rack in a yard, next to red terracotta moulds',
    caption: 'Khuôn thạch cao phơi sân',
  },
  {
    photo: 'than-phoi-tuong',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 4,
    alt: 'Những viên than đen ép tròn được dán kín trên một bức tường gạch cũ bên con hẻm nhỏ',
    altEn: 'Round black coal cakes stuck all over an old brick wall beside a narrow lane',
    caption: 'Than ép phơi bên tường',
  },
  {
    photo: 'khuon-binh-lon',
    target: 'HOUSEHOLD',
    key: 'gom-minh-hai',
    role: 'GALLERY',
    position: 5,
    alt: 'Các khuôn thạch cao cao gần hai mét, buộc dây, dựng trong xưởng đúc bình lớn',
    altEn:
      'Tall plaster moulds, almost two metres high, tied with rope inside a workshop for casting large vases',
    caption: 'Khuôn đúc bình lớn',
  },
  {
    photo: 'chan-dung-lam-ngoc',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Một người thợ ngồi trên ghế nhựa vàng, nhìn nghiêng, giữa những hàng bình gốm mộc màu be trong xưởng',
    altEn:
      'A worker sitting sideways on a yellow plastic chair among rows of beige unglazed vases in a workshop',
  },
  {
    photo: 'bia-lam-ngoc',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'BANNER',
    position: 0,
    alt: 'Kệ kính bày nhiều hũ gốm quai cung đắp nổi men nâu xanh rạn nhẹ, cạnh những bình men lam trắng',
    altEn:
      'A glass shelf of many brown-green lightly crackled jars with arched handles, next to blue-and-white vases',
  },
  {
    photo: 'ln-hu-men-ngoc',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 0,
    alt: 'Chiếc hũ gốm men xanh ngọc nhạt rạn mảnh, thân tròn, miệng nhỏ, quai cung phía trên và hai quai vòng hai bên',
    altEn:
      'A pale jade-green crackle-glazed jar with a round body, a small mouth, an arched handle on top and two ring handles at the sides',
    caption: 'Chiếc hũ men ngọc',
  },
  {
    photo: 'ln-am-men-xanh',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 1,
    alt: 'Bình gốm thân men ngà loang xanh lục, quai cung xanh đậm đắp nổi hình dây leo, miệng tròn nhỏ',
    altEn:
      'A cream jar with green drip glaze, a dark green relief vine forming the arched handle, and a small round mouth',
    caption: 'Bình quai men xanh lục',
  },
  {
    photo: 'ln-bo-am-quai-ran',
    target: 'HOUSEHOLD',
    key: 'gom-lam-ngoc',
    role: 'GALLERY',
    position: 2,
    alt: 'Nhiều hũ gốm men xám nâu rạn nhẹ, quai cung đắp nổi, xếp trong tủ kính',
    altEn:
      'Several grey-brown lightly crackled jars with relief arched handles, arranged in a glass cabinet',
    caption: 'Hũ quai men rạn xám nâu',
  },
  {
    photo: 'chan-dung-duc-phat',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Người thợ ngồi quay lưng giữa nền xưởng, quanh là chậu và bình gốm mộc màu hồng, kem, bên cạnh xô nước men trắng',
    altEn:
      'A worker seen from behind, crouching on a workshop floor among pink and cream unglazed pots and basins, beside a bucket of white glaze',
  },
  {
    photo: 'bia-duc-phat',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'BANNER',
    position: 0,
    alt: 'Xưởng lớn với giàn khay gốm xếp cao, những giỏ tre và một người thợ ngồi làm việc ở xa',
    altEn:
      'A large workshop with tall racks of trays, bamboo baskets and a worker sitting far in the back',
  },
  {
    photo: 'dp-chau-nau',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 0,
    alt: 'Chậu và nồi gốm men nâu, men xám đặt cạnh rơm và rổ tre',
    altEn: 'Brown and grey glazed basins and pots beside straw and a bamboo basket',
    caption: 'Chậu men nâu',
  },
  {
    photo: 'dp-chau-dat-nung',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 1,
    alt: 'Những chiếc chậu gốm nâu cao, chạm nổi hoa văn, xếp trước một cửa hàng',
    altEn: 'Tall brown planters with relief patterns stacked in front of a shop',
    caption: 'Chậu cây gốm nâu',
  },
  {
    photo: 'dp-chum-cam',
    target: 'HOUSEHOLD',
    key: 'lo-duc-phat',
    role: 'GALLERY',
    position: 2,
    alt: 'Hàng chục bình và lọ gốm đất nung màu cam, khắc hoa văn, xếp chồng lên nhau',
    altEn: 'Dozens of orange terracotta jars and lanterns with carved patterns, piled up',
    caption: 'Gốm đất nung cam',
  },
  {
    photo: 'chan-dung-hanh-thuy',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'PORTRAIT',
    position: 0,
    alt: 'Bàn tay cầm một chiếc chén trắng, quanh là những chén gốm xếp trên bàn cạnh một xô đỏ đựng nước men trắng; người thợ cúi đầu, không thấy mặt',
    altEn:
      'A hand holding a white cup, with more cups on a table beside a red bucket of white glaze; the worker bends down, face hidden',
  },
  {
    photo: 'bia-hanh-thuy',
    target: 'HOUSEHOLD',
    key: 'gom-hanh-thuy',
    role: 'BANNER',
    position: 0,
    alt: 'Gian hàng gốm với những kệ đầy bát, đĩa và bình men lam trắng xếp thành dãy',
    altEn: 'A shop aisle with shelves full of blue-and-white bowls, plates and vases',
  },
  {
    photo: 'binh-men-lam-xam',
    target: 'PRODUCT',
    key: 'BT7K2QXM',
    role: 'COVER',
    position: 0,
    alt: 'Bình cổ cao, bụng tròn, men xám lam, đắp nổi cành cây và một người cầm cần câu nhuốm vàng',
    altEn:
      'A tall-necked, round-bellied vase in grey-blue glaze with a relief branch and a gilded figure holding a fishing rod',
  },
  {
    photo: 'ong-gom-lam-may',
    target: 'PRODUCT',
    key: '84PZKVJU',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc ống gốm Bát Tràng hình trụ cao, thân màu ngà vẽ lam hình mây cuộn, quanh miệng có một dải hoa văn hình học',
    altEn:
      'A tall cylindrical Bat Trang ceramic vessel with a cobalt-blue cloud pattern on a cream body and a geometric band around the rim',
  },
  {
    photo: 'ban-xoay-xuong',
    target: 'NEWS',
    key: 'h7-class',
    role: 'COVER',
    position: 0,
    alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
    altEn: "Many low wooden potter's wheels scattered over the red-brick floor of a pottery studio",
  },
  {
    photo: 'news-dat-set',
    target: 'NEWS',
    key: 'village-clay-month',
    role: 'COVER',
    position: 0,
    alt: 'Đống đất sét nâu đỏ chất cao trong nhà kho rộng, phía sau là hàng ngói đất nung',
    altEn:
      'A large pile of red-brown clay in a big warehouse, with orange roof tiles stacked behind it',
  },
];

/**
 * Demo products that used to carry a photo and now show a preset illustration, because no Commons photo
 * shows that exact object made in Bát Tràng: HX2M9KQD (a 15th-16th century museum bowl that Commons does not
 * call Bát Tràng ware) and DF6P3WZE (a New Zealand Crown Lynn trial cup).
 */
export const NO_COVER_DEMO_PRODUCTS: readonly string[] = ['HX2M9KQD', 'DF6P3WZE'];

/**
 * Photos that were published by earlier versions of this pipeline and must no longer exist anywhere:
 * `pnpm demo:media` deletes their `media_asset` rows and storage objects. Never attach one again.
 */
export const RETIRED_DEMO_PHOTO_IDS: readonly string[] = [
  // Origin not confirmed as Bát Tràng by Commons (only filed under "Kilns in Vietnam"):
  'bia-minh-hai',
  // Shot or made outside Bát Tràng according to Commons (Châu Thành in Đồng Tháp; Chu Đậu ware of Hải Dương):
  'ln-cua-lo-vom',
  'ht-binh-hoa-lam-vo',
  'ht-den-dau-su',
  'ht-de-lu-chu-dau',
  'ht-binh-ngoc-ho-xuan',
  'bat-ve-sen-men-trong',
  'coc-men-trang-quai-tron',
  'news-cho-gom',
  'dp-bat-xep-rom',
  'tl-clay',
  'tl-throw',
  'tl-dry',
  'tl-paint',
  'tl-glaze',
  'tl-fire',
  'tl-finish',
];

/**
 * Demo households whose banner photo was retired: `demo:media` clears their `cover_url` so cards and the map
 * show a workshop illustration instead (slugs).
 */
export const NO_COVER_DEMO_HOUSEHOLDS: readonly string[] = ['gom-minh-hai'];
