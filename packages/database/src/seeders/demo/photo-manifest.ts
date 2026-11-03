// Hand-maintained single source of the demo photo manifest (the old export script that generated it from the
// web's static demo data is retired). Licensed photos (Wikimedia Commons, museum open access, Pixabay; CC0 / public
// domain / CC BY / CC BY-SA / Pixabay licence) live in apps/web/public/images/demo; `scripts/demo-photos/sources.json`
// has their origin and `pnpm demo:media` publishes them.
//
// Rule for this file: a photo may be attached to an object only when it shows that kind of object with the
// attributes in its name and description (a product photo need not come from Bát Tràng, but its alt text must
// not claim it). Generic stage photos and photos of the wrong event are NOT attached to anything; products and
// news without a matching photo show a preset illustration instead. `pp-<trace code>` photos are product covers.

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
  {
    id: 'pp-fwmhfyfk',
    alt: 'Chiếc bát có chân thấp, men trắng vẽ lam các cánh sen và dải hoa văn chữ nhật ở miệng, trên nền tối',
    credit: {
      title: 'Lotus-Seed Bowl with Petals and Arabesques',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1953.15',
    },
    widths: [1280],
  },
  {
    id: 'pp-p6p8hrj7',
    alt: 'Chiếc bát có chân, thân màu kem vẽ lam các dải hoa văn cuộn và cánh sen, chụp trong phòng chụp',
    credit: {
      title:
        'File:Bowl with Chrysanthemum Spray, Floral Scrolls, and Lotus Petals LACMA M.84.213.215.jpg',
      author: 'Los Angeles County Museum of Art',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Bowl_with_Chrysanthemum_Spray,_Floral_Scrolls,_and_Lotus_Petals_LACMA_M.84.213.215.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-nd73b6vb',
    alt: 'Chiếc hũ có nắp, men kem vẽ lam họa tiết cuộn như hoa sen và các ô cánh sen, đặt trong tủ trưng bày',
    credit: {
      title:
        'File:Covered vase, white glaze ceramic with cobalt blue patterns - Early Le dynasty, 15th century AD - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05378.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Covered_vase,_white_glaze_ceramic_with_cobalt_blue_patterns_-_Early_Le_dynasty,_15th_century_AD_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05378.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-57rbnwya',
    alt: 'Chiếc bát có chân, men xám nhạt phủ lưới rạn dày, miệng lượn sóng, trên nền tối',
    credit: {
      title: 'Sunflower Bowl',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1957.66',
    },
    widths: [1280],
  },
  {
    id: 'pp-cppt2uxg',
    alt: 'Chiếc bát sâu lòng, men màu ngà hổ phách phủ rạn nhỏ, chụp trong tủ kính',
    credit: {
      title:
        'File:Bowl, crackled ivory white glaze ceramic - Lý dynasty, 11th-12th century AD - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05393.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Bowl,_crackled_ivory_white_glaze_ceramic_-_L%C3%BD_dynasty,_11th-12th_century_AD_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05393.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-jhnp32yg',
    alt: 'Chiếc bát nông miệng loe, men xanh ngọc nhạt rạn nhỏ khắp thân, trên nền xám',
    credit: {
      title: 'Crackle-glazed Bowl',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1921.626',
    },
    widths: [1280],
  },
  {
    id: 'pp-4dxr7bu5',
    alt: 'Chiếc bát có chân, men nâu, lòng bát tráng men trắng, thân khắc hoa lá nâu sẫm, đặt trên bệ trưng bày',
    credit: {
      title: 'File:Xixia Museum brown-glazed alms bowl with floral design.jpg',
      author: 'BabelStone',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Xixia_Museum_brown-glazed_alms_bowl_with_floral_design.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-rg8b5md7',
    alt: 'Chiếc bát miệng loe nhìn từ trên xuống, men nâu sẫm với các đốm hoa màu nâu trong lòng và vòng trắng ở đáy',
    credit: {
      title:
        'File:Bowl, China, Song dynasty, 960-1279 AD, stoneware - Östasiatiska museet, Stockholm - DSC09640.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Bowl,_China,_Song_dynasty,_960-1279_AD,_stoneware_-_%C3%96stasiatiska_museet,_Stockholm_-_DSC09640.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-3m5dk2fe',
    alt: 'Chiếc bát trà miệng loe có chân, men nâu gỉ sắt chuyển sang nâu sẫm, trên nền tối',
    credit: {
      title: 'Tea Bowl: Jian ware',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1942.126',
    },
    widths: [1280],
  },
  {
    id: 'pp-6ymrb5r4',
    alt: 'Chiếc bát trà hình nón có chân, men nâu bóng với các vệt mịn như lông thỏ, trên nền xám',
    credit: {
      title: 'Tea Bowl:  Jian Ware',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1942.132',
    },
    widths: [1280],
  },
  {
    id: 'pp-k67nbxxv',
    alt: 'Chiếc bát trà có chân, men nâu đen với các vệt xám nâu, trên nền xám',
    credit: {
      title: 'Tea Bowl',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1923.53',
    },
    widths: [1280],
  },
  {
    id: 'pp-6dugkgkb',
    alt: 'Chiếc bình rót lớn men xanh ngọc nhạt, có quai cành tre, vòi và các ô khắc măng tre, trên nền xám',
    credit: {
      title: 'Wine Ewer with Incised Bamboo Shoot Design',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1928.179',
    },
    widths: [1280],
  },
  {
    id: 'pp-e7nm6tnw',
    alt: 'Chiếc bình rót hình quả dưa men xanh ngọc, thân chia múi, quai vòng và nắp mạ vàng, trên nền xám',
    credit: {
      title: 'Melon-shaped Wine Ewer',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1928.173',
    },
    widths: [1280],
  },
  {
    id: 'pp-fjrgtt8v',
    alt: 'Chiếc bình nước cao men xanh ngọc, cổ thon, miệng loe và vòi bên hông, trên nền xám nhạt',
    credit: {
      title: 'Water Ewer for Rituals (Kundika) with Incised Parrot Design',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1921.631',
    },
    widths: [1280],
  },
  {
    id: 'pp-vfekccuh',
    alt: 'Chiếc bình tròn có nắp, hai quai vòng và vòi hình đầu rồng, men xanh ô liu, đặt trong tủ trưng bày',
    credit: {
      title:
        'File:Ewer, Ly-Tran dynasty, 11th-14th century AD, brown and celadon glazed ceramic - National Museum of Vietnamese History - Hanoi, Vietnam - DSC05514.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Ewer,_Ly-Tran_dynasty,_11th-14th_century_AD,_brown_and_celadon_glazed_ceramic_-_National_Museum_of_Vietnamese_History_-_Hanoi,_Vietnam_-_DSC05514.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-db8a2j9j',
    alt: 'Chiếc bình dẹt tròn men trắng vẽ lam, hai quai vòng, mặt trước có ô tròn họa tiết hoa sen cuộn và một lỗ tròn, viền sóng nước',
    credit: {
      title: 'File:Blue and white Chu Dau jar NMVH EDAV.jpg',
      author: 'Marie-Lan Nguyen',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Blue_and_white_Chu_Dau_jar_NMVH_EDAV.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-4hk89785',
    alt: 'Chiếc bình cao thân tròn cổ nhỏ, men xanh coban đậm, trên cổ có con thằn lằn nhỏ đắp nổi mạ vàng, đặt trên bệ',
    credit: {
      title:
        'File:20241025 Blue Glazed Vase with Coiling Dragon Design, Jiajing Reign of Ming Dynasty.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20241025_Blue_Glazed_Vase_with_Coiling_Dragon_Design,_Jiajing_Reign_of_Ming_Dynasty.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-86esm7my',
    alt: 'Chiếc bình cổ cao thân tròn men xanh, vẽ rồng hoặc sư tử màu trắng và vàng, đặt trong tủ trưng bày',
    credit: {
      title: 'File:20250809 Gongyi Museum - Blue Glazed Vase with Dancing Lions Design.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20250809_Gongyi_Museum_-_Blue_Glazed_Vase_with_Dancing_Lions_Design.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-gp2tph8h',
    alt: 'Chiếc bình hình quả lê men trắng vẽ lam một nhân vật trên sóng nước, trên nền xám',
    credit: {
      title: 'Pear-Shaped Vase',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1942.727',
    },
    widths: [1280],
  },
  {
    id: 'pp-pedznfsz',
    alt: 'Chiếc bình cổ dài men trắng vẽ lam những con sư tử và dải hoa, trên nền xám',
    credit: {
      title: 'Bottle Vase',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1942.705.1',
    },
    widths: [1280],
  },
  {
    id: 'pp-32z7mp7e',
    alt: 'Chiếc bình cổ dài thân tròn, men trắng ngà kem, trên nền đen chuyển xám',
    credit: {
      title: 'Bottle Vase: Ding ware',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1917.382',
    },
    widths: [1280],
  },
  {
    id: 'pp-b5pn4z5k',
    alt: 'Chiếc bình thon miệng loe, men trắng ngà có các cành cúc đắp nổi, trên nền xám',
    credit: {
      title: 'Flower Vase with Chrysanthemums',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2022.205',
    },
    widths: [1280],
  },
  {
    id: 'pp-344c464m',
    alt: 'Chiếc chậu nhỏ tròn có chân, men nâu bóng, trồng một cây mọng nước nhỏ có bông trắng hồng, trên nền vải đen',
    credit: {
      title: 'Caudiciform succulent in a ceramic pot (Pixabay 5428374)',
      author: 'yellow_bird',
      license: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      sourceUrl: 'https://pixabay.com/photos/cactus-succulent-plant-vase-5428374/',
    },
    widths: [1280],
  },
  {
    id: 'pp-5fz2qsgn',
    alt: 'Chiếc chậu cây thuôn dần xuống đáy, miệng gập tròn, men nâu ô liu, đặt trên nền vải xám',
    credit: {
      title: 'File:Glazed Flowerpot.jpg',
      author: 'Oser Pottery (Missouri Historical Society)',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Glazed_Flowerpot.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-5g36nhe6',
    alt: 'Chiếc chén nhỏ có chân, sứ trắng vẽ lam một con rồng giữa sóng, trên nền xám',
    credit: {
      title: 'Cup from Tea Cups with Dragons',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2022.144.1',
    },
    widths: [1280],
  },
  {
    id: 'pp-5t4byzy6',
    alt: 'Chiếc chén trà nhỏ có chân, sứ trắng vẽ lam cảnh sơn thủy, trên nền xám',
    credit: {
      title: 'Teacup from Tea Set with Chinese Landscape',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2022.171.6',
    },
    widths: [1280],
  },
  {
    id: 'pp-a22a7wac',
    alt: 'Chiếc chén trà nhỏ có chân, men trắng vẽ lam một cành lá, trên nền xám',
    credit: {
      title: 'Teacup from Tea Set with Orchids',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2022.170.2',
    },
    widths: [1280],
  },
  {
    id: 'pp-g5bmby7p',
    alt: 'Chiếc chén nhỏ tám cạnh, vẽ lam các dây hoa trong từng ô, trên nền xám nhạt',
    credit: {
      title: 'File:Achthoekige kop met bloemranken in vakdecoratie, AK-RBK-15326-B-1.jpg',
      author: 'Rijksmuseum',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Achthoekige_kop_met_bloemranken_in_vakdecoratie,_AK-RBK-15326-B-1.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-3ggterzz',
    alt: 'Chiếc chén sứ trắng ngà nhỏ, lòng chén có hoa văn nổi, viền mạ vàng, đặt trên đĩa tối màu, nền xám',
    credit: {
      title: 'File:Teacup impressed with chrysanthemum decoration in white glaze.tif',
      author: 'National Palace Museum, Taipei',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Teacup_impressed_with_chrysanthemum_decoration_in_white_glaze.tif',
    },
    widths: [1280],
  },
  {
    id: 'pp-5d23ek6n',
    alt: 'Chiếc chén nông có chân, miệng lượn cánh, men trắng ngà ánh xanh nhạt, trên nền xám',
    credit: {
      title: 'Cup and Stand (Cup)',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1980.185.a',
    },
    widths: [1280],
  },
  {
    id: 'pp-6yr6jysv',
    alt: 'Chiếc chén có chân đặt trên đế đĩa đục lỗ, men trắng ngà ánh xanh nhạt, trên nền xám',
    credit: {
      title: 'Cup and Stand',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1980.185',
    },
    widths: [1280],
  },
  {
    id: 'pp-df6p3wze',
    alt: 'Chiếc cốc men trắng trơn có quai cong, đặt trên chồng sách mở cạnh cửa sổ, ánh sáng dịu',
    credit: {
      title: 'File:A white mug sits on open books beside a window.jpg',
      author: 'Nenad Stojković (Shixart1985)',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:A_white_mug_sits_on_open_books_beside_a_window.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-9k2w6ryb',
    alt: 'Chiếc cốc sứ trắng có quai, vẽ lam cảnh có nhân vật và cây cối, trên nền xám',
    credit: {
      title: 'Chinoiserie Mug',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1972.191',
    },
    widths: [1280],
  },
  {
    id: 'pp-j657spfa',
    alt: 'Chiếc cốc cao có quai đan, thân có ô hạt gạo trong mờ giữa hai dải vẽ lam, trong tủ trưng bày',
    credit: {
      title: 'File:WLA vanda Mug with rice grain pattern.jpg',
      author: 'veronikab (Wikipedia Loves Art participant)',
      license: 'CC BY 2.5',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.5/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:WLA_vanda_Mug_with_rice_grain_pattern.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-jr7m5cwp',
    alt: 'Chiếc cốc thấp bè có con chim trên quai, men trắng vẽ lam các lá cuộn và viền vàng, trên nền xám nhạt',
    credit: {
      title: 'File:Mug (AM 614973-1).jpg',
      author: 'Auckland War Memorial Museum',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mug_(AM_614973-1).jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-422ecp7g',
    alt: 'Chiếc đĩa nhỏ viền lượn sóng, men xanh coban đậm với các nét trắng tỏa ra, trên nền xám',
    credit: {
      title: 'Small Dish (Kozara) with Fireworks',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2023.42',
    },
    widths: [1280],
  },
  {
    id: 'pp-52tb37xt',
    alt: 'Chiếc đĩa nhỏ men xanh nhạt với các chấm xanh đậm và nét cỏ, nhìn từ trên xuống trên nền vải',
    credit: {
      title:
        'File:Small dish shaped like three pots with dewdrop design, Nabeshima ware, Edo period, 1600s AD, porcelain, cobalt glaze - Tokyo National Museum - Tokyo, Japan - DSC09504.jpg',
      author: 'Daderot',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Small_dish_shaped_like_three_pots_with_dewdrop_design,_Nabeshima_ware,_Edo_period,_1600s_AD,_porcelain,_cobalt_glaze_-_Tokyo_National_Museum_-_Tokyo,_Japan_-_DSC09504.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-dpus5949',
    alt: 'Chiếc chén trắng đặt trên đĩa lót, vẽ lam các dải viền và nét cảnh núi, trên nền xám tím',
    credit: {
      title: 'Cup and Saucer (Tasse et soucoupe)',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1964.505',
    },
    widths: [1280],
  },
  {
    id: 'pp-jqfh8tgr',
    alt: 'Chiếc đĩa lót tròn men trắng, giữa có gờ nổi để đặt chén, viền vẽ lam, trên nền tối',
    credit: {
      title: 'Saucer',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1972.189.b',
    },
    widths: [1280],
  },
  {
    id: 'pp-9tsrxd9d',
    alt: 'Chiếc đĩa sứ trắng tròn, viền lượn sóng có hoa văn cuộn nổi, đặt trên tấm khăn móc màu xanh',
    credit: {
      title: 'File:2024.01.21 Rosenthal White Porcelain Louise XIV Plate.jpg',
      author: 'Dina Panayotis',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:2024.01.21_Rosenthal_White_Porcelain_Louise_XIV_Plate.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-e8uzvyg4',
    alt: 'Chiếc đĩa tròn men trắng ngà xám có hoa văn cuộn khắc chìm, một đường nứt đã được gắn lại ở viền',
    credit: {
      title: 'Dish with Incised Scroll Design',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1921.644',
    },
    widths: [1280],
  },
  {
    id: 'pp-362hsd3h',
    alt: 'Chiếc đĩa sứ trắng tròn có viền lượn sóng đắp nổi, giữa vẽ lam cảnh thông và hồ, trên nền xám',
    credit: {
      title: 'Large Dish with Landscape',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2020.196',
    },
    widths: [1280],
  },
  {
    id: 'pp-aftavv92',
    alt: 'Chiếc đĩa sứ trắng tròn vẽ lam hình con dơi và hoa sen cuộn ở giữa, dựng trên giá trước tấm vải',
    credit: {
      title: 'File:20241025 Blue and White Porcelain Plate, Qianlong Reign of Qing Dynasty.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20241025_Blue_and_White_Porcelain_Plate,_Qianlong_Reign_of_Qing_Dynasty.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-mf52jtdn',
    alt: 'Chiếc đĩa sứ trắng vẽ lam bó hoa sen ở giữa và dây hoa xung quanh, đặt trên giá gỗ',
    credit: {
      title: 'File:20241025 Blue and White Porcelain Plate of Yongle Reign, Ming Dynasty.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20241025_Blue_and_White_Porcelain_Plate_of_Yongle_Reign,_Ming_Dynasty.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-v5d6n6z3',
    alt: 'Chiếc đĩa rộng vẽ lam dây hoa sen cuộn và sao biển, chụp dưới ánh sáng vàng trong tủ trưng bày',
    credit: {
      title:
        'File:20241025 Blue and White Porcelain Plate with Interlocking Lotus Design and Yongle Reign Mark, Ming Dynasty.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20241025_Blue_and_White_Porcelain_Plate_with_Interlocking_Lotus_Design_and_Yongle_Reign_Mark,_Ming_Dynasty.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-y4rh3t7g',
    alt: 'Chiếc đĩa rộng nông vẽ lam bó sen ở giữa, nhìn nghiêng, đặt trên giá kính',
    credit: {
      title:
        'File:20241018 Blue and White Porcelain Plate with Lotuses Design, Xuande Reign of Ming Dynasty 01.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20241018_Blue_and_White_Porcelain_Plate_with_Lotuses_Design,_Xuande_Reign_of_Ming_Dynasty_01.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-3z5a5a8n',
    alt: 'Chiếc đĩa sứ trắng tròn lớn, viền lượn sóng, rải các cành hoa nhỏ màu đỏ, xanh lam và xanh lá, trên nền xám',
    credit: {
      title: 'Small Dish with Flowers',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1989.259',
    },
    widths: [1280],
  },
  {
    id: 'pp-a7j3y9me',
    alt: 'Chiếc hũ thấp bè cổ ngắn, men trắng xám rạn nhỏ, vẽ nâu các dây hoa cuộn quanh thân, trên nền xám',
    credit: {
      title: 'File:Jarlet with Cursive Floral Scroll LACMA M.84.213.226.jpg',
      author: 'Los Angeles County Museum of Art',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Jarlet_with_Cursive_Floral_Scroll_LACMA_M.84.213.226.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-e2vqydj2',
    alt: 'Chiếc hũ miệng rộng viền cánh hoa, thân chia ô khắc hoa sen và dây hoa nâu trên men xám kem, trên nền đen',
    credit: {
      title: 'File:National Museum Vietnamese History 29 (cropped).jpg',
      author: 'Gryffindor (derivative of National Museum Vietnamese History 29.jpg)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:National_Museum_Vietnamese_History_29_(cropped).jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-ey3x2ykq',
    alt: 'Chiếc hũ cao thân thẳng men vàng kem, các ô đắp nổi hoa sen và dây hoa nâu',
    credit: {
      title:
        'File:Storage jar with lotus and wave motifs, Thang Long citadel, Hanoi, Tran to Le So dynasty, 14th-15th century AD, pattern brown glazed ceramic - National Museum of Vietnamese History - Hanoi, Vietnam - DSC05503.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Storage_jar_with_lotus_and_wave_motifs,_Thang_Long_citadel,_Hanoi,_Tran_to_Le_So_dynasty,_14th-15th_century_AD,_pattern_brown_glazed_ceramic_-_National_Museum_of_Vietnamese_History_-_Hanoi,_Vietnam_-_DSC05503.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-2vdawxnx',
    alt: 'Chiếc hũ thân tròn cổ ngắn phủ men nâu hổ phách bóng, đắp nổi rồng và mây, trong tủ trưng bày',
    credit: {
      title:
        'File:Pot, Bien Hoa ceramic, brown glaze - Nguyen dynasty, 19th century AD - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05300.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Pot,_Bien_Hoa_ceramic,_brown_glaze_-_Nguyen_dynasty,_19th_century_AD_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05300.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-bu4ymz85',
    alt: 'Chiếc hũ gốm thấp bè miệng rộng viền cuộn, bốn quai vòng, thân có gờ, men nâu ô liu loang, trên nền xám tối',
    credit: {
      title: 'File:Jar LACMA M.84.213.256.jpg',
      author: 'Los Angeles County Museum of Art',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jar_LACMA_M.84.213.256.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-5ma8ha8g',
    alt: 'Chiếc lọ cao miệng loe nhỏ, men nâu sẫm khắc hoa mẫu đơn để lộ nền đất sáng, đặt trong tủ trưng bày',
    credit: {
      title: 'File:20260520 Brown-Glazed Vase with Carved Peony Patterns.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20260520_Brown-Glazed_Vase_with_Carved_Peony_Patterns.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-bgzyypnt',
    alt: 'Chiếc lọ thân tròn cổ ngắn miệng loe có gờ, men xanh xám vẽ dây hoa màu nâu, trên nền xám',
    credit: {
      title: 'Vase with Floral Design',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1919.655',
    },
    widths: [1280],
  },
  {
    id: 'pp-5nx28yma',
    alt: 'Chiếc lọ men nâu bóng, miệng loe nhẹ, vẽ các bông hoa màu cam nâu, trên nền xám',
    credit: {
      title: 'File:Vase (USA), 1900 (CH 18457571).jpg',
      author: 'Rookwood Pottery (Cooper Hewitt, Smithsonian Design Museum)',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vase_(USA),_1900_(CH_18457571).jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-a2sbgf7h',
    alt: 'Chiếc lư hương ba chân miệng rộng, men nâu đen bóng, trên nền xanh xám nhạt',
    credit: {
      title: 'Incense Burner: Jizhou ware',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1969.66',
    },
    widths: [1280],
  },
  {
    id: 'pp-bs4mgesk',
    alt: 'Chiếc lư hương hình quả bầu cổ ngắn, vai đắp nổi hình người, men nâu đỏ mờ, trên nền xám',
    credit: {
      title: 'File:Jokei IncenseBurner pre1635 20180824 NationalmuseumTokio 1.jpg',
      author: 'Zenwort (object by Jōkei)',
      license: 'Public domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Jokei_IncenseBurner_pre1635_20180824_NationalmuseumTokio_1.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-3zmybv5u',
    alt: 'Chiếc bình cao hình vuông có hai quai, men xanh nhạt đều, các ô đắp nổi hoa văn, trước tấm vải màu kem',
    credit: {
      title:
        'File:20241025 Greyish Blue Glazed Porcelain Square Vase, Qianlong Reign of Qing Dynasty.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20241025_Greyish_Blue_Glazed_Porcelain_Square_Vase,_Qianlong_Reign_of_Qing_Dynasty.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-agkgpseg',
    alt: 'Chiếc bình cao hình trụ phình miệng cánh hoa, men xanh da trời loang chuyển xanh đậm, trong tủ trưng bày',
    credit: {
      title: 'File:20260520 Sky Blue Glazed Porcelain Vase with Petal Mouth, Jun Kiln.jpg',
      author: 'Windmemories',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:20260520_Sky_Blue_Glazed_Porcelain_Vase_with_Petal_Mouth,_Jun_Kiln.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-amf85x49',
    alt: 'Chiếc ống hình trụ sứ trắng vẽ lam cảnh núi và hồ, trên nền tối',
    credit: {
      title: 'Brush Pot with Landscape',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1989.307',
    },
    widths: [1280],
  },
  {
    id: 'pp-bnux83x4',
    alt: 'Chiếc ống rộng thân hơi thắt, vẽ lam cảnh khu vườn có nhân vật, trên nền xám',
    credit: {
      title: 'Brush Pot with Episode from Life on Sima Guang',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1964.179',
    },
    widths: [1280],
  },
  {
    id: 'pp-hqqgrf67',
    alt: 'Cận cảnh chiếc ống sứ trắng vẽ lam cảnh sông nước, nền sáng',
    credit: {
      title:
        'File:Brush holder, early 18th century, Chinese, hard-paste porcelain, Honolulu Museum of Art.JPG',
      author: 'Hiart',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Brush_holder,_early_18th_century,_Chinese,_hard-paste_porcelain,_Honolulu_Museum_of_Art.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-u39kntt8',
    alt: 'Chiếc ống hình trụ vẽ lam các nhân vật mặc trang phục châu Âu trong từng ô, viền chữ nhật, đặt trong tủ trưng bày',
    credit: {
      title:
        'File:Brush holder with Dutchmen, Japan, Arita ware, late 18th to early 19th century, underglaze blue on porcelain - Östasiatiska museet, Stockholm - DSC09171.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Brush_holder_with_Dutchmen,_Japan,_Arita_ware,_late_18th_to_early_19th_century,_underglaze_blue_on_porcelain_-_%C3%96stasiatiska_museet,_Stockholm_-_DSC09171.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-4nqzd98g',
    alt: 'Chiếc tô hình nón rộng, men xanh ngọc rạn nhỏ, trên nền xám',
    credit: {
      title: 'Bowl with Flowering Vines Design in Relief',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1928.175',
    },
    widths: [1280],
  },
  {
    id: 'pp-75aczu2w',
    alt: 'Chiếc tô sâu lòng tròn trịa, men xanh lục rạn nhỏ khắp thân, trên nền xám',
    credit: {
      title: 'Celadon Bowl',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2025.179',
    },
    widths: [1280],
  },
  {
    id: 'pp-78dwbkhw',
    alt: 'Chiếc tô có chân, men xanh ngọc nhạt, thân khắc đường cánh sen, trên nền tối',
    credit: {
      title: 'Bowl with Carved Lotus Design',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2020.181',
    },
    widths: [1280],
  },
  {
    id: 'pp-cef77ydk',
    alt: 'Chiếc tô có chân, men xanh ô liu, mặt ngoài khắc đường cánh sen, trên nền xám',
    credit: {
      title: 'Bowl with Lotus Petal Design in Relief',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1942.721',
    },
    widths: [1280],
  },
  {
    id: 'pp-y9mp5ajq',
    alt: 'Chiếc tô sâu lòng có chân, men xanh xám, thân khắc đường lá, chân để mộc, trên nền xám',
    credit: {
      title: 'Bowl',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/1930.308',
    },
    widths: [1280],
  },
  {
    id: 'pp-87zfuqmm',
    alt: 'Chiếc tô có chân, men trắng kem vẽ lam xám các dây cuộn và dải hoa, trên nền xám nhạt',
    credit: {
      title: 'File:Klokvormige kom met bloemranken, AK-RAK-1971-7.jpg',
      author: 'Rijksmuseum',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Klokvormige_kom_met_bloemranken,_AK-RAK-1971-7.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-ha8cys37',
    alt: 'Chiếc tô sâu lòng phủ men xanh đậm, nổi các con cò trắng và cành liễu trong tuyết, trên nền xám',
    credit: {
      title: 'Sweets Bowl with Egrets and Willow in Snow',
      author: 'Cleveland Museum of Art',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: 'https://clevelandart.org/art/2022.154',
    },
    widths: [1280],
  },
  {
    id: 'pp-hbfm9jqu',
    alt: 'Chiếc tô có chân nhìn từ trên xuống, miệng viền chữ nhật xanh, lòng có dải cánh sen và dây lá, nền sáng',
    credit: {
      title: 'File:Blue and white bowl Jingdezhen Ming Yongle 1403 1424.jpg',
      author: 'World Imaging',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Blue_and_white_bowl_Jingdezhen_Ming_Yongle_1403_1424.jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-j26na3d8',
    alt: 'Chiếc tô tròn vẽ lam xám cảnh chùa và cây thông, viền ô lưới, đặt trên kệ trưng bày',
    credit: {
      title:
        'File:Blue and White Bowl from a Shipwreck, Jingdezhen, Qing, c. 1750 (9847366343).jpg',
      author: 'Gary Todd',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Blue_and_White_Bowl_from_a_Shipwreck,_Jingdezhen,_Qing,_c._1750_(9847366343).jpg',
    },
    widths: [1280],
  },
  {
    id: 'pp-8j6uyuxr',
    alt: 'Chiếc âu có nắp phẳng gờ rộng, men xanh vàng nhạt, đặt trước nền xanh xám',
    credit: {
      title:
        'File:Tureen, celadon glaze ceramic - Lý dynasty, 11th-12th century AD - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05384.JPG',
      author: 'Daderot',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Tureen,_celadon_glaze_ceramic_-_L%C3%BD_dynasty,_11th-12th_century_AD_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05384.JPG',
    },
    widths: [1280],
  },
  {
    id: 'pp-b2mbkja9',
    alt: 'Chiếc âu tròn thấp có nắp, men xanh lục, thân đắp nổi dây hoa mẫu đơn và dải hạt, trên nền tối',
    credit: {
      title: 'File:Vietnam 14th C - Celadon jar Museum of Asian Civilisation.jpg',
      author: 'Asian Civilisations Museum, Singapore',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Vietnam_14th_C_-_Celadon_jar_Museum_of_Asian_Civilisation.jpg',
    },
    widths: [1280],
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
  {
    photo: 'pp-fwmhfyfk',
    target: 'PRODUCT',
    key: 'FWMHFYFK',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát có chân thấp, men trắng vẽ lam các cánh sen và dải hoa văn chữ nhật ở miệng, trên nền tối',
    altEn:
      'A footed white bowl painted in cobalt blue with lotus-petal panels and a key-pattern band at the rim, on a dark background',
  },
  {
    photo: 'pp-p6p8hrj7',
    target: 'PRODUCT',
    key: 'P6P8HRJ7',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát có chân, thân màu kem vẽ lam các dải hoa văn cuộn và cánh sen, chụp trong phòng chụp',
    altEn:
      'A footed cream-coloured bowl painted in blue with scrolling bands and lotus petals, photographed in a studio',
  },
  {
    photo: 'pp-nd73b6vb',
    target: 'PRODUCT',
    key: 'ND73B6VB',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc hũ có nắp, men kem vẽ lam họa tiết cuộn như hoa sen và các ô cánh sen, đặt trong tủ trưng bày',
    altEn:
      'A lidded jar with a cream glaze painted in blue with lotus-like scrolls and petal panels, in a display case',
  },
  {
    photo: 'pp-57rbnwya',
    target: 'PRODUCT',
    key: '57RBNWYA',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát có chân, men xám nhạt phủ lưới rạn dày, miệng lượn sóng, trên nền tối',
    altEn:
      'A footed bowl with a pale grey glaze covered in dense crackle and a lobed rim, on a dark background',
  },
  {
    photo: 'pp-cppt2uxg',
    target: 'PRODUCT',
    key: 'CPPT2UXG',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát sâu lòng, men màu ngà hổ phách phủ rạn nhỏ, chụp trong tủ kính',
    altEn:
      'A deep bowl with an amber-ivory glaze covered in fine crackle, photographed in a glass case',
  },
  {
    photo: 'pp-jhnp32yg',
    target: 'PRODUCT',
    key: 'JHNP32YG',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát nông miệng loe, men xanh ngọc nhạt rạn nhỏ khắp thân, trên nền xám',
    altEn:
      'A shallow flared bowl with a pale green glaze and fine crackle all over, on a grey background',
  },
  {
    photo: 'pp-4dxr7bu5',
    target: 'PRODUCT',
    key: '4DXR7BU5',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát có chân, men nâu, lòng bát tráng men trắng, thân khắc hoa lá nâu sẫm, đặt trên bệ trưng bày',
    altEn:
      'A footed brown-glazed bowl with a white interior and dark brown leaf and flower designs carved into the body, on a display plinth',
  },
  {
    photo: 'pp-rg8b5md7',
    target: 'PRODUCT',
    key: 'RG8B5MD7',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát miệng loe nhìn từ trên xuống, men nâu sẫm với các đốm hoa màu nâu trong lòng và vòng trắng ở đáy',
    altEn:
      'A flared bowl seen from above, with a dark brown glaze, brown flower-like spots inside and a white ring at the bottom',
  },
  {
    photo: 'pp-3m5dk2fe',
    target: 'PRODUCT',
    key: '3M5DK2FE',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát trà miệng loe có chân, men nâu gỉ sắt chuyển sang nâu sẫm, trên nền tối',
    altEn:
      'A flared footed tea bowl with a rust-brown glaze fading to dark brown, on a dark gradient background',
  },
  {
    photo: 'pp-6ymrb5r4',
    target: 'PRODUCT',
    key: '6YMRB5R4',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát trà hình nón có chân, men nâu bóng với các vệt mịn như lông thỏ, trên nền xám',
    altEn:
      'A conical footed tea bowl with a glossy brown glaze and fine streaks, on a grey background',
  },
  {
    photo: 'pp-k67nbxxv',
    target: 'PRODUCT',
    key: 'K67NBXXV',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bát trà có chân, men nâu đen với các vệt xám nâu, trên nền xám',
    altEn:
      'A footed tea bowl with a dark brown-black glaze mottled with grey-brown, on a grey background',
  },
  {
    photo: 'pp-6dugkgkb',
    target: 'PRODUCT',
    key: '6DUGKGKB',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình rót lớn men xanh ngọc nhạt, có quai cành tre, vòi và các ô khắc măng tre, trên nền xám',
    altEn:
      'A large pale green celadon ewer with a bamboo-branch handle, a spout and incised bamboo-shoot panels, on a grey background',
  },
  {
    photo: 'pp-e7nm6tnw',
    target: 'PRODUCT',
    key: 'E7NM6TNW',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình rót hình quả dưa men xanh ngọc, thân chia múi, quai vòng và nắp mạ vàng, trên nền xám',
    altEn:
      'A melon-shaped celadon ewer with a ribbed body, a loop handle and a gilded lid, on a grey background',
  },
  {
    photo: 'pp-fjrgtt8v',
    target: 'PRODUCT',
    key: 'FJRGTT8V',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình nước cao men xanh ngọc, cổ thon, miệng loe và vòi bên hông, trên nền xám nhạt',
    altEn:
      'A tall celadon water ewer with a slender neck, a flared top and a side spout, on a light grey background',
  },
  {
    photo: 'pp-vfekccuh',
    target: 'PRODUCT',
    key: 'VFEKCCUH',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình tròn có nắp, hai quai vòng và vòi hình đầu rồng, men xanh ô liu, đặt trong tủ trưng bày',
    altEn:
      'A round lidded ewer with two loop handles and a dragon-head spout in an olive-green celadon glaze, in a display case',
  },
  {
    photo: 'pp-db8a2j9j',
    target: 'PRODUCT',
    key: 'DB8A2J9J',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình dẹt tròn men trắng vẽ lam, hai quai vòng, mặt trước có ô tròn họa tiết hoa sen cuộn và một lỗ tròn, viền sóng nước',
    altEn:
      'A round flat blue-and-white flask with two loop handles, a front medallion of lotus scrolls with a round opening, and a wave border',
  },
  {
    photo: 'pp-4hk89785',
    target: 'PRODUCT',
    key: '4HK89785',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình cao thân tròn cổ nhỏ, men xanh coban đậm, trên cổ có con thằn lằn nhỏ đắp nổi mạ vàng, đặt trên bệ',
    altEn:
      'A tall bottle vase with a round body and narrow neck in deep cobalt-blue glaze, with a small gilded lizard in relief on the neck, on a plinth',
  },
  {
    photo: 'pp-86esm7my',
    target: 'PRODUCT',
    key: '86ESM7MY',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình cổ cao thân tròn men xanh, vẽ rồng hoặc sư tử màu trắng và vàng, đặt trong tủ trưng bày',
    altEn:
      'A tall-necked round-bellied bottle vase in blue glaze, painted with white and gold dragons or lions, in a display case',
  },
  {
    photo: 'pp-gp2tph8h',
    target: 'PRODUCT',
    key: 'GP2TPH8H',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình hình quả lê men trắng vẽ lam một nhân vật trên sóng nước, trên nền xám',
    altEn:
      'A pear-shaped bottle vase of white porcelain painted in cobalt blue with a figure on waves, on a grey background',
  },
  {
    photo: 'pp-pedznfsz',
    target: 'PRODUCT',
    key: 'PEDZNFSZ',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình cổ dài men trắng vẽ lam những con sư tử và dải hoa, trên nền xám',
    altEn:
      'A long-necked bottle vase of white porcelain painted in cobalt blue with lions and a band of flowers, on a grey background',
  },
  {
    photo: 'pp-32z7mp7e',
    target: 'PRODUCT',
    key: '32Z7MP7E',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình cổ dài thân tròn, men trắng ngà kem, trên nền đen chuyển xám',
    altEn:
      'A tall bottle vase with a long neck and a rounded body in a creamy ivory-white glaze, on a black-to-grey background',
  },
  {
    photo: 'pp-b5pn4z5k',
    target: 'PRODUCT',
    key: 'B5PN4Z5K',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình thon miệng loe, men trắng ngà có các cành cúc đắp nổi, trên nền xám',
    altEn:
      'A slender vase with a flared mouth in an ivory-white glaze with relief chrysanthemum sprays, on a grey background',
  },
  {
    photo: 'pp-344c464m',
    target: 'PRODUCT',
    key: '344C464M',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chậu nhỏ tròn có chân, men nâu bóng, trồng một cây mọng nước nhỏ có bông trắng hồng, trên nền vải đen',
    altEn:
      'A small round footed pot in a glossy brown glaze holding a young succulent with a white-pink flower, on a black cloth',
  },
  {
    photo: 'pp-5fz2qsgn',
    target: 'PRODUCT',
    key: '5FZ2QSGN',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chậu cây thuôn dần xuống đáy, miệng gập tròn, men nâu ô liu, đặt trên nền vải xám',
    altEn: 'A tapered flower pot with a rolled rim in an olive-brown glaze, on a grey cloth',
  },
  {
    photo: 'pp-5g36nhe6',
    target: 'PRODUCT',
    key: '5G36NHE6',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén nhỏ có chân, sứ trắng vẽ lam một con rồng giữa sóng, trên nền xám',
    altEn:
      'A small footed cup of white porcelain painted in cobalt blue with a dragon among waves, on a grey background',
  },
  {
    photo: 'pp-5t4byzy6',
    target: 'PRODUCT',
    key: '5T4BYZY6',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén trà nhỏ có chân, sứ trắng vẽ lam cảnh sơn thủy, trên nền xám',
    altEn:
      'A small footed teacup of white porcelain with a blue landscape painting, on a grey background',
  },
  {
    photo: 'pp-a22a7wac',
    target: 'PRODUCT',
    key: 'A22A7WAC',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén trà nhỏ có chân, men trắng vẽ lam một cành lá, trên nền xám',
    altEn:
      'A small footed teacup with a blue-painted leafy branch on a white glaze, on a grey background',
  },
  {
    photo: 'pp-g5bmby7p',
    target: 'PRODUCT',
    key: 'G5BMBY7P',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén nhỏ tám cạnh, vẽ lam các dây hoa trong từng ô, trên nền xám nhạt',
    altEn:
      'A small eight-sided cup with blue-painted flower scrolls in panels, on a light grey background',
  },
  {
    photo: 'pp-3ggterzz',
    target: 'PRODUCT',
    key: '3GGTERZZ',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén sứ trắng ngà nhỏ, lòng chén có hoa văn nổi, viền mạ vàng, đặt trên đĩa tối màu, nền xám',
    altEn:
      'A small ivory-white porcelain cup with relief decoration inside and a gilt rim, resting on a dark saucer-shaped plate, on a grey background',
  },
  {
    photo: 'pp-5d23ek6n',
    target: 'PRODUCT',
    key: '5D23EK6N',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén nông có chân, miệng lượn cánh, men trắng ngà ánh xanh nhạt, trên nền xám',
    altEn:
      'A shallow footed cup with a lobed rim in a pale ivory-green glaze, on a grey gradient background',
  },
  {
    photo: 'pp-6yr6jysv',
    target: 'PRODUCT',
    key: '6YR6JYSV',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén có chân đặt trên đế đĩa đục lỗ, men trắng ngà ánh xanh nhạt, trên nền xám',
    altEn:
      'A footed cup on a pierced saucer stand in a pale ivory-green glaze, on a grey gradient background',
  },
  {
    photo: 'pp-df6p3wze',
    target: 'PRODUCT',
    key: 'DF6P3WZE',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc cốc men trắng trơn có quai cong, đặt trên chồng sách mở cạnh cửa sổ, ánh sáng dịu',
    altEn:
      'A plain white glazed mug with a curved loop handle standing on a stack of open books beside a window, in soft light',
  },
  {
    photo: 'pp-9k2w6ryb',
    target: 'PRODUCT',
    key: '9K2W6RYB',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc cốc sứ trắng có quai, vẽ lam cảnh có nhân vật và cây cối, trên nền xám',
    altEn:
      'A white porcelain mug with a loop handle, painted in blue with a scene of figures and plants, on a grey background',
  },
  {
    photo: 'pp-j657spfa',
    target: 'PRODUCT',
    key: 'J657SPFA',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc cốc cao có quai đan, thân có ô hạt gạo trong mờ giữa hai dải vẽ lam, trong tủ trưng bày',
    altEn:
      'A tall mug with a woven loop handle and a translucent rice-grain panel between blue-painted bands, in a display case',
  },
  {
    photo: 'pp-jr7m5cwp',
    target: 'PRODUCT',
    key: 'JR7M5CWP',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc cốc thấp bè có con chim trên quai, men trắng vẽ lam các lá cuộn và viền vàng, trên nền xám nhạt',
    altEn:
      'A squat mug with a small bird on its handle, white with blue leaf scrolls and gilt lines, on a light grey background',
  },
  {
    photo: 'pp-422ecp7g',
    target: 'PRODUCT',
    key: '422ECP7G',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa nhỏ viền lượn sóng, men xanh coban đậm với các nét trắng tỏa ra, trên nền xám',
    altEn:
      'A small lobed dish with a deep cobalt-blue glaze and white radiating strokes, on a grey gradient background',
  },
  {
    photo: 'pp-52tb37xt',
    target: 'PRODUCT',
    key: '52TB37XT',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa nhỏ men xanh nhạt với các chấm xanh đậm và nét cỏ, nhìn từ trên xuống trên nền vải',
    altEn:
      'A small dish in a light-blue glaze with dark-blue dots and grass lines, seen from above on a woven cloth',
  },
  {
    photo: 'pp-dpus5949',
    target: 'PRODUCT',
    key: 'DPUS5949',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc chén trắng đặt trên đĩa lót, vẽ lam các dải viền và nét cảnh núi, trên nền xám tím',
    altEn:
      'A white cup on a saucer painted in blue bands and landscape strokes, on a grey-purple background',
  },
  {
    photo: 'pp-jqfh8tgr',
    target: 'PRODUCT',
    key: 'JQFH8TGR',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa lót tròn men trắng, giữa có gờ nổi để đặt chén, viền vẽ lam, trên nền tối',
    altEn:
      'A round white saucer with a raised ring in the centre for a cup and a blue-painted border, on a dark background',
  },
  {
    photo: 'pp-9tsrxd9d',
    target: 'PRODUCT',
    key: '9TSRXD9D',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa sứ trắng tròn, viền lượn sóng có hoa văn cuộn nổi, đặt trên tấm khăn móc màu xanh',
    altEn:
      'A round white porcelain plate with a scalloped rim and relief scrolls, lying on a blue crocheted cloth',
  },
  {
    photo: 'pp-e8uzvyg4',
    target: 'PRODUCT',
    key: 'E8UZVYG4',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa tròn men trắng ngà xám có hoa văn cuộn khắc chìm, một đường nứt đã được gắn lại ở viền',
    altEn:
      'A round dish with a pale ivory-grey glaze and incised scrolls, with a repaired crack along the rim, seen from above',
  },
  {
    photo: 'pp-362hsd3h',
    target: 'PRODUCT',
    key: '362HSD3H',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa sứ trắng tròn có viền lượn sóng đắp nổi, giữa vẽ lam cảnh thông và hồ, trên nền xám',
    altEn:
      'A round white porcelain dish with a scalloped moulded rim and a blue-painted pine and lake scene in the centre, on a grey gradient background',
  },
  {
    photo: 'pp-aftavv92',
    target: 'PRODUCT',
    key: 'AFTAVV92',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa sứ trắng tròn vẽ lam hình con dơi và hoa sen cuộn ở giữa, dựng trên giá trước tấm vải',
    altEn:
      'A round blue-and-white porcelain plate with a bat and lotus scrolls in the centre, standing on a stand in front of a linen cloth',
  },
  {
    photo: 'pp-mf52jtdn',
    target: 'PRODUCT',
    key: 'MF52JTDN',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa sứ trắng vẽ lam bó hoa sen ở giữa và dây hoa xung quanh, đặt trên giá gỗ',
    altEn:
      'A round blue-and-white plate with a lotus bouquet in the centre and floral scrolls around it, on a wooden stand',
  },
  {
    photo: 'pp-v5d6n6z3',
    target: 'PRODUCT',
    key: 'V5D6N6Z3',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa rộng vẽ lam dây hoa sen cuộn và sao biển, chụp dưới ánh sáng vàng trong tủ trưng bày',
    altEn:
      'A wide blue-and-white plate with interlocking lotus scrolls and starfish, seen in a yellow-lit display',
  },
  {
    photo: 'pp-y4rh3t7g',
    target: 'PRODUCT',
    key: 'Y4RH3T7G',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa rộng nông vẽ lam bó sen ở giữa, nhìn nghiêng, đặt trên giá kính',
    altEn:
      'A wide shallow blue-and-white dish with a lotus bouquet in the centre, seen from the side on a clear stand',
  },
  {
    photo: 'pp-3z5a5a8n',
    target: 'PRODUCT',
    key: '3Z5A5A8N',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc đĩa sứ trắng tròn lớn, viền lượn sóng, rải các cành hoa nhỏ màu đỏ, xanh lam và xanh lá, trên nền xám',
    altEn:
      'A large round white porcelain plate with a scalloped rim and small scattered red, blue and green flower sprigs, on a grey gradient background',
  },
  {
    photo: 'pp-a7j3y9me',
    target: 'PRODUCT',
    key: 'A7J3Y9ME',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc hũ thấp bè cổ ngắn, men trắng xám rạn nhỏ, vẽ nâu các dây hoa cuộn quanh thân, trên nền xám',
    altEn:
      'A squat jar with a short neck, a grey-white crackled glaze and brown cursive flower scrolls painted around the body, on a grey background',
  },
  {
    photo: 'pp-e2vqydj2',
    target: 'PRODUCT',
    key: 'E2VQYDJ2',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc hũ miệng rộng viền cánh hoa, thân chia ô khắc hoa sen và dây hoa nâu trên men xám kem, trên nền đen',
    altEn:
      'A wide-mouthed jar with a petal-crown rim and carved panels of lotus and floral scrolls in brown on a grey-cream glaze, on a black background',
  },
  {
    photo: 'pp-ey3x2ykq',
    target: 'PRODUCT',
    key: 'EY3X2YKQ',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc hũ cao thân thẳng men vàng kem, các ô đắp nổi hoa sen và dây hoa nâu',
    altEn:
      'A tall straight-sided jar in a cream-yellow glaze with relief panels of brown lotus and floral scrolls',
  },
  {
    photo: 'pp-2vdawxnx',
    target: 'PRODUCT',
    key: '2VDAWXNX',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc hũ thân tròn cổ ngắn phủ men nâu hổ phách bóng, đắp nổi rồng và mây, trong tủ trưng bày',
    altEn:
      'A round-bodied jar with a short neck covered in a glossy amber-brown glaze with relief dragons and clouds, in a display case',
  },
  {
    photo: 'pp-bu4ymz85',
    target: 'PRODUCT',
    key: 'BU4YMZ85',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc hũ gốm thấp bè miệng rộng viền cuộn, bốn quai vòng, thân có gờ, men nâu ô liu loang, trên nền xám tối',
    altEn:
      'A squat stoneware jar with a wide rolled rim, four loop handles and a ribbed body in a mottled olive-brown glaze, on a dark grey background',
  },
  {
    photo: 'pp-5ma8ha8g',
    target: 'PRODUCT',
    key: '5MA8HA8G',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc lọ cao miệng loe nhỏ, men nâu sẫm khắc hoa mẫu đơn để lộ nền đất sáng, đặt trong tủ trưng bày',
    altEn:
      'A tall vase with a small flared lip, a dark brown glaze and a carved peony pattern showing the pale clay body, in a display',
  },
  {
    photo: 'pp-bgzyypnt',
    target: 'PRODUCT',
    key: 'BGZYYPNT',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc lọ thân tròn cổ ngắn miệng loe có gờ, men xanh xám vẽ dây hoa màu nâu, trên nền xám',
    altEn:
      'A rounded vase with a short flared neck and a rim ring, a grey-green glaze and a brown painted flower scroll, on a grey background',
  },
  {
    photo: 'pp-5nx28yma',
    target: 'PRODUCT',
    key: '5NX28YMA',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc lọ men nâu bóng, miệng loe nhẹ, vẽ các bông hoa màu cam nâu, trên nền xám',
    altEn:
      'A glossy brown-glazed vase with a slightly flared mouth and painted orange-brown flowers, on a plain grey background',
  },
  {
    photo: 'pp-a2sbgf7h',
    target: 'PRODUCT',
    key: 'A2SBGF7H',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc lư hương ba chân miệng rộng, men nâu đen bóng, trên nền xanh xám nhạt',
    altEn:
      'A wide-rimmed tripod incense burner with a dark brown-black glossy glaze, on a pale blue-grey background',
  },
  {
    photo: 'pp-bs4mgesk',
    target: 'PRODUCT',
    key: 'BS4MGESK',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc lư hương hình quả bầu cổ ngắn, vai đắp nổi hình người, men nâu đỏ mờ, trên nền xám',
    altEn:
      'A gourd-shaped incense burner with a short neck and relief figures on the shoulder in a matte reddish-brown glaze, on a plain grey background',
  },
  {
    photo: 'pp-3zmybv5u',
    target: 'PRODUCT',
    key: '3ZMYBV5U',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình cao hình vuông có hai quai, men xanh nhạt đều, các ô đắp nổi hoa văn, trước tấm vải màu kem',
    altEn:
      'A tall square vase with two handles in an even soft blue glaze and moulded panels, in front of a cream cloth',
  },
  {
    photo: 'pp-agkgpseg',
    target: 'PRODUCT',
    key: 'AGKGPSEG',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc bình cao hình trụ phình miệng cánh hoa, men xanh da trời loang chuyển xanh đậm, trong tủ trưng bày',
    altEn:
      'A tall vase with a petal-shaped mouth in a mottled sky-blue glaze fading to dark blue, in a display case',
  },
  {
    photo: 'pp-amf85x49',
    target: 'PRODUCT',
    key: 'AMF85X49',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc ống hình trụ sứ trắng vẽ lam cảnh núi và hồ, trên nền tối',
    altEn:
      'A cylindrical white porcelain pot painted in blue with a mountain and lake scene, on a dark background',
  },
  {
    photo: 'pp-bnux83x4',
    target: 'PRODUCT',
    key: 'BNUX83X4',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc ống rộng thân hơi thắt, vẽ lam cảnh khu vườn có nhân vật, trên nền xám',
    altEn:
      'A wide cylindrical pot with a slightly waisted body, painted in blue with a garden scene with figures, on a grey background',
  },
  {
    photo: 'pp-hqqgrf67',
    target: 'PRODUCT',
    key: 'HQQGRF67',
    role: 'COVER',
    position: 0,
    alt: 'Cận cảnh chiếc ống sứ trắng vẽ lam cảnh sông nước, nền sáng',
    altEn:
      'A close-up of a wide cylindrical blue-and-white pot with a river landscape, on a pale background',
  },
  {
    photo: 'pp-u39kntt8',
    target: 'PRODUCT',
    key: 'U39KNTT8',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc ống hình trụ vẽ lam các nhân vật mặc trang phục châu Âu trong từng ô, viền chữ nhật, đặt trong tủ trưng bày',
    altEn:
      'A cylindrical blue-and-white pot with painted figures in European dress in panels with a key-pattern border, in a display case',
  },
  {
    photo: 'pp-4nqzd98g',
    target: 'PRODUCT',
    key: '4NQZD98G',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô hình nón rộng, men xanh ngọc rạn nhỏ, trên nền xám',
    altEn:
      'A wide conical bowl in a jade-green celadon glaze with fine crackle, on a grey gradient background',
  },
  {
    photo: 'pp-75aczu2w',
    target: 'PRODUCT',
    key: '75ACZU2W',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô sâu lòng tròn trịa, men xanh lục rạn nhỏ khắp thân, trên nền xám',
    altEn:
      'A deep rounded bowl in a green celadon glaze with fine crackle all over, on a grey gradient background',
  },
  {
    photo: 'pp-78dwbkhw',
    target: 'PRODUCT',
    key: '78DWBKHW',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô có chân, men xanh ngọc nhạt, thân khắc đường cánh sen, trên nền tối',
    altEn:
      'A footed bowl in a pale jade-green celadon glaze with carved lotus-petal lines, on a dark vignette background',
  },
  {
    photo: 'pp-cef77ydk',
    target: 'PRODUCT',
    key: 'CEF77YDK',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô có chân, men xanh ô liu, mặt ngoài khắc đường cánh sen, trên nền xám',
    altEn:
      'A footed bowl in an olive-green celadon glaze with carved lotus-petal lines on the outside, on a grey gradient background',
  },
  {
    photo: 'pp-y9mp5ajq',
    target: 'PRODUCT',
    key: 'Y9MP5AJQ',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô sâu lòng có chân, men xanh xám, thân khắc đường lá, chân để mộc, trên nền xám',
    altEn:
      'A deep footed bowl in a grey-green celadon glaze with carved leaf lines and an unglazed foot ring, on a grey gradient background',
  },
  {
    photo: 'pp-87zfuqmm',
    target: 'PRODUCT',
    key: '87ZFUQMM',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô có chân, men trắng kem vẽ lam xám các dây cuộn và dải hoa, trên nền xám nhạt',
    altEn:
      'A footed bowl with a cream-white glaze and grey-blue brush-painted scrolls and a floral band, on a light grey background',
  },
  {
    photo: 'pp-ha8cys37',
    target: 'PRODUCT',
    key: 'HA8CYS37',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô sâu lòng phủ men xanh đậm, nổi các con cò trắng và cành liễu trong tuyết, trên nền xám',
    altEn:
      'A deep bowl with a deep-blue ground and white reserved egrets and willow branches, on a grey gradient background',
  },
  {
    photo: 'pp-hbfm9jqu',
    target: 'PRODUCT',
    key: 'HBFM9JQU',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô có chân nhìn từ trên xuống, miệng viền chữ nhật xanh, lòng có dải cánh sen và dây lá, nền sáng',
    altEn:
      'A footed bowl seen from above with a blue key-pattern rim and a lotus-petal band and leafy scrolls inside, on a light background',
  },
  {
    photo: 'pp-j26na3d8',
    target: 'PRODUCT',
    key: 'J26NA3D8',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc tô tròn vẽ lam xám cảnh chùa và cây thông, viền ô lưới, đặt trên kệ trưng bày',
    altEn:
      'A round bowl painted in blue-grey with a pagoda and pine landscape and a lattice rim, on a display shelf',
  },
  {
    photo: 'pp-8j6uyuxr',
    target: 'PRODUCT',
    key: '8J6UYUXR',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc âu có nắp phẳng gờ rộng, men xanh vàng nhạt, đặt trước nền xanh xám',
    altEn:
      'A lidded tureen with a flat flanged lid and a pale yellow-green celadon glaze, in front of a blue-grey background',
  },
  {
    photo: 'pp-b2mbkja9',
    target: 'PRODUCT',
    key: 'B2MBKJA9',
    role: 'COVER',
    position: 0,
    alt: 'Chiếc âu tròn thấp có nắp, men xanh lục, thân đắp nổi dây hoa mẫu đơn và dải hạt, trên nền tối',
    altEn:
      'A squat lidded jar in a green celadon glaze with a relief peony scroll and a bead band, on a dark background',
  },
];

/**
 * Demo products that used to carry a photo and now show a preset illustration, because no licensed photo shows
 * that exact object: HX2M9KQD (a blue lotus bowl that none of the licensed photos matches).
 */
export const NO_COVER_DEMO_PRODUCTS: readonly string[] = ['HX2M9KQD'];

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
