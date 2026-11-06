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
  {
    id: 'pp-NMTBV2V8',
    alt: 'Bộ ấm chén men trắng vẽ hoa sen xanh nhạt gồm ấm có viền xanh đậm, các chén và đĩa lót.',
    credit: {
      title: 'Bộ ấm chén vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://gomsuhoanggia.vn/san-pham/bo-am-chen-bat-trang-men-kem-ve-sen-xanh',
    },
    widths: [1280],
  },
  {
    id: 'pp-APRGZXKJ',
    alt: 'Đĩa nhỏ men trắng ngà viền nổi hoa văn cánh hoa và đường gân, nền trắng.',
    credit: {
      title: 'Đĩa trà men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://minhlongonline.com/san-pham/dia-lot-13cm-tulip-noi-trang-nga/',
    },
    widths: [1280],
  },
  {
    id: 'pp-5HJ4M6XJ',
    alt: 'Chén trà hình nón men trắng rạn vẽ lá sen xanh, chân để mộc, đặt trên mặt gỗ.',
    credit: {
      title: 'Tách trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1809800632/handcrafted-fu-gui-crackle-glaze-ceramic',
    },
    widths: [1280],
  },
  {
    id: 'pp-SHTBATDK',
    alt: 'Chén trà tròn men rạn màu xám với các vết nứt lớn, chân để mộc nâu, nền xám nhạt.',
    credit: {
      title: 'Tách trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.raf-lifestyle.com/products/artisan-crackle-glaze-tea-cup',
    },
    widths: [1280],
  },
  {
    id: 'pp-US2Y4X54',
    alt: 'Bộ ấm chén men rạn màu trắng ngà với ấm có quai kim loại, sáu chén và đĩa lót, đặt trên chiếu cói.',
    credit: {
      title: 'Bộ ấm chén men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://battrangplaza.com/bo-am-chen-bat-trang-men-luoi-350ml/',
    },
    widths: [1280],
  },
  {
    id: 'pp-5UT6F26K',
    alt: 'Chén trà hình nón vẽ lá sen và hoa sen xanh trên nền men trắng rạn, chân để mộc.',
    credit: {
      title: 'Tách trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.etsy.com/au/listing/1809800632/handcrafted-fu-gui-crackle-glaze-ceramic',
    },
    widths: [1280],
  },
  {
    id: 'pp-8PR9BKZU',
    alt: 'Bộ ấm chén sứ trắng vẽ hoa sen xanh ngọc và lá sen, đặt trên mặt bàn gỗ trước tường gạch trắng.',
    credit: {
      title: 'Bộ ấm chén vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://sieuthibaokhanh.vn/products/bo-am-chen-bat-trang-ve-hoa-sen-trang-cao-cap',
    },
    widths: [1280],
  },
  {
    id: 'pp-NP4T3857',
    alt: 'Đĩa tròn nhỏ men trắng ngà trơn, nghiêng nhẹ, nền trắng.',
    credit: {
      title: 'Đĩa trà men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://minhlong.com/products/to-chen-dia-muong-daisy-lys-trang-nga-dia-lot',
    },
    widths: [1280],
  },
  {
    id: 'pp-VABNMVCN',
    alt: 'Chén trà men trắng rạn dày vết nứt, được chiếu sáng từ bên trong trên nền đen.',
    credit: {
      title: 'Tách trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.dreamstime.com/porcelain-cup-illuminated-showcasing-crackle-glaze-pattern-intricate-network-dark-lines-against-light-image406472011',
    },
    widths: [1280],
  },
  {
    id: 'pp-8NK5Y5HF',
    alt: 'Bộ ấm chén men rạn màu kem vẽ hoa sen xanh gồm ấm quai mây, chén vuông và đĩa lót trên nền xám nhạt.',
    credit: {
      title: 'Bộ ấm chén men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://shopee.vn/Bộ-Ấm-Chén-Bát-Tràng-men-rạn-cổ-i.40920343.7920343688',
    },
    widths: [1280],
  },
  {
    id: 'pp-XHUW33XA',
    alt: 'Ba chén trà nhỏ vẽ hoa sen và lá sen xếp nghiêng trên đĩa đen.',
    credit: {
      title: 'Tách trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1809800632/handcrafted-fu-gui-crackle-glaze-ceramic',
    },
    widths: [1280],
  },
  {
    id: 'pp-7ZMF3CET',
    alt: 'Chén tống men trắng ngà có miệng rót nhọn, đặt trên khăn vải, phía sau là các chén nhỏ mờ.',
    credit: {
      title: 'Chén tống men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://naturepuretea.com/products/gongdao-bei-cha-hai-160ml',
    },
    widths: [1280],
  },
  {
    id: 'pp-X8X6R2AR',
    alt: 'Bộ ấm trà men xanh nhạt vẽ lá sen xanh ngọc và nụ sen đỏ gồm ấm quai tre và bốn chén trên khay tre.',
    credit: {
      title: 'Bộ ấm chén vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/4361786159/lotus-ceramic-tea-sets-japanese-tea-sets',
    },
    widths: [1280],
  },
  {
    id: 'pp-HWKG9TFU',
    alt: 'Bộ ấm chén men rạn xám xanh với ấm quai xách và năm chén đặt trên khay trà gỗ.',
    credit: {
      title: 'Bộ ấm chén men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://noithathawa.com/bo-am-chen-tra-dao-men-ran/',
    },
    widths: [1280],
  },
  {
    id: 'pp-YJNEM242',
    alt: 'Chén trà thân thẳng men rạn xanh lục với vết nứt đen đậm trên nền tối.',
    credit: {
      title: 'Tách trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.joom.com/en/products/60504d3d10c1d601061fead7',
    },
    widths: [1280],
  },
  {
    id: 'pp-KMAXWCMN',
    alt: 'Bộ ấm trà gốm xám gợn vẽ sen đỏ và lá sen xanh gồm ấm, chén tống và năm chén nhỏ trên nền trắng.',
    credit: {
      title: 'Bộ ấm chén vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.amazon.com/Buncheong-Porcelain-Ceremony-Complete-Service/dp/B07QMJ52ZN',
    },
    widths: [1280],
  },
  {
    id: 'pp-DZ4FT343',
    alt: 'Chén trà sứ trắng vẽ cánh sen hồng ở thân và viền miệng xanh lá, nền trắng.',
    credit: {
      title: 'Tách trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://legleporcelain.com/product/lotus-kung-fu-tea-cup/',
    },
    widths: [1280],
  },
  {
    id: 'pp-DWPF6N2Z',
    alt: 'Chén trà men rạn xanh lá tươi chân cao, vết nứt mịn, đặt trên nền trắng.',
    credit: {
      title: 'Tách trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.amazon.com/Porcelain-Teacups-Japanese-Handmade-Ceramic/dp/B0H22KBDFT',
    },
    widths: [1280],
  },
  {
    id: 'pp-CUMJFVDF',
    alt: 'Chén tống men xanh lam nhạt có quai tròn và miệng rót, đặt trên khăn dệt nâu.',
    credit: {
      title: 'Chén tống men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://saanwu.com/products/ru-porcelain-sky-blue-color-supporting-nail-craftsmanship-gongdao-cup-fairness-cup',
    },
    widths: [1280],
  },
  {
    id: 'pp-MAF7PJP5',
    alt: 'Bộ ấm trà men rạn màu xanh lá với ấm quai xách và sáu chén trên khăn trải bàn xám.',
    credit: {
      title: 'Bộ ấm chén men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://ceramicitc.com/product/celadon-ge-ware-overhead-beam-teapot-set-large-capacity-gongfu-tea-ceremony-set-with-ice-crackle-glaze/',
    },
    widths: [1280],
  },
  {
    id: 'pp-ZRJNHUKB',
    alt: 'Đĩa nhỏ men lam đậm bóng có các vòng gờ nổi, nền trắng.',
    credit: {
      title: 'Đĩa trà men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1688999303/fiesta-cobalt-blue-saucer-plate-dish',
    },
    widths: [1280],
  },
  {
    id: 'pp-YVSK5KJN',
    alt: 'Chén trà hình nón vẽ lá sen xanh và hoa sen trên men trắng rạn, đặt nghiêng trên bàn gỗ, phía sau là hai chén khác.',
    credit: {
      title: 'Tách trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1809800632/handcrafted-fu-gui-crackle-glaze-ceramic',
    },
    widths: [1280],
  },
  {
    id: 'pp-DGX2MN5B',
    alt: 'Bộ ấm chén men xanh nhạt vẽ sen xanh ngọc gồm ấm và sáu chén có đĩa lót trên mặt bàn gỗ.',
    credit: {
      title: 'Bộ ấm chén vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://battrangdanang.vn/san-pham/bo-am-tra-bat-trang-hoa-tiet-hoa-senxanh-ve-tay-bt-bat107/',
    },
    widths: [1280],
  },
  {
    id: 'pp-ZK5PQWJV',
    alt: 'Đĩa tròn men trắng ngà có viền gợn sóng, mặt men sờn cũ, đặt trên mặt đá xám.',
    credit: {
      title: 'Đĩa trà men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.rivestoitalia.com/shop/p/antique-ivory-glaze-scalloped-edge-plate-3',
    },
    widths: [1280],
  },
  {
    id: 'pp-MP64NTCQ',
    alt: 'Chén trà men rạn xanh xám đặt trên khay trà gỗ, phía sau là ấm trà mờ.',
    credit: {
      title: 'Tách trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/4521739372/handmade-longquan-celadon-crackle-glaze',
    },
    widths: [1280],
  },
  {
    id: 'pp-UWNQUKZK',
    alt: 'Bộ trà men rạn xanh ngọc gồm ấm có quai, chén tống, chén nắp và các chén nhỏ viền nâu xếp vòng trên nền trắng.',
    credit: {
      title: 'Bộ ấm chén men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.yoycart.com/Product/537886773522/',
    },
    widths: [1280],
  },
  {
    id: 'pp-NCGV8GDH',
    alt: 'Đĩa tròn men trắng ngà hơi ngả kem, lòng đĩa sâu, đặt trên mặt đá xám.',
    credit: {
      title: 'Đĩa trà men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.rivestoitalia.com/shop/p/x2-large-antique-creme-glazed-plates',
    },
    widths: [1280],
  },
  {
    id: 'pp-RW4ZX9AC',
    alt: 'Chén trà sứ trắng vẽ hoa sen hồng nhạt đặt trong hộp quà màu đen.',
    credit: {
      title: 'Tách trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://ciporcelain.com.au/products/lotus-charm-hand-painted-porcelain-cup',
    },
    widths: [1280],
  },
  {
    id: 'pp-CFP8TG5P',
    alt: 'Chén tống men trắng ngà rạn nhẹ có miệng rót, được một bàn tay nâng đỡ.',
    credit: {
      title: 'Chén tống men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://naturepuretea.com/products/gongdao-bei-cha-hai-160ml',
    },
    widths: [1280],
  },
  {
    id: 'pp-X52GJMNC',
    alt: 'Chén tống men lam đậm chảy loang trắng ở thân, có miệng rót, đặt trên vải lanh.',
    credit: {
      title: 'Chén tống men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://teanpractice.ge/products/chahai-light-blue-glaze-150-ml',
    },
    widths: [1280],
  },
  {
    id: 'pp-BH82B7WA',
    alt: 'Bộ ấm chén men kem vẽ sen xanh đậm với ấm quai mây, sáu chén và đĩa lót trên nền xám nhạt.',
    credit: {
      title: 'Bộ ấm chén vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://battrangceramics.com/am-chen-bat-trang/bo-am-chen-sen-tong-to-ran-bat-trang.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-GWMBFE73',
    alt: 'Bộ ấm chén men rạn màu kem viền vàng vẽ sen xanh chàm gồm ấm, sáu chén và đĩa lót trên nền trắng.',
    credit: {
      title: 'Bộ ấm chén men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://gomsuhoanggia.vn/san-pham/bo-am-chen-men-ran-ve-hoa-sen-boc-dong-nghe-nhan',
    },
    widths: [1280],
  },
  {
    id: 'pp-ZN5BK3CQ',
    alt: 'Tô sứ tròn viền cánh hoa vẽ hoa văn xanh lam trên nền men trắng, bên trong vẽ các nhân vật, chụp trên nền trắng.',
    credit: {
      title: 'Tô sứ vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://nipon-scope.com/product/large-oriental-blue-white-porcelain-bowl-c1880/',
    },
    widths: [1280],
  },
  {
    id: 'pp-HEWCUZ3W',
    alt: 'Hũ gốm nắp tròn có núm, phủ men nâu sẫm đốm với các đường gờ ngang quanh thân.',
    credit: {
      title: 'Hũ đựng trà men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.1stdibs.com/furniture/decorative-objects/vases-vessels/jars/studio-pottery-lidded-jar/id-f_37846432/',
    },
    widths: [1280],
  },
  {
    id: 'pp-YEAAG5QG',
    alt: 'Khay trà vuông có lỗ thoát nước, ở giữa là ô men xanh nhạt vẽ nổi hoa sen hồng và lá, viền xanh đậm.',
    credit: {
      title: 'Khay trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.fongstea.com/product/qinghua-huoshi-red-hand-painted-lotus-tea-tray/',
    },
    widths: [1280],
  },
  {
    id: 'pp-T7ZAQPP3',
    alt: 'Cốc có quai men xanh ngọc nhạt, thân khắc nổi họa tiết chấm, đặt trên tấm vải thô bên cạnh ít hạt và vỏ cam khô.',
    credit: {
      title: 'Cốc quai men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1833766537/longquan-celadon-mug-300ml-handmade',
    },
    widths: [1280],
  },
  {
    id: 'pp-HX2M9KQD',
    alt: 'Bát sứ men trong vẽ lam hình bông sen và lá, nhìn nghiêng trên nền trắng.',
    credit: {
      title: 'Bát vẽ sen men trong',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://langgombattrang.vn/san-pham/bat-com-ve-sen/',
    },
    widths: [1280],
  },
  {
    id: 'pp-VBJDE3XM',
    alt: 'Hũ gốm có nắp, thân màu kem phủ họa tiết hoa lá nâu đậm, nắp có núm nhọn, chụp trên nền tối.',
    credit: {
      title: 'Hũ đựng trà men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.pinterest.com/pin/229402174749496360/',
    },
    widths: [1280],
  },
  {
    id: 'pp-YT8G4F7E',
    alt: 'Đĩa gốm men rạn viền vàng, giữa có quả đào nổi màu vàng nâu và hoa vàng trên nền chấm xanh, đặt trên giá đỡ.',
    credit: {
      title: 'Khay trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.com/products/dia-ke-am-tra-men-ran-ve-vang',
    },
    widths: [1280],
  },
  {
    id: 'pp-V7QSBKE7',
    alt: 'Bát sứ men trắng vẽ hoa sen xanh lam và viền hoa văn, chụp trên nền cam.',
    credit: {
      title: 'Bát ăn cơm vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.com/products/bat-com-tho-men-lam-hoa-tiet-hoa-sen',
    },
    widths: [1280],
  },
  {
    id: 'pp-M6C26W8E',
    alt: 'Khay gốm trắng kem hình dáng uốn lượn, giữa khay vẽ mực một nhánh sen và đài sen khô.',
    credit: {
      title: 'Khay trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.orijintea.com/en_US/products/coaster-with-lotus-pattern-decoration',
    },
    widths: [1280],
  },
  {
    id: 'pp-K7J9UK5N',
    alt: 'Cốc có nắp men xanh ngọc nhạt, núm nắp hình thú nhỏ, thân khắc nổi hình rồng và sóng, quai cong.',
    credit: {
      title: 'Cốc quai men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tiendamia.com.uy/p/amz/b0cc5nlc45/green-porcelain-dragon-tea-cup-with-lid-and-handle-13-5-oz-400ml',
    },
    widths: [1280],
  },
  {
    id: 'pp-SET5S9VZ',
    alt: 'Cốc sứ trụ cao men trắng vẽ hoa mẫu đơn xanh lam, viền họa tiết quanh miệng, quai hình thân tre.',
    credit: {
      title: 'Cốc quai vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.1stdibs.com/furniture/dining-entertaining/porcelain/18th-century-chinese-export-blue-white-porcelain-mug/id-f_16863102/',
    },
    widths: [1280],
  },
  {
    id: 'pp-UWY8KZUG',
    alt: 'Bát gốm men rạn trắng xám kiểu Nhật, nhìn nghiêng trên tấm vải, nền xanh mờ.',
    credit: {
      title: 'Bát ăn cơm men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/4428382240/japanese-tgasa-style-ceramic-bowl',
    },
    widths: [1280],
  },
  {
    id: 'pp-PQNMSM5U',
    alt: 'Hũ sứ lục giác có nắp, thân trắng vẽ hoa lá và chim màu nâu xanh, đặt trên nền xám.',
    credit: {
      title: 'Hũ đựng trà men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/4374210701/vintage-ceramic-tea-caddy-with-lid-hand',
    },
    widths: [1280],
  },
  {
    id: 'pp-M2BKH982',
    alt: 'Đĩa gốm men rạn viền xanh, giữa có quả đào nổi màu vàng-xanh và hoa nâu trên nền chấm xanh, đặt trên giá đỡ.',
    credit: {
      title: 'Khay trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.com/products/dia-ke-am-tra-men-ran',
    },
    widths: [1280],
  },
  {
    id: 'pp-6VWZD2XN',
    alt: 'Khay sứ hình bát giác vẽ bó hoa sen xanh lam và đỏ cam trên nền men trắng, đặt trên tấm vải xanh.',
    credit: {
      title: 'Khay trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tao.hooos.com/goods_669948227971.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-GU874TFN',
    alt: 'Cốc có nắp men xanh ngọc, quai nhỏ có vòng xoắn, núm nắp gỗ, đặt trên bàn gỗ cạnh cửa sổ.',
    credit: {
      title: 'Cốc quai men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.etsy.com/de/listing/1841933872/japandi-celadon-mug-with-wooden-lid-12oz',
    },
    widths: [1280],
  },
  {
    id: 'pp-SS8KJXV9',
    alt: 'Bát sứ trắng vẽ nhiều màu hoa sen hồng, lá sen xanh và một chú chim, chân bát thấp.',
    credit: {
      title: 'Bát ăn cơm vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://pearlriver.com/products/season-motif-rice-bowl-summer-lotus',
    },
    widths: [1280],
  },
  {
    id: 'pp-EB5QN3AE',
    alt: 'Hũ gốm nhỏ có nắp, men nâu xanh ô-liu ở phần trên và nâu đỏ ở chân, đặt trên nền trắng.',
    credit: {
      title: 'Hũ đựng trà men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.mutualart.com/Artwork/stoneware-tea-caddy-and-cover/5AD0FF5503C3DC24823A8DEF916D472E',
    },
    widths: [1280],
  },
  {
    id: 'pp-KFKMFADC',
    alt: 'Khay chữ nhật nông men xanh ngọc lam, bề mặt men có các đường rạn nhỏ, chụp trên nền trắng.',
    credit: {
      title: 'Khay trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.1stdibs.com/furniture/dining-entertaining/platters-serveware/vintage-crackle-glaze-ceramic-tray-jars-france-mid-20th-century/id-f_15967301/',
    },
    widths: [1280],
  },
  {
    id: 'pp-QWE7JGZD',
    alt: 'Hai chiếc bát men rạn màu kem xếp chồng, thân đắp nổi hoa sen vàng nâu và nét xanh lam, nền trắng.',
    credit: {
      title: 'Bát ăn cơm men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://banthotamlinhviet.vn/gom-su/men-ran-co-bat-trang/bat-com-men-ran-bat-trang/',
    },
    widths: [1280],
  },
  {
    id: 'pp-HMRAC7CQ',
    alt: 'Hũ gốm vuông có nắp, phủ men nâu đồng loang đốm, đặt trên mặt bàn nâu mờ.',
    credit: {
      title: 'Hũ đựng trà men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.lunateaware.com/products/wabi-sabi-style-stoneware-tea-caddy',
    },
    widths: [1280],
  },
  {
    id: 'pp-CKQYMBXY',
    alt: 'Đĩa sứ men trắng vẽ lam hình hoa sen và đôi vịt uyên ương, viền họa tiết ô trám, được hai tay nâng lên.',
    credit: {
      title: 'Khay trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tao.hooos.com/goods_661240709706.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-PUEKDH6V',
    alt: 'Cốc có nắp men xanh ngọc nhạt khắc nổi hoa lá, quai cong, đặt trên đế gỗ sẫm.',
    credit: {
      title: 'Cốc quai men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://shopee.sg/Longquan-Celadon-Ceramic-Office-Cup-with-Lid-–-High-End-Porcelain-Mug-with-Handle-for-Water-or-Tea-*2.23-i.690937758.24404066650',
    },
    widths: [1280],
  },
  {
    id: 'pp-SKT3T7E7',
    alt: 'Bát sứ men kem vẽ nhiều màu hoa sen đỏ nâu cùng dây lá xanh, chân cao viền vàng hoa văn chữ nhật, đặt trên bàn gỗ.',
    credit: {
      title: 'Bát ăn cơm vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1693388746/blue-and-white-porcelain-hand-painted',
    },
    widths: [1280],
  },
  {
    id: 'pp-45YAPP9R',
    alt: 'Đĩa tròn viền lượn sóng men xanh ngọc nhạt với các đường rạn lớn, viền đồng đỏ, chụp từ trên xuống.',
    credit: {
      title: 'Khay trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.taobao.com/list/item/VVpvQ050R3pUcFFHSmZTSGk1c3hLdz09.htm',
    },
    widths: [1280],
  },
  {
    id: 'pp-YR3C94VH',
    alt: 'Cốc sứ cao men trắng vẽ hoa mẫu đơn và lá xanh lam, viền ô trám quanh miệng, quai cong, men hơi cũ.',
    credit: {
      title: 'Cốc quai vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.1stdibs.com/furniture/dining-entertaining/porcelain/18th-century-chinese-export-blue-white-porcelain-mug/id-f_16864992/',
    },
    widths: [1280],
  },
  {
    id: 'pp-T7DXR28D',
    alt: 'Hũ gốm tròn nắp phẳng phủ men nâu vàng loang đốm kiểu thô, đặt trên tấm đệm cói.',
    credit: {
      title: 'Hũ đựng trà men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/4364710626/portable-mini-ceramic-tea-jar-small',
    },
    widths: [1280],
  },
  {
    id: 'pp-2X9QFA6B',
    alt: 'Khay trà tròn men trắng vẽ lam hoa lá cuộn và sen, giữa khay có ô thoát nước hoa văn chữ nhật.',
    credit: {
      title: 'Khay trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tao.hooos.com/goods_679676241199.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-GEMZPJK5',
    alt: 'Cốc có nắp men xanh lá nhạt bóng, thân tròn bầu, quai tròn, đặt trên đế gỗ cạnh cuốn sách.',
    credit: {
      title: 'Cốc quai men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        "https://shopee.ph/Slightly-Imperfect-Celadon-Tea-Cup-with-Lid-Longquan-Ceramic-Office-Cup-with-Handle-Men's-and-Women-i.1624424462.42168597311",
    },
    widths: [1280],
  },
  {
    id: 'pp-H6KBXFZB',
    alt: 'Khay gốm xanh lục bát giác nông men bóng với các đường rạn nhỏ, chụp nghiêng trên nền trắng.',
    credit: {
      title: 'Khay trà men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.1stdibs.com/furniture/dining-entertaining/platters-serveware/vintage-crackle-glaze-ceramic-tray-jars-france-mid-20th-century/id-f_15967301/',
    },
    widths: [1280],
  },
  {
    id: 'pp-YNKHKZFS',
    alt: 'Bát gốm men rạn màu be với các đường rạn lớn rõ rệt, chụp trên nền xám.',
    credit: {
      title: 'Bát ăn cơm men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.pinterest.com/pin/383228249522345260/',
    },
    widths: [1280],
  },
  {
    id: 'pp-Q5YPG5TW',
    alt: 'Tô sứ lớn men trắng vẽ hoa văn xanh lam cầu kỳ bên trong và bên ngoài, đặt trên nền trắng.',
    credit: {
      title: 'Tô sứ vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.1stdibs.com/furniture/dining-entertaining/porcelain/large-blue-white-porcelain-peacock-bowl-vintage-collectible-japan/id-f_27615912/',
    },
    widths: [1280],
  },
  {
    id: 'pp-KKVB8B28',
    alt: 'Khay trà gỗ nâu sẫm có rãnh thoát nước, đặt ba chén nhỏ màu vàng nhạt, nền sáng.',
    credit: {
      title: 'Khay trà vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tradaophuongdong.com/san-pham/khay-tra-nhua-phip-pho-thong/',
    },
    widths: [1280],
  },
  {
    id: 'pp-JH22Y4FY',
    alt: 'Cốc trụ men xanh ngọc đậm kèm nắp đặt bên cạnh, quai tre và núm nắp hình thú nhỏ, trên nền xám nhạt.',
    credit: {
      title: 'Cốc quai men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1894046815/elephant-mug-with-lid-handle-13oz',
    },
    widths: [1280],
  },
  {
    id: 'pp-JCMU8F99',
    alt: 'Bình hút lộc tròn men trắng ngà vẽ đàn ngựa phi, đặt trên đế gỗ nâu, nền trắng.',
    credit: {
      title: 'Bình hút lộc men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://khonggiangom.vn/san-pham/qua-hut-loc-men-trang-ma-dao-thanh-cong-ve-vang/',
    },
    widths: [1280],
  },
  {
    id: 'pp-WDDP8NBV',
    alt: 'Bình hút lộc tròn men trắng, mặt trước có chữ thư pháp Đức vẽ vàng bạc trong khung hoa văn, trên chiếu cói.',
    credit: {
      title: 'Bình hút lộc men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://sangom.vn/binh-hut-loc-mau-trang-ve-chi-vang-hoa-tiet-tu-canh-gom-su-bat-trang-sg-bhl136/',
    },
    widths: [1280],
  },
  {
    id: 'pp-MP9XH99A',
    alt: 'Bình hút lộc tròn men trắng, mặt trước có chữ thư pháp Lộc vẽ vàng bạc trong khung hoa văn, trên chiếu cói.',
    credit: {
      title: 'Bình hút lộc men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://sangom.vn/binh-hut-loc-mau-trang-ve-chi-vang-hoa-tiet-tu-canh-gom-su-bat-trang-sg-bhl136/',
    },
    widths: [1280],
  },
  {
    id: 'pp-UQXED4KM',
    alt: 'Bình hút lộc tròn men trắng vẽ vàng hình thuyền buồm, đặt trên đế gỗ giữa nền sân vườn đá và cây.',
    credit: {
      title: 'Bình hút lộc men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://gombattrang.vn/san-pham/bong-hut-loc-mini-ve-vang-kim-thuan-buom-xuoi-gio-trang/',
    },
    widths: [1280],
  },
  {
    id: 'pp-UUCHKZHP',
    alt: 'Bình hút lộc tròn men lam vẽ hoa sen xanh cobalt viền vàng trên nền trắng, đặt trên đế gỗ nâu, có tấm vải đỏ phía sau.',
    credit: {
      title: 'Bình hút lộc men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://sangom.vn/binh-hut-loc-men-lam-ve-vang-hoa-sen-phu-quy-cao-30cm-sg-bhl138/',
    },
    widths: [1280],
  },
  {
    id: 'pp-GX8HXYXM',
    alt: 'Lục bình cao dáng thon miệng loe, vẽ lam cảnh sơn thủy trên nền men trắng, đứng trên nền màu cam.',
    credit: {
      title: 'Lục bình men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/lo-luc-binh-bat-trang-men-lam-ve-son-thuy.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-Q59BEKH7',
    alt: 'Lục bình cao miệng loe, vẽ lam cảnh núi sông chùa chiền dày đặc trên nền men trắng, nền màu cam.',
    credit: {
      title: 'Lục bình men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/lo-luc-binh-bat-trang-ve-son-thuy-tung-chua.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-K8PXZ5G9',
    alt: 'Lục bình cao miệng loe, vẽ lam hình chim hạc và hoa sen trên men trắng, nền màu cam.',
    credit: {
      title: 'Lục bình men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/lo-luc-binh-bat-trang-men-lam-ve-tung-cong.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-VJ6DV94W',
    alt: 'Lục bình cao miệng loe men trắng ngà, họa tiết xám xanh nhạt và dải hoa văn chữ nhật quanh chân, nền màu cam.',
    credit: {
      title: 'Lục bình men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/luc-binh-1m4-hanh-vang-ve-tung-cong-tu-quy.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-ZWPNY89D',
    alt: 'Lục bình cao miệng loe men trắng ngà vẽ chim hạc màu xám mực, nền màu cam.',
    credit: {
      title: 'Lục bình men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/lo-loc-binh-bat-trang-men-cham-ve-tung-hac.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-PRG7H26B',
    alt: 'Lục bình cao miệng loe men trắng ngà vẽ tùng và hạc bằng nét mực xám, nền màu cam.',
    credit: {
      title: 'Lục bình men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/lo-loc-binh-bat-trang-ve-tung-hac-dien-nien.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-3FRX4ANJ',
    alt: 'Lục bình cao miệng loe men trắng ngà vẽ hạc và hoa mẫu đơn bằng nét xanh xám, nền màu cam.',
    credit: {
      title: 'Lục bình men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tinhhoabattrang.vn/san-pham/loc-binh-ve-hac-mau-don-mau-cham-co.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-J4KAQ2ZA',
    alt: 'Lục bình cao miệng loe men trắng ngà, thân đắp nổi và vẽ họa tiết lam, vàng và nâu, nền màu cam.',
    credit: {
      title: 'Lục bình men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tinhhoabattrang.vn/san-pham/loc-binh-men-ran-tu-canh-dap-noi.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-XMCX5RJX',
    alt: 'Lục bình cao miệng loe men trắng ngà, họa tiết đắp nổi và vẽ vàng nâu hình thông, nền màu cam.',
    credit: {
      title: 'Lục bình men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://tinhhoabattrang.vn/san-pham/loc-binh-bat-trang-men-ran-dap-noi-loc-binh-1m65-tung-cong.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-JVANRMAB',
    alt: 'Chum rượu có nắp và hai quai nhỏ, men trắng rạn, vẽ lam cảnh sông núi, nền trắng.',
    credit: {
      title: 'Bình ngâm rượu men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.vn/san-pham/chum-ruou-sanh-su-men-ran-phong-canh/',
    },
    widths: [1280],
  },
  {
    id: 'pp-BQ2Z83ZY',
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam cây tùng và ngôi chùa, nền trắng.',
    credit: {
      title: 'Bình ngâm rượu men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.vn/san-pham/chum-ruou-sanh-su-men-ran-tung-truong-tho/',
    },
    widths: [1280],
  },
  {
    id: 'pp-FDT9HNPV',
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam ba ông già chơi cờ, nền trắng.',
    credit: {
      title: 'Bình ngâm rượu men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.vn/san-pham/chum-ruou-sanh-su-men-ran-tam-lao-choi-co/',
    },
    widths: [1280],
  },
  {
    id: 'pp-G5BEKP4Q',
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam các nhân vật nam, nền trắng.',
    credit: {
      title: 'Bình ngâm rượu men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.vn/san-pham/chum-ruou-sanh-su-men-ran-cao-cap/',
    },
    widths: [1280],
  },
  {
    id: 'pp-JDVBJK4U',
    alt: 'Vò có nắp và hai quai, men trắng vẽ lam cây tùng và sóng nước, chụp ở sân xi măng cạnh tường.',
    credit: {
      title: 'Bình ngâm rượu men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tiki.vn/p28741514',
    },
    widths: [1280],
  },
  {
    id: 'pp-5MSDE3JW',
    alt: 'Chum ngâm rượu có nắp và hai quai nhỏ, men trắng vẽ lam cảnh làng quê bên hồ, đặt trên nền đất trong xưởng.',
    credit: {
      title: 'Bình ngâm rượu men rạn',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://gomphuctaman.com/chum-ngam-ruou-20-lit/',
    },
    widths: [1280],
  },
  {
    id: 'pp-K5NGRZEP',
    alt: 'Chum rượu có nắp và hai quai, men trắng vẽ lam hoa sen, lá và cá, đặt trên nền đất trong xưởng.',
    credit: {
      title: 'Bình ngâm rượu vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://gomphuctaman.com/chum-ruou-30-lit/',
    },
    widths: [1280],
  },
  {
    id: 'pp-8A6GKN9W',
    alt: 'Chum rượu có nắp và hai quai, men trắng vẽ lam hoa sen, lá và cá chép, đặt trên nền đất trong xưởng.',
    credit: {
      title: 'Bình ngâm rượu vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://gomphuctaman.com/chum-ngam-ruou-30-lit/',
    },
    widths: [1280],
  },
  {
    id: 'pp-XQ3Y2NFC',
    alt: 'Chum rượu có nắp nâu đen, thân men vàng kem vẽ hoa sen hồng và cá đỏ cam, chụp trong phòng.',
    credit: {
      title: 'Bình ngâm rượu vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://gomphuctaman.com/chum-dung-ruou-ve-canh-tai-loc-gom-su/',
    },
    widths: [1280],
  },
  {
    id: 'pp-HSUJQP77',
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam hoa sen và chim hạc, nền trắng.',
    credit: {
      title: 'Bình ngâm rượu vẽ sen',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://khonggiangom.vn/san-pham/chum-ruou-sanh-su-men-ran-cao-cap-sen-hac/',
    },
    widths: [1280],
  },
  {
    id: 'pp-F4X2V7C8',
    alt: 'Lọ hoa miệng loe viền gợn sóng, men nâu sẫm ở miệng và đáy, chảy sang trắng kem ở giữa thân, đặt trên bục gỗ.',
    credit: {
      title: 'Lọ hoa miệng loe men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://battrangvietnam.vn/lo-hoa/lo-hoa-men-hoa-bien-nau-bt-lh136-bat-trang/',
    },
    widths: [1280],
  },
  {
    id: 'pp-MSZG9SBT',
    alt: 'Lọ hoa thân bầu men nâu bóng, miệng loe nhẹ có viền xám, đặt trên bục gỗ.',
    credit: {
      title: 'Lọ hoa miệng loe men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://battrangvietnam.vn/gom-su-sale/lo-hoa-sale/lo-hoa-dang-xoai-men-nau-hoa-bien-bt-lhs38/',
    },
    widths: [1280],
  },
  {
    id: 'pp-ED4HZ64W',
    alt: 'Lọ hoa dáng chân váy miệng loe có viền nâu, thân xám nâu với các đường vân ngang, đặt trên bục gỗ.',
    credit: {
      title: 'Lọ hoa miệng loe men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://battrangvietnam.vn/gom-su-sale/lo-vuot-tay-gom-moc-dang-chan-vay-bt-lhs33/',
    },
    widths: [1280],
  },
  {
    id: 'pp-M2VWGSWF',
    alt: 'Lọ hoa dáng thon cổ loe, men nâu be lốm đốm, đặt trên bục gỗ.',
    credit: {
      title: 'Lọ hoa miệng loe men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://battrangvietnam.vn/lo-hoa/lo-hoa-chan-den-men-san-nau-40cm-bt-lh146/',
    },
    widths: [1280],
  },
  {
    id: 'pp-BRMH663W',
    alt: 'Lọ hoa men trắng miệng loe, vẽ hoa sen với nét nâu đen và đường viền vàng cam, trên tấm lót đan.',
    credit: {
      title: 'Lọ hoa miệng loe men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tiki.vn/p274550552',
    },
    widths: [1280],
  },
  {
    id: 'pp-NA4WKT3A',
    alt: 'Lọ hoa men trắng miệng loe, vẽ hoa sen bằng nét nâu đen và mảng nâu đỏ, trên tấm lót đan.',
    credit: {
      title: 'Lọ hoa miệng loe men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tiki.vn/p274549105',
    },
    widths: [1280],
  },
  {
    id: 'pp-RNTYR2NV',
    alt: 'Lọ hoa men trắng dáng trụ, vẽ hoa sen bằng nét xám đen, trên tấm lót đan.',
    credit: {
      title: 'Lọ hoa miệng loe men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tiki.vn/p274548766',
    },
    widths: [1280],
  },
  {
    id: 'pp-FFMW7373',
    alt: 'Lọ hoa men trắng dáng cao miệng loe, vẽ chuồn chuồn bằng nét đen nâu, đặt ngoài trời cạnh tượng đồng.',
    credit: {
      title: 'Lọ hoa miệng loe men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tinhhoabattrang.vn/san-pham/binh-hoa-gom-dang-tru-co-loe-ve-chuon.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-Y2YTVDD6',
    alt: 'Bát có nắp men ngọc xanh nhạt, nắp và thân khắc nổi hoa sen, núm nắp tròn, đặt trên nền trắng.',
    credit: {
      title: 'Âu đựng canh men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://picclick.com/Popular/celadon-bowl-with-lid',
    },
    widths: [1280],
  },
  {
    id: 'pp-UCTN3QGB',
    alt: 'Bát có nắp men ngọc xanh lục nhạt, vẽ tre và hai chú chim nhỏ, núm nắp hình giọt nước.',
    credit: {
      title: 'Âu đựng canh men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://picclick.com/Popular/celadon-bowl-with-lid',
    },
    widths: [1280],
  },
  {
    id: 'pp-U3G78AEE',
    alt: 'Bát có nắp men ngọc xanh nhạt vẽ hoa sen màu nâu xám, đặt trên mặt bàn gỗ.',
    credit: {
      title: 'Âu đựng canh men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://ebay.com/shop/thailand-celadon?_nkw=thailand+celadon',
    },
    widths: [1280],
  },
  {
    id: 'pp-FDJXY4Z4',
    alt: 'Bát có nắp men ngọc xám xanh, nắp và thân chạm nổi hoa văn, núm nắp nhọn, nền trắng.',
    credit: {
      title: 'Âu đựng canh men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/4467927733/vintage-thai-celadon-lidded-bowl-with',
    },
    widths: [1280],
  },
  {
    id: 'pp-HBTKV2DF',
    alt: 'Âu có nắp và hai quai nhỏ, vẽ lam hoa mai và hoa văn dày màu xanh cobalt trên nền trắng.',
    credit: {
      title: 'Âu đựng canh vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://picclick.com/Popular/blue-and-white-soup-tureen',
    },
    widths: [1280],
  },
  {
    id: 'pp-D3HNYZ8S',
    alt: 'Âu tròn có nắp, men trắng vẽ lam viền hoa văn và hai họa tiết tròn xanh, đặt trên khăn ren trắng.',
    credit: {
      title: 'Âu đựng canh vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/market/blue_white_soup_tureen',
    },
    widths: [1280],
  },
  {
    id: 'pp-S6T8BV6P',
    alt: 'Âu nhỏ hình lục giác có nắp, hai quai và núm nắp màu xanh cobalt, vẽ hoa lam trên nền trắng.',
    credit: {
      title: 'Âu đựng canh vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/market/blue_white_soup_tureen',
    },
    widths: [1280],
  },
  {
    id: 'pp-PT8R7XHW',
    alt: 'Âu có nắp, đế cao và muỗng, men trắng với hoa hồng xanh lam trên thân và nắp.',
    credit: {
      title: 'Âu đựng canh vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/market/blue_white_soup_tureen',
    },
    widths: [1280],
  },
  {
    id: 'pp-7SQB7AEZ',
    alt: 'Âu hình chữ nhật bo góc có nắp, quai và muỗng, hoa văn xanh lam trên nền trắng.',
    credit: {
      title: 'Âu đựng canh vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/market/blue_white_soup_tureen',
    },
    widths: [1280],
  },
  {
    id: 'pp-VBG7MWZ9',
    alt: 'Bình có quai và vòi rót, thân vuông bo, vẽ lam hoa văn dày đặc, quai xanh đậm, nền trắng.',
    credit: {
      title: 'Bình đựng nước vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://us.amazon.com/Exquisite-Porcelain-Hand-Painted-Pitcher-Distinctive/dp/B0CWLS4JH9',
    },
    widths: [1280],
  },
  {
    id: 'pp-T68X3NBP',
    alt: 'Bình có quai, cổ rộng vẽ hoa văn xoắn, thân vẽ hoa lam, đế chân cao, nền trắng.',
    credit: {
      title: 'Bình đựng nước vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://amazon.com/clp/B0BN6T1GFB',
    },
    widths: [1280],
  },
  {
    id: 'pp-AVN3E9QN',
    alt: 'Bình tròn có quai uốn lượn, vẽ lam cảnh sơn thủy, hoa và băng hoa văn trên nền trắng.',
    credit: {
      title: 'Bình đựng nước vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://ebay.com/itm/323758515018',
    },
    widths: [1280],
  },
  {
    id: 'pp-YGHEE9PZ',
    alt: 'Bình có quai đen, thân múi vẽ lam hoa văn, đặt trên bục trắng cắm cành lá.',
    credit: {
      title: 'Bình đựng nước vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.amazon.com/blue-white-pitcher/s?k=blue+and+white+pitcher',
    },
    widths: [1280],
  },
  {
    id: 'pp-E4KJ2BNU',
    alt: 'Bình tròn có quai, men trắng ngà vẽ hoa lam tay, nền trắng.',
    credit: {
      title: 'Bình đựng nước vẽ lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://amazon.com/clp/B0BN6T1GFB',
    },
    widths: [1280],
  },
  {
    id: 'pp-ZA77GA58',
    alt: 'Bát thân cao men trắng ngà, vẽ họa tiết cánh hoa màu nâu đậm bên thân.',
    credit: {
      title: 'Bát chiết yêu men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://threefriendsstudio.com/products/cizhou-bowl',
    },
    widths: [1280],
  },
  {
    id: 'pp-DNENZF4C',
    alt: 'Bát loe hình nón men kem ngà, lòng bát vẽ hoa lá màu nâu đậm rõ nét, viền miệng nâu, nền trắng.',
    credit: {
      title: 'Bát chiết yêu men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.carters.com.au/index.cfm/index/3252-chinese-ceramics-dynasty-mark-or-period-cizhou-ware/',
    },
    widths: [1280],
  },
  {
    id: 'pp-VQAVYC9G',
    alt: 'Bát nhìn từ trên xuống, lòng bát men kem vẽ hoa lá nâu sắt ở giữa và viền sọc quanh miệng.',
    credit: {
      title: 'Bát chiết yêu men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://metmuseum.org/art/collection/search/853979',
    },
    widths: [1280],
  },
  {
    id: 'pp-SK7VPR4P',
    alt: 'Bát loe có chân đế, men nâu vàng chảy loang phủ thân ngoài, miệng để mộc, nền xám.',
    credit: {
      title: 'Bát chiết yêu men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://ebay.com/b/Porcelain-Pottery-Antiques/164808/bn_18110439',
    },
    widths: [1280],
  },
  {
    id: 'pp-W8ARW89X',
    alt: 'Bát loe men nâu đỏ bóng, miệng loe rộng, thân thắt lại dần xuống chân đế mộc màu be, đặt trên mặt đá trắng.',
    credit: {
      title: 'Bát chiết yêu men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://ebay.com/itm/116757311334',
    },
    widths: [1280],
  },
  {
    id: 'pp-8SQ95ZKU',
    alt: 'Đĩa tròn men trắng ngà viền nâu mảnh, xếp cạnh chồng đĩa cùng loại, nền trắng.',
    credit: {
      title: 'Đĩa tròn men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://amazon.com/round-stoneware-dinner-plates/s?k=round+stoneware+dinner+plates',
    },
    widths: [1280],
  },
  {
    id: 'pp-HJFXRHVE',
    alt: 'Đĩa tròn men kem nhạt, mặt đĩa có vân xoáy, vành cao, chụp từ trên xuống.',
    credit: {
      title: 'Đĩa tròn men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://stonessa.com/',
    },
    widths: [1280],
  },
  {
    id: 'pp-985G2ZCY',
    alt: 'Đĩa tròn men trắng ngà viền nâu, đặt nghiêng trên chồng đĩa cùng loại, nền trắng.',
    credit: {
      title: 'Đĩa tròn men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.amazon.com/ivory-stoneware-dinnerware-set/s?k=ivory+stoneware+dinnerware+set&page=2',
    },
    widths: [1280],
  },
  {
    id: 'pp-Z5H3Q9SK',
    alt: 'Chồng đĩa tròn men trắng ngà, đĩa trên cùng nghiêng để lộ viền nâu vàng, nền trắng.',
    credit: {
      title: 'Đĩa tròn men trắng ngà',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://amazon.com/round-stoneware-dinner-plates/s?k=round+stoneware+dinner+plates',
    },
    widths: [1280],
  },
  {
    id: 'pp-ZZ4BEK63',
    alt: 'Đĩa tròn men lam cobalt đậm chuyển sắc, viền đen, xếp cạnh chồng đĩa cùng loại, nền trắng.',
    credit: {
      title: 'Đĩa tròn men lam',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.amazon.com/blue-pottery-plates/s?k=blue+pottery+plates',
    },
    widths: [1280],
  },
  {
    id: 'pp-ABKB9FPN',
    alt: 'Hai chậu gốm nhỏ men trắng vẽ hoa văn hình học màu nâu đỏ, một chậu trồng dương xỉ.',
    credit: {
      title: 'Chậu cây mini men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.walmart.com/ip/Geometric-Ceramic-Planters-6-Inch-Hand-Painted-Ceramic-Embossed-Plant-Pots-Drainage-Holes-2-Set-Boho-Minimalistic-Planters-Indoor-Outdoor-Plants-Beig/17452173732',
    },
    widths: [1280],
  },
  {
    id: 'pp-CKFU38EV',
    alt: 'Chậu gốm nhỏ men kem vẽ dải hoa văn hình thoi màu nâu nhạt, trồng cây lá nhỏ, đặt trên khay gỗ.',
    credit: {
      title: 'Chậu cây mini men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://casolia.com/minimalist-ceramic-planter-ideas/',
    },
    widths: [1280],
  },
  {
    id: 'pp-ESPGQA6V',
    alt: 'Chậu gốm tròn men trắng khắc vẽ nét cây cỏ màu nâu, bên cạnh có dây lá xanh.',
    credit: {
      title: 'Chậu cây mini men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://chauhoa.vn/chau-hoa-dep/chau-gom/chau-gom-trong-cay-phong-thuy-chau-men-gom-hoa-tiet-bo-cong-anh.html',
    },
    widths: [1280],
  },
  {
    id: 'pp-WERPF7SE',
    alt: 'Chậu gốm men kem trắng có hoa văn hoa sen cách điệu viền nâu, đặt trên nền trắng.',
    credit: {
      title: 'Chậu cây mini men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.bidfta.com/299509/item-detail/24498456',
    },
    widths: [1280],
  },
  {
    id: 'pp-HTV7EG6C',
    alt: 'Chậu gốm trắng có họa tiết cành thông và quả thông màu nâu, đặt trên nền trắng.',
    credit: {
      title: 'Chậu cây mini men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.amazon.com/Napco-Pinecone-Evergreen-Ceramic-Planter/dp/B0FJDN6DJT',
    },
    widths: [1280],
  },
  {
    id: 'pp-FQTZWJNF',
    alt: 'Chậu gốm nhỏ men trắng có họa tiết con rắn và hoa màu nâu vàng, bên trong trồng cây mọng nước.',
    credit: {
      title: 'Chậu cây mini men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1606120658/snake-botanical-ceramic-plant-potplanter',
    },
    widths: [1280],
  },
  {
    id: 'pp-WWYYR7FZ',
    alt: 'Chậu gốm tròn nhỏ men nâu loang ánh vàng, đặt trên kệ gỗ.',
    credit: {
      title: 'Chậu cây mini men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.pinterest.com/pin/glaze-ceramics--660269995404826546/',
    },
    widths: [1280],
  },
  {
    id: 'pp-WYND2QMV',
    alt: 'Bàn tay cầm chậu gốm vuông nhỏ màu nâu sẫm có chân, thân khắc hình cành lá.',
    credit: {
      title: 'Chậu cây mini men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://shopee.vn/Chậu-cây-mini-bonsai-vuông-khum-miệng-gốm-màu-nâu-i.397880568.23562903532',
    },
    widths: [1280],
  },
  {
    id: 'pp-J8Z3ZVWD',
    alt: 'Bàn tay cầm chậu gốm vuông nhỏ màu nâu sẫm, thân có vòng tròn nổi.',
    credit: {
      title: 'Chậu cây mini men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://shopee.vn/Chậu-bonsai-mini-gốm-bát-tràng-màu-nâu-gốm-đất-nung-i.397880568.15999612578',
    },
    widths: [1280],
  },
  {
    id: 'pp-2XNHP7UY',
    alt: 'Ống đựng bút hình trụ men xanh ngọc nhạt, thân có hoa văn chìm, đặt trên nền trắng.',
    credit: {
      title: 'Ống đựng bút men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.chiswickauctions.co.uk/auction/lot/661-a-chinese-celadon-chilong-and-lingzhi-brush-pot-bitong/?lot=177337&sd=1',
    },
    widths: [1280],
  },
  {
    id: 'pp-MRZNV5A9',
    alt: 'Ống đựng bút hình trụ men xanh ngọc nhạt có vân rạn nâu, đặt trên nền trắng.',
    credit: {
      title: 'Ống đựng bút men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.etsy.com/listing/1448371767/18th-century-chinese-celadon-brush-pot',
    },
    widths: [1280],
  },
  {
    id: 'pp-N7AAY7J5',
    alt: 'Ống đựng bút hình trụ men xanh ngọc có hoa văn rồng và mây nổi, đặt trên nền sáng.',
    credit: {
      title: 'Ống đựng bút men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.invaluable.com/auction-lot/a-chinese-celadon-porcelain-brush-pot-with-dragon-8039-c-ff945d3837',
    },
    widths: [1280],
  },
  {
    id: 'pp-FA39H57T',
    alt: 'Ống đựng bút hình trụ nhỏ men xanh ngọc bóng, đặt trên giá trong suốt.',
    credit: {
      title: 'Ống đựng bút men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.invaluable.com/auction-lot/celadon-brush-pot-125-c-fe64c8c940',
    },
    widths: [1280],
  },
  {
    id: 'pp-7WDBZ3WM',
    alt: 'Ống đựng bút men xanh ngọc có rồng nổi trên sóng nước, nền tối.',
    credit: {
      title: 'Ống đựng bút men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.pinterest.com/pin/733031276818947549/',
    },
    widths: [1280],
  },
  {
    id: 'pp-U4YND79M',
    alt: 'Ống đựng bút men xanh ngọc thân dạng tre có phần hoa văn rồng được đục lộ.',
    credit: {
      title: 'Ống đựng bút men ngọc',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://www.pinterest.com/pin/korean-celadon-brush-pot--787707791088099535/',
    },
    widths: [1280],
  },
  {
    id: 'pp-SK8J8SU6',
    alt: 'Lư hương ba chân men nâu bóng có họa tiết rồng và viền vàng, nắp có tượng nghê.',
    credit: {
      title: 'Lư hương men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'http://gomhailong.vn/lu-hoa-vang/lu-hoa-vang-co-lon-cao-60-cm-men-nau-co',
    },
    widths: [1280],
  },
  {
    id: 'pp-GVSRHC37',
    alt: 'Bàn tay nâng lư hương gốm ba chân màu nâu có nắp đục lỗ, nền trắng.',
    credit: {
      title: 'Lư hương men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://sieuthibaokhanh.vn/products/lu-huong-xong-tram-gom',
    },
    widths: [1280],
  },
  {
    id: 'pp-J4D2V8A4',
    alt: 'Hai bàn tay nâng lư hương gốm men nâu loang hình hoa sen, nắp có nhiều lỗ.',
    credit: {
      title: 'Lư hương men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://shopee.vn/LƯ-HƯƠNG-XÔNG-TRẦM-ĐỐT-TRẦM-BẰNG-GỐM-HỌA-TIẾT-HOA-SEN-i.9637047.22031291154',
    },
    widths: [1280],
  },
  {
    id: 'pp-XN9F53JD',
    alt: 'Lư hương gốm màu nâu sẫm hình hoa sen có nắp đục lỗ, đặt trên khay gỗ.',
    credit: {
      title: 'Lư hương men nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl: 'https://tramthuymoc.com/san-pham/lu-xong-tram-gom-hoa-tiet-hoa-sen/',
    },
    widths: [1280],
  },
  {
    id: 'pp-RHGYT9D9',
    alt: 'Lư hương ba chân thân men kem vẽ chim và nét cọ màu nâu, có dải đỏ cam quanh cổ.',
    credit: {
      title: 'Lư hương men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.pinterest.com/pin/a-cizhou-painted-tripod-censer-yuan-dynasty-12711368--716283515713205230/',
    },
    widths: [1280],
  },
  {
    id: 'pp-KHE7USRH',
    alt: 'Lư hương gốm men kem trên chân cao, miệng loe phẳng khắc hoa văn nâu.',
    credit: {
      title: 'Lư hương men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.invaluable.com/auction-lot/a-carved-cizhou-incense-burner-song-dynasty-257-c-a0e4fdab2d',
    },
    widths: [1280],
  },
  {
    id: 'pp-9V94G9P2',
    alt: 'Thân lư hương gốm men kem trắng có hoa sen và hoa văn cuộn khắc chìm màu nâu.',
    credit: {
      title: 'Lư hương men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.si.edu/object/body-incense-burner-missing-rim-and-foot-cizhou-ware:fsg_F1970.47',
    },
    widths: [1280],
  },
  {
    id: 'pp-5XS2NP2V',
    alt: 'Lư hương gốm men kem miệng loe rộng khắc hoa văn dây cuộn nâu nhạt, chân tròn trơ màu đất.',
    credit: {
      title: 'Lư hương men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://bidlive.leonardjoel.com.au/auction-lot/a-chinese-cizhou-censer-song-dynasty-960-1279_EC740E4918',
    },
    widths: [1280],
  },
  {
    id: 'pp-3EXPSJQK',
    alt: 'Lư hương men kem trắng trên chân cao, nắp đục lỗ màu nâu đỏ.',
    credit: {
      title: 'Lư hương men hoa nâu',
      author: 'unknown',
      license: 'unknown',
      licenseUrl: '',
      sourceUrl:
        'https://www.sothebys.com/en/buy/auction/2022/china-5000-years-3/a-cizhou-white-glazed-incense-burner-song-dynasty?locale=en',
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
  {
    photo: 'pp-NMTBV2V8',
    target: 'PRODUCT',
    key: 'NMTBV2V8',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men trắng vẽ hoa sen xanh nhạt gồm ấm có viền xanh đậm, các chén và đĩa lót.',
    altEn:
      'White tea set hand-painted with pale blue lotus flowers, with a teapot and cups and saucers rimmed in dark green.',
  },
  {
    photo: 'pp-APRGZXKJ',
    target: 'PRODUCT',
    key: 'APRGZXKJ',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa nhỏ men trắng ngà viền nổi hoa văn cánh hoa và đường gân, nền trắng.',
    altEn:
      'Small ivory-glazed plate with a raised petal motif and ribbed centre, on a white background.',
  },
  {
    photo: 'pp-5HJ4M6XJ',
    target: 'PRODUCT',
    key: '5HJ4M6XJ',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà hình nón men trắng rạn vẽ lá sen xanh, chân để mộc, đặt trên mặt gỗ.',
    altEn:
      'Conical tea cup with crackled white glaze painted with green lotus leaves and an unglazed foot, on a wooden surface.',
  },
  {
    photo: 'pp-SHTBATDK',
    target: 'PRODUCT',
    key: 'SHTBATDK',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà tròn men rạn màu xám với các vết nứt lớn, chân để mộc nâu, nền xám nhạt.',
    altEn:
      'Round grey crackle-glaze tea cup with large crackle lines and a brown unglazed foot, on a pale grey background.',
  },
  {
    photo: 'pp-US2Y4X54',
    target: 'PRODUCT',
    key: 'US2Y4X54',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men rạn màu trắng ngà với ấm có quai kim loại, sáu chén và đĩa lót, đặt trên chiếu cói.',
    altEn: 'Ivory crackle-glaze teapot with a wire handle, six cups and saucers on a woven mat.',
  },
  {
    photo: 'pp-5UT6F26K',
    target: 'PRODUCT',
    key: '5UT6F26K',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà hình nón vẽ lá sen và hoa sen xanh trên nền men trắng rạn, chân để mộc.',
    altEn:
      'Conical tea cup painted with green lotus leaves on a white crackled glaze, with an unglazed foot.',
  },
  {
    photo: 'pp-8PR9BKZU',
    target: 'PRODUCT',
    key: '8PR9BKZU',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén sứ trắng vẽ hoa sen xanh ngọc và lá sen, đặt trên mặt bàn gỗ trước tường gạch trắng.',
    altEn:
      'White porcelain tea set painted with teal lotus flowers and leaves, on a wooden table in front of a white brick wall.',
  },
  {
    photo: 'pp-NP4T3857',
    target: 'PRODUCT',
    key: 'NP4T3857',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn nhỏ men trắng ngà trơn, nghiêng nhẹ, nền trắng.',
    altEn: 'Small plain round ivory-white glazed plate tilted slightly, on a white background.',
  },
  {
    photo: 'pp-VABNMVCN',
    target: 'PRODUCT',
    key: 'VABNMVCN',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà men trắng rạn dày vết nứt, được chiếu sáng từ bên trong trên nền đen.',
    altEn:
      'White crackle-glaze tea cup with dense crackle lines, lit from within against a black background.',
  },
  {
    photo: 'pp-8NK5Y5HF',
    target: 'PRODUCT',
    key: '8NK5Y5HF',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men rạn màu kem vẽ hoa sen xanh gồm ấm quai mây, chén vuông và đĩa lót trên nền xám nhạt.',
    altEn:
      'Cream crackle-glaze tea set painted with blue lotus: a rattan-handled teapot, cups and small square plates on a pale grey background.',
  },
  {
    photo: 'pp-XHUW33XA',
    target: 'PRODUCT',
    key: 'XHUW33XA',
    role: 'COVER',
    position: 0,
    alt: 'Ba chén trà nhỏ vẽ hoa sen và lá sen xếp nghiêng trên đĩa đen.',
    altEn: 'Three small tea cups painted with lotus flowers and leaves, tilted on a black plate.',
  },
  {
    photo: 'pp-7ZMF3CET',
    target: 'PRODUCT',
    key: '7ZMF3CET',
    role: 'COVER',
    position: 0,
    alt: 'Chén tống men trắng ngà có miệng rót nhọn, đặt trên khăn vải, phía sau là các chén nhỏ mờ.',
    altEn:
      'Ivory-glazed pitcher-style fair cup with a pointed spout, resting on a cloth coaster with small cups blurred behind.',
  },
  {
    photo: 'pp-X8X6R2AR',
    target: 'PRODUCT',
    key: 'X8X6R2AR',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm trà men xanh nhạt vẽ lá sen xanh ngọc và nụ sen đỏ gồm ấm quai tre và bốn chén trên khay tre.',
    altEn:
      'Pale celadon tea set painted with teal lotus leaves and red lotus buds: a teapot with a bamboo handle and four cups on a bamboo tray.',
  },
  {
    photo: 'pp-HWKG9TFU',
    target: 'PRODUCT',
    key: 'HWKG9TFU',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men rạn xám xanh với ấm quai xách và năm chén đặt trên khay trà gỗ.',
    altEn: 'Grey-blue crackle-glaze teapot with a bail handle and five cups on a wooden tea tray.',
  },
  {
    photo: 'pp-YJNEM242',
    target: 'PRODUCT',
    key: 'YJNEM242',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà thân thẳng men rạn xanh lục với vết nứt đen đậm trên nền tối.',
    altEn:
      'Straight-sided green crackle-glaze tea cup with bold dark crackle lines against a dark background.',
  },
  {
    photo: 'pp-KMAXWCMN',
    target: 'PRODUCT',
    key: 'KMAXWCMN',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm trà gốm xám gợn vẽ sen đỏ và lá sen xanh gồm ấm, chén tống và năm chén nhỏ trên nền trắng.',
    altEn:
      'Grey swirl-glazed tea set painted with red lotus flowers and green lotus leaves: a teapot, a pitcher and five small cups on a white background.',
  },
  {
    photo: 'pp-DZ4FT343',
    target: 'PRODUCT',
    key: 'DZ4FT343',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà sứ trắng vẽ cánh sen hồng ở thân và viền miệng xanh lá, nền trắng.',
    altEn:
      'White porcelain tea cup painted with pink lotus petals on the body and a green rim, on a white background.',
  },
  {
    photo: 'pp-DWPF6N2Z',
    target: 'PRODUCT',
    key: 'DWPF6N2Z',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà men rạn xanh lá tươi chân cao, vết nứt mịn, đặt trên nền trắng.',
    altEn:
      'Bright green crackle-glaze footed tea cup with fine crackle lines on a white background.',
  },
  {
    photo: 'pp-CUMJFVDF',
    target: 'PRODUCT',
    key: 'CUMJFVDF',
    role: 'COVER',
    position: 0,
    alt: 'Chén tống men xanh lam nhạt có quai tròn và miệng rót, đặt trên khăn dệt nâu.',
    altEn:
      'Pale blue-glazed fair pitcher with a round handle and a pouring lip, on a woven brown mat.',
  },
  {
    photo: 'pp-MAF7PJP5',
    target: 'PRODUCT',
    key: 'MAF7PJP5',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm trà men rạn màu xanh lá với ấm quai xách và sáu chén trên khăn trải bàn xám.',
    altEn: 'Green crackle-glaze teapot with a bail handle and six cups on a grey table runner.',
  },
  {
    photo: 'pp-ZRJNHUKB',
    target: 'PRODUCT',
    key: 'ZRJNHUKB',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa nhỏ men lam đậm bóng có các vòng gờ nổi, nền trắng.',
    altEn:
      'Small glossy deep cobalt-blue glazed saucer with concentric raised rings, on a white background.',
  },
  {
    photo: 'pp-YVSK5KJN',
    target: 'PRODUCT',
    key: 'YVSK5KJN',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà hình nón vẽ lá sen xanh và hoa sen trên men trắng rạn, đặt nghiêng trên bàn gỗ, phía sau là hai chén khác.',
    altEn:
      'Conical tea cup painted with green lotus leaves on a crackled white glaze, tilted on a wooden table with two more cups behind.',
  },
  {
    photo: 'pp-DGX2MN5B',
    target: 'PRODUCT',
    key: 'DGX2MN5B',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men xanh nhạt vẽ sen xanh ngọc gồm ấm và sáu chén có đĩa lót trên mặt bàn gỗ.',
    altEn:
      'Pale celadon tea set painted with teal lotus: a teapot and six cups with saucers on a wooden table.',
  },
  {
    photo: 'pp-ZK5PQWJV',
    target: 'PRODUCT',
    key: 'ZK5PQWJV',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn men trắng ngà có viền gợn sóng, mặt men sờn cũ, đặt trên mặt đá xám.',
    altEn:
      'Round ivory-glazed plate with a wavy rim and a worn glaze, resting on a grey stone surface.',
  },
  {
    photo: 'pp-MP64NTCQ',
    target: 'PRODUCT',
    key: 'MP64NTCQ',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà men rạn xanh xám đặt trên khay trà gỗ, phía sau là ấm trà mờ.',
    altEn: 'Grey-green crackle-glaze tea cup on a wooden tea tray with a blurred teapot behind.',
  },
  {
    photo: 'pp-UWNQUKZK',
    target: 'PRODUCT',
    key: 'UWNQUKZK',
    role: 'COVER',
    position: 0,
    alt: 'Bộ trà men rạn xanh ngọc gồm ấm có quai, chén tống, chén nắp và các chén nhỏ viền nâu xếp vòng trên nền trắng.',
    altEn:
      'Celadon crackle-glaze tea set with a teapot, fair pitcher, lidded gaiwan and small brown-rimmed cups arranged in a ring on a white background.',
  },
  {
    photo: 'pp-NCGV8GDH',
    target: 'PRODUCT',
    key: 'NCGV8GDH',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn men trắng ngà hơi ngả kem, lòng đĩa sâu, đặt trên mặt đá xám.',
    altEn: 'Round cream-ivory glazed plate with a shallow well, resting on a grey stone surface.',
  },
  {
    photo: 'pp-RW4ZX9AC',
    target: 'PRODUCT',
    key: 'RW4ZX9AC',
    role: 'COVER',
    position: 0,
    alt: 'Chén trà sứ trắng vẽ hoa sen hồng nhạt đặt trong hộp quà màu đen.',
    altEn:
      'White porcelain tea cup painted with pale pink lotus flowers, resting in a black gift box.',
  },
  {
    photo: 'pp-CFP8TG5P',
    target: 'PRODUCT',
    key: 'CFP8TG5P',
    role: 'COVER',
    position: 0,
    alt: 'Chén tống men trắng ngà rạn nhẹ có miệng rót, được một bàn tay nâng đỡ.',
    altEn: 'Ivory-glazed fair cup with faint crackle and a pouring spout, held on an open palm.',
  },
  {
    photo: 'pp-X52GJMNC',
    target: 'PRODUCT',
    key: 'X52GJMNC',
    role: 'COVER',
    position: 0,
    alt: 'Chén tống men lam đậm chảy loang trắng ở thân, có miệng rót, đặt trên vải lanh.',
    altEn:
      'Fair cup with a deep blue glaze running into white at the middle and a pouring lip, on a linen cloth.',
  },
  {
    photo: 'pp-BH82B7WA',
    target: 'PRODUCT',
    key: 'BH82B7WA',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men kem vẽ sen xanh đậm với ấm quai mây, sáu chén và đĩa lót trên nền xám nhạt.',
    altEn:
      'Cream-glazed tea set with dark green lotus painting: a rattan-handled teapot, six cups and saucers on a pale grey background.',
  },
  {
    photo: 'pp-GWMBFE73',
    target: 'PRODUCT',
    key: 'GWMBFE73',
    role: 'COVER',
    position: 0,
    alt: 'Bộ ấm chén men rạn màu kem viền vàng vẽ sen xanh chàm gồm ấm, sáu chén và đĩa lót trên nền trắng.',
    altEn:
      'Cream crackle-glaze tea set with gold rims and indigo-blue lotus painting: a teapot and six cups on saucers, on a white background.',
  },
  {
    photo: 'pp-ZN5BK3CQ',
    target: 'PRODUCT',
    key: 'ZN5BK3CQ',
    role: 'COVER',
    position: 0,
    alt: 'Tô sứ tròn viền cánh hoa vẽ hoa văn xanh lam trên nền men trắng, bên trong vẽ các nhân vật, chụp trên nền trắng.',
    altEn:
      'A round porcelain bowl with a scalloped rim, blue hand-painted figures and foliage on white glaze, photographed on a white background.',
  },
  {
    photo: 'pp-HEWCUZ3W',
    target: 'PRODUCT',
    key: 'HEWCUZ3W',
    role: 'COVER',
    position: 0,
    alt: 'Hũ gốm nắp tròn có núm, phủ men nâu sẫm đốm với các đường gờ ngang quanh thân.',
    altEn:
      'A round lidded stoneware jar with a knob, covered in dark speckled brown glaze with horizontal throwing rings.',
  },
  {
    photo: 'pp-YEAAG5QG',
    target: 'PRODUCT',
    key: 'YEAAG5QG',
    role: 'COVER',
    position: 0,
    alt: 'Khay trà vuông có lỗ thoát nước, ở giữa là ô men xanh nhạt vẽ nổi hoa sen hồng và lá, viền xanh đậm.',
    altEn:
      'A square tea tray with drainage slots, a pale green central tile showing a pink lotus and leaves, and a dark blue rim.',
  },
  {
    photo: 'pp-T7ZAQPP3',
    target: 'PRODUCT',
    key: 'T7ZAQPP3',
    role: 'COVER',
    position: 0,
    alt: 'Cốc có quai men xanh ngọc nhạt, thân khắc nổi họa tiết chấm, đặt trên tấm vải thô bên cạnh ít hạt và vỏ cam khô.',
    altEn:
      'A pale celadon-green mug with a loop handle and a dotted relief texture, resting on a rough linen cloth.',
  },
  {
    photo: 'pp-HX2M9KQD',
    target: 'PRODUCT',
    key: 'HX2M9KQD',
    role: 'COVER',
    position: 0,
    alt: 'Bát sứ men trong vẽ lam hình bông sen và lá, nhìn nghiêng trên nền trắng.',
    altEn:
      'A porcelain bowl under clear glaze with a blue-painted lotus blossom and leaves, side view on white.',
  },
  {
    photo: 'pp-VBJDE3XM',
    target: 'PRODUCT',
    key: 'VBJDE3XM',
    role: 'COVER',
    position: 0,
    alt: 'Hũ gốm có nắp, thân màu kem phủ họa tiết hoa lá nâu đậm, nắp có núm nhọn, chụp trên nền tối.',
    altEn:
      'A lidded ceramic jar with a cream body and dark brown scrolling floral decoration, topped by a pointed knob, on a dark background.',
  },
  {
    photo: 'pp-YT8G4F7E',
    target: 'PRODUCT',
    key: 'YT8G4F7E',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa gốm men rạn viền vàng, giữa có quả đào nổi màu vàng nâu và hoa vàng trên nền chấm xanh, đặt trên giá đỡ.',
    altEn:
      'A crackle-glazed dish with a gilded rim and a raised amber peach with gold flowers on a blue-dotted ground, standing on a stand.',
  },
  {
    photo: 'pp-V7QSBKE7',
    target: 'PRODUCT',
    key: 'V7QSBKE7',
    role: 'COVER',
    position: 0,
    alt: 'Bát sứ men trắng vẽ hoa sen xanh lam và viền hoa văn, chụp trên nền cam.',
    altEn:
      'A white porcelain bowl painted in cobalt blue with lotus flowers and a patterned rim band, on an orange backdrop.',
  },
  {
    photo: 'pp-M6C26W8E',
    target: 'PRODUCT',
    key: 'M6C26W8E',
    role: 'COVER',
    position: 0,
    alt: 'Khay gốm trắng kem hình dáng uốn lượn, giữa khay vẽ mực một nhánh sen và đài sen khô.',
    altEn:
      'A cream-white ceramic tray with a wavy outline and an ink-painted lotus stem and seed pod at its centre.',
  },
  {
    photo: 'pp-K7J9UK5N',
    target: 'PRODUCT',
    key: 'K7J9UK5N',
    role: 'COVER',
    position: 0,
    alt: 'Cốc có nắp men xanh ngọc nhạt, núm nắp hình thú nhỏ, thân khắc nổi hình rồng và sóng, quai cong.',
    altEn:
      'A pale celadon-green lidded mug with a small animal-shaped knob, a dragon-and-wave relief on the body and a curved handle.',
  },
  {
    photo: 'pp-SET5S9VZ',
    target: 'PRODUCT',
    key: 'SET5S9VZ',
    role: 'COVER',
    position: 0,
    alt: 'Cốc sứ trụ cao men trắng vẽ hoa mẫu đơn xanh lam, viền họa tiết quanh miệng, quai hình thân tre.',
    altEn:
      'A tall white porcelain mug painted in cobalt blue with peony flowers, a patterned rim band and a bamboo-shaped handle.',
  },
  {
    photo: 'pp-UWY8KZUG',
    target: 'PRODUCT',
    key: 'UWY8KZUG',
    role: 'COVER',
    position: 0,
    alt: 'Bát gốm men rạn trắng xám kiểu Nhật, nhìn nghiêng trên tấm vải, nền xanh mờ.',
    altEn:
      'A Japanese-style white-grey crackle-glazed ceramic bowl, side view on cloth with a soft green background.',
  },
  {
    photo: 'pp-PQNMSM5U',
    target: 'PRODUCT',
    key: 'PQNMSM5U',
    role: 'COVER',
    position: 0,
    alt: 'Hũ sứ lục giác có nắp, thân trắng vẽ hoa lá và chim màu nâu xanh, đặt trên nền xám.',
    altEn:
      'A hexagonal lidded porcelain jar with a white body painted in brown and green with flowers, leaves and a bird, on a grey surface.',
  },
  {
    photo: 'pp-M2BKH982',
    target: 'PRODUCT',
    key: 'M2BKH982',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa gốm men rạn viền xanh, giữa có quả đào nổi màu vàng-xanh và hoa nâu trên nền chấm xanh, đặt trên giá đỡ.',
    altEn:
      'A crackle-glazed dish with a blue-lined rim and a raised amber-and-blue peach with brown flowers on a dotted ground, on a stand.',
  },
  {
    photo: 'pp-6VWZD2XN',
    target: 'PRODUCT',
    key: '6VWZD2XN',
    role: 'COVER',
    position: 0,
    alt: 'Khay sứ hình bát giác vẽ bó hoa sen xanh lam và đỏ cam trên nền men trắng, đặt trên tấm vải xanh.',
    altEn:
      'An octagonal porcelain tray painted with a bunch of lotus flowers in cobalt blue and orange-red on white glaze, on a blue cloth.',
  },
  {
    photo: 'pp-GU874TFN',
    target: 'PRODUCT',
    key: 'GU874TFN',
    role: 'COVER',
    position: 0,
    alt: 'Cốc có nắp men xanh ngọc, quai nhỏ có vòng xoắn, núm nắp gỗ, đặt trên bàn gỗ cạnh cửa sổ.',
    altEn:
      'A celadon-green lidded mug with a small curled handle and a wooden lid knob, standing on a wooden table by a window.',
  },
  {
    photo: 'pp-SS8KJXV9',
    target: 'PRODUCT',
    key: 'SS8KJXV9',
    role: 'COVER',
    position: 0,
    alt: 'Bát sứ trắng vẽ nhiều màu hoa sen hồng, lá sen xanh và một chú chim, chân bát thấp.',
    altEn:
      'A white porcelain bowl painted in colour with pink lotus flowers, green leaves and a small bird, on a low foot.',
  },
  {
    photo: 'pp-EB5QN3AE',
    target: 'PRODUCT',
    key: 'EB5QN3AE',
    role: 'COVER',
    position: 0,
    alt: 'Hũ gốm nhỏ có nắp, men nâu xanh ô-liu ở phần trên và nâu đỏ ở chân, đặt trên nền trắng.',
    altEn:
      'A small lidded stoneware jar with olive-brown glaze above and a bare reddish-brown foot, on a white background.',
  },
  {
    photo: 'pp-KFKMFADC',
    target: 'PRODUCT',
    key: 'KFKMFADC',
    role: 'COVER',
    position: 0,
    alt: 'Khay chữ nhật nông men xanh ngọc lam, bề mặt men có các đường rạn nhỏ, chụp trên nền trắng.',
    altEn:
      'A shallow rectangular tray with a turquoise-green glaze showing fine crazing, on a white background.',
  },
  {
    photo: 'pp-QWE7JGZD',
    target: 'PRODUCT',
    key: 'QWE7JGZD',
    role: 'COVER',
    position: 0,
    alt: 'Hai chiếc bát men rạn màu kem xếp chồng, thân đắp nổi hoa sen vàng nâu và nét xanh lam, nền trắng.',
    altEn:
      'Two stacked cream crackle-glazed bowls with raised amber lotus blossoms and blue accents, on a white background.',
  },
  {
    photo: 'pp-HMRAC7CQ',
    target: 'PRODUCT',
    key: 'HMRAC7CQ',
    role: 'COVER',
    position: 0,
    alt: 'Hũ gốm vuông có nắp, phủ men nâu đồng loang đốm, đặt trên mặt bàn nâu mờ.',
    altEn:
      'A square lidded ceramic jar with a speckled bronze-brown glaze, standing on a dark brown cloth.',
  },
  {
    photo: 'pp-CKQYMBXY',
    target: 'PRODUCT',
    key: 'CKQYMBXY',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa sứ men trắng vẽ lam hình hoa sen và đôi vịt uyên ương, viền họa tiết ô trám, được hai tay nâng lên.',
    altEn:
      'A white porcelain dish painted in blue with lotus and a pair of ducks inside a diamond-pattern border, held in two hands.',
  },
  {
    photo: 'pp-PUEKDH6V',
    target: 'PRODUCT',
    key: 'PUEKDH6V',
    role: 'COVER',
    position: 0,
    alt: 'Cốc có nắp men xanh ngọc nhạt khắc nổi hoa lá, quai cong, đặt trên đế gỗ sẫm.',
    altEn:
      'A pale celadon-green lidded mug with carved floral relief and a curved handle, standing on a dark wooden stand.',
  },
  {
    photo: 'pp-SKT3T7E7',
    target: 'PRODUCT',
    key: 'SKT3T7E7',
    role: 'COVER',
    position: 0,
    alt: 'Bát sứ men kem vẽ nhiều màu hoa sen đỏ nâu cùng dây lá xanh, chân cao viền vàng hoa văn chữ nhật, đặt trên bàn gỗ.',
    altEn:
      'A cream porcelain bowl painted in colour with a red-brown lotus and green scrolling leaves, on a gilded geometric foot, on a wooden table.',
  },
  {
    photo: 'pp-45YAPP9R',
    target: 'PRODUCT',
    key: '45YAPP9R',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn viền lượn sóng men xanh ngọc nhạt với các đường rạn lớn, viền đồng đỏ, chụp từ trên xuống.',
    altEn:
      'A round scalloped-rim plate in pale celadon glaze with large crackle lines and a copper-coloured edge, seen from above.',
  },
  {
    photo: 'pp-YR3C94VH',
    target: 'PRODUCT',
    key: 'YR3C94VH',
    role: 'COVER',
    position: 0,
    alt: 'Cốc sứ cao men trắng vẽ hoa mẫu đơn và lá xanh lam, viền ô trám quanh miệng, quai cong, men hơi cũ.',
    altEn:
      'A tall white porcelain mug painted in blue with peonies and leaves, a lattice band at the rim and a curved handle, with some age wear.',
  },
  {
    photo: 'pp-T7DXR28D',
    target: 'PRODUCT',
    key: 'T7DXR28D',
    role: 'COVER',
    position: 0,
    alt: 'Hũ gốm tròn nắp phẳng phủ men nâu vàng loang đốm kiểu thô, đặt trên tấm đệm cói.',
    altEn:
      'A rounded lidded ceramic jar with a rustic mottled brown glaze, sitting on a woven mat.',
  },
  {
    photo: 'pp-2X9QFA6B',
    target: 'PRODUCT',
    key: '2X9QFA6B',
    role: 'COVER',
    position: 0,
    alt: 'Khay trà tròn men trắng vẽ lam hoa lá cuộn và sen, giữa khay có ô thoát nước hoa văn chữ nhật.',
    altEn:
      'A round white porcelain tea tray painted in blue with scrolling flowers and lotus, with a patterned drain panel in the centre.',
  },
  {
    photo: 'pp-GEMZPJK5',
    target: 'PRODUCT',
    key: 'GEMZPJK5',
    role: 'COVER',
    position: 0,
    alt: 'Cốc có nắp men xanh lá nhạt bóng, thân tròn bầu, quai tròn, đặt trên đế gỗ cạnh cuốn sách.',
    altEn:
      'A glossy light-green lidded mug with a rounded body and loop handle, set on a wooden coaster beside an open book.',
  },
  {
    photo: 'pp-H6KBXFZB',
    target: 'PRODUCT',
    key: 'H6KBXFZB',
    role: 'COVER',
    position: 0,
    alt: 'Khay gốm xanh lục bát giác nông men bóng với các đường rạn nhỏ, chụp nghiêng trên nền trắng.',
    altEn:
      'A shallow octagonal ceramic tray in glossy teal glaze with fine crackle, shown at an angle on white.',
  },
  {
    photo: 'pp-YNKHKZFS',
    target: 'PRODUCT',
    key: 'YNKHKZFS',
    role: 'COVER',
    position: 0,
    alt: 'Bát gốm men rạn màu be với các đường rạn lớn rõ rệt, chụp trên nền xám.',
    altEn:
      'A beige crackle-glazed ceramic bowl with prominent large crackle lines, on a grey background.',
  },
  {
    photo: 'pp-Q5YPG5TW',
    target: 'PRODUCT',
    key: 'Q5YPG5TW',
    role: 'COVER',
    position: 0,
    alt: 'Tô sứ lớn men trắng vẽ hoa văn xanh lam cầu kỳ bên trong và bên ngoài, đặt trên nền trắng.',
    altEn:
      'A large white porcelain bowl hand-painted in dense cobalt-blue floral patterns, shown on a plain white background.',
  },
  {
    photo: 'pp-KKVB8B28',
    target: 'PRODUCT',
    key: 'KKVB8B28',
    role: 'COVER',
    position: 0,
    alt: 'Khay trà gỗ nâu sẫm có rãnh thoát nước, đặt ba chén nhỏ màu vàng nhạt, nền sáng.',
    altEn:
      'A dark brown wooden tea tray with drainage grooves, holding three small pale yellow cups, on a light backdrop.',
  },
  {
    photo: 'pp-JH22Y4FY',
    target: 'PRODUCT',
    key: 'JH22Y4FY',
    role: 'COVER',
    position: 0,
    alt: 'Cốc trụ men xanh ngọc đậm kèm nắp đặt bên cạnh, quai tre và núm nắp hình thú nhỏ, trên nền xám nhạt.',
    altEn:
      'A deep celadon-green cylindrical mug with a bamboo-style handle, its lid with a small animal knob placed beside it, on a pale grey surface.',
  },
  {
    photo: 'pp-JCMU8F99',
    target: 'PRODUCT',
    key: 'JCMU8F99',
    role: 'COVER',
    position: 0,
    alt: 'Bình hút lộc tròn men trắng ngà vẽ đàn ngựa phi, đặt trên đế gỗ nâu, nền trắng.',
    altEn:
      'Round ivory-white money jar with a painted herd of galloping horses, standing on a dark wooden base against a white background.',
  },
  {
    photo: 'pp-WDDP8NBV',
    target: 'PRODUCT',
    key: 'WDDP8NBV',
    role: 'COVER',
    position: 0,
    alt: 'Bình hút lộc tròn men trắng, mặt trước có chữ thư pháp Đức vẽ vàng bạc trong khung hoa văn, trên chiếu cói.',
    altEn:
      'Round white globe vase with a gold-and-silver calligraphy character in an ornamental frame, standing on a woven mat.',
  },
  {
    photo: 'pp-MP9XH99A',
    target: 'PRODUCT',
    key: 'MP9XH99A',
    role: 'COVER',
    position: 0,
    alt: 'Bình hút lộc tròn men trắng, mặt trước có chữ thư pháp Lộc vẽ vàng bạc trong khung hoa văn, trên chiếu cói.',
    altEn:
      'Round white globe vase with a gold-and-silver calligraphy character in an ornamental frame, standing on a woven mat.',
  },
  {
    photo: 'pp-UQXED4KM',
    target: 'PRODUCT',
    key: 'UQXED4KM',
    role: 'COVER',
    position: 0,
    alt: 'Bình hút lộc tròn men trắng vẽ vàng hình thuyền buồm, đặt trên đế gỗ giữa nền sân vườn đá và cây.',
    altEn:
      'Round white globe vase painted with a gold sailing ship, standing on a wooden base in front of a garden with rocks and foliage.',
  },
  {
    photo: 'pp-UUCHKZHP',
    target: 'PRODUCT',
    key: 'UUCHKZHP',
    role: 'COVER',
    position: 0,
    alt: 'Bình hút lộc tròn men lam vẽ hoa sen xanh cobalt viền vàng trên nền trắng, đặt trên đế gỗ nâu, có tấm vải đỏ phía sau.',
    altEn:
      'Round white-and-cobalt-blue globe vase painted with blue lotus flowers and gold outlines, on a dark wooden base with red cloth behind.',
  },
  {
    photo: 'pp-GX8HXYXM',
    target: 'PRODUCT',
    key: 'GX8HXYXM',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao dáng thon miệng loe, vẽ lam cảnh sơn thủy trên nền men trắng, đứng trên nền màu cam.',
    altEn:
      'Tall slender baluster floor vase with a flared mouth, hand-painted in cobalt blue with a mountain-and-water landscape on a white glaze, against an orange backdrop.',
  },
  {
    photo: 'pp-Q59BEKH7',
    target: 'PRODUCT',
    key: 'Q59BEKH7',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe, vẽ lam cảnh núi sông chùa chiền dày đặc trên nền men trắng, nền màu cam.',
    altEn:
      'Tall baluster floor vase with flared mouth, densely painted in cobalt blue with mountains, rivers and temple scenery, against an orange backdrop.',
  },
  {
    photo: 'pp-K8PXZ5G9',
    target: 'PRODUCT',
    key: 'K8PXZ5G9',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe, vẽ lam hình chim hạc và hoa sen trên men trắng, nền màu cam.',
    altEn:
      'Tall baluster floor vase with flared mouth, painted in cobalt blue with cranes and lotus flowers on white glaze, against an orange backdrop.',
  },
  {
    photo: 'pp-VJ6DV94W',
    target: 'PRODUCT',
    key: 'VJ6DV94W',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe men trắng ngà, họa tiết xám xanh nhạt và dải hoa văn chữ nhật quanh chân, nền màu cam.',
    altEn:
      'Tall ivory-white baluster floor vase with flared mouth, pale grey-blue painted motifs and a geometric band around the foot, against an orange backdrop.',
  },
  {
    photo: 'pp-ZWPNY89D',
    target: 'PRODUCT',
    key: 'ZWPNY89D',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe men trắng ngà vẽ chim hạc màu xám mực, nền màu cam.',
    altEn:
      'Tall ivory-white baluster floor vase with flared mouth, painted with grey-ink cranes, against an orange backdrop.',
  },
  {
    photo: 'pp-PRG7H26B',
    target: 'PRODUCT',
    key: 'PRG7H26B',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe men trắng ngà vẽ tùng và hạc bằng nét mực xám, nền màu cam.',
    altEn:
      'Tall ivory-white baluster floor vase with flared mouth, painted with pine and crane in grey ink lines, against an orange backdrop.',
  },
  {
    photo: 'pp-3FRX4ANJ',
    target: 'PRODUCT',
    key: '3FRX4ANJ',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe men trắng ngà vẽ hạc và hoa mẫu đơn bằng nét xanh xám, nền màu cam.',
    altEn:
      'Tall ivory-white baluster floor vase with flared mouth, painted with a crane and peonies in grey-blue lines, against an orange backdrop.',
  },
  {
    photo: 'pp-J4KAQ2ZA',
    target: 'PRODUCT',
    key: 'J4KAQ2ZA',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe men trắng ngà, thân đắp nổi và vẽ họa tiết lam, vàng và nâu, nền màu cam.',
    altEn:
      'Tall ivory-white baluster floor vase with flared mouth, body decorated with relief and blue, gold and brown painted motifs, against an orange backdrop.',
  },
  {
    photo: 'pp-XMCX5RJX',
    target: 'PRODUCT',
    key: 'XMCX5RJX',
    role: 'COVER',
    position: 0,
    alt: 'Lục bình cao miệng loe men trắng ngà, họa tiết đắp nổi và vẽ vàng nâu hình thông, nền màu cam.',
    altEn:
      'Tall ivory-white baluster floor vase with flared mouth, relief and gold-brown painted pine motifs, against an orange backdrop.',
  },
  {
    photo: 'pp-JVANRMAB',
    target: 'PRODUCT',
    key: 'JVANRMAB',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai nhỏ, men trắng rạn, vẽ lam cảnh sông núi, nền trắng.',
    altEn:
      'Lidded liquor jar with two small lugs and a crackled white glaze, painted in blue with a river-and-mountain scene, on a white background.',
  },
  {
    photo: 'pp-BQ2Z83ZY',
    target: 'PRODUCT',
    key: 'BQ2Z83ZY',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam cây tùng và ngôi chùa, nền trắng.',
    altEn:
      'Lidded liquor jar with two lugs and a crackled white glaze, painted in blue with a pine tree and a pagoda, on a white background.',
  },
  {
    photo: 'pp-FDT9HNPV',
    target: 'PRODUCT',
    key: 'FDT9HNPV',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam ba ông già chơi cờ, nền trắng.',
    altEn:
      'Lidded liquor jar with two lugs and a crackled white glaze, painted in blue with three elders playing a board game, on a white background.',
  },
  {
    photo: 'pp-G5BEKP4Q',
    target: 'PRODUCT',
    key: 'G5BEKP4Q',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam các nhân vật nam, nền trắng.',
    altEn:
      'Lidded liquor jar with two lugs and a crackled white glaze, painted in blue with a group of male figures, on a white background.',
  },
  {
    photo: 'pp-JDVBJK4U',
    target: 'PRODUCT',
    key: 'JDVBJK4U',
    role: 'COVER',
    position: 0,
    alt: 'Vò có nắp và hai quai, men trắng vẽ lam cây tùng và sóng nước, chụp ở sân xi măng cạnh tường.',
    altEn:
      'Lidded jar with two lugs, white glaze painted in blue with a pine tree and waves, photographed on a concrete floor by a wall.',
  },
  {
    photo: 'pp-5MSDE3JW',
    target: 'PRODUCT',
    key: '5MSDE3JW',
    role: 'COVER',
    position: 0,
    alt: 'Chum ngâm rượu có nắp và hai quai nhỏ, men trắng vẽ lam cảnh làng quê bên hồ, đặt trên nền đất trong xưởng.',
    altEn:
      'Lidded liquor jar with two small lugs, white glaze painted in blue with a lakeside village scene, standing on a dusty floor in a workshop.',
  },
  {
    photo: 'pp-K5NGRZEP',
    target: 'PRODUCT',
    key: 'K5NGRZEP',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai, men trắng vẽ lam hoa sen, lá và cá, đặt trên nền đất trong xưởng.',
    altEn:
      'Lidded liquor jar with two lugs, white glaze painted in blue with lotus flowers, leaves and a fish, standing on a dusty floor in a workshop.',
  },
  {
    photo: 'pp-8A6GKN9W',
    target: 'PRODUCT',
    key: '8A6GKN9W',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai, men trắng vẽ lam hoa sen, lá và cá chép, đặt trên nền đất trong xưởng.',
    altEn:
      'Lidded liquor jar with two lugs, white glaze painted in blue with lotus flowers, leaves and a carp, standing on a dusty floor in a workshop.',
  },
  {
    photo: 'pp-XQ3Y2NFC',
    target: 'PRODUCT',
    key: 'XQ3Y2NFC',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp nâu đen, thân men vàng kem vẽ hoa sen hồng và cá đỏ cam, chụp trong phòng.',
    altEn:
      'Lidded liquor jar with a dark brown lid and a cream-yellow body painted with pink lotus flowers and orange fish, photographed indoors.',
  },
  {
    photo: 'pp-HSUJQP77',
    target: 'PRODUCT',
    key: 'HSUJQP77',
    role: 'COVER',
    position: 0,
    alt: 'Chum rượu có nắp và hai quai, men trắng rạn, vẽ lam hoa sen và chim hạc, nền trắng.',
    altEn:
      'Lidded liquor jar with two lugs and a crackled white glaze, painted in blue with lotus and a crane, on a white background.',
  },
  {
    photo: 'pp-F4X2V7C8',
    target: 'PRODUCT',
    key: 'F4X2V7C8',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa miệng loe viền gợn sóng, men nâu sẫm ở miệng và đáy, chảy sang trắng kem ở giữa thân, đặt trên bục gỗ.',
    altEn:
      'Flared ruffle-rimmed vase glazed dark brown at the rim and base, running to cream white around the middle, on a wooden platform.',
  },
  {
    photo: 'pp-MSZG9SBT',
    target: 'PRODUCT',
    key: 'MSZG9SBT',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa thân bầu men nâu bóng, miệng loe nhẹ có viền xám, đặt trên bục gỗ.',
    altEn:
      'Round-shouldered vase in glossy brown glaze with a slightly flared grey-rimmed mouth, on a wooden platform.',
  },
  {
    photo: 'pp-ED4HZ64W',
    target: 'PRODUCT',
    key: 'ED4HZ64W',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa dáng chân váy miệng loe có viền nâu, thân xám nâu với các đường vân ngang, đặt trên bục gỗ.',
    altEn:
      'Flared-mouth skirt-shaped vase with a brown rim and a grey-brown body with horizontal ridges, on a wooden platform.',
  },
  {
    photo: 'pp-M2VWGSWF',
    target: 'PRODUCT',
    key: 'M2VWGSWF',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa dáng thon cổ loe, men nâu be lốm đốm, đặt trên bục gỗ.',
    altEn: 'Slender flared-neck vase with a speckled beige-brown glaze, on a wooden platform.',
  },
  {
    photo: 'pp-BRMH663W',
    target: 'PRODUCT',
    key: 'BRMH663W',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa men trắng miệng loe, vẽ hoa sen với nét nâu đen và đường viền vàng cam, trên tấm lót đan.',
    altEn:
      'White flared-mouth vase painted with a lotus in dark brown lines with orange-gold outlines, on a woven mat.',
  },
  {
    photo: 'pp-NA4WKT3A',
    target: 'PRODUCT',
    key: 'NA4WKT3A',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa men trắng miệng loe, vẽ hoa sen bằng nét nâu đen và mảng nâu đỏ, trên tấm lót đan.',
    altEn:
      'White flared-mouth vase painted with lotus in dark brown lines and a reddish-brown patch, on a woven mat.',
  },
  {
    photo: 'pp-RNTYR2NV',
    target: 'PRODUCT',
    key: 'RNTYR2NV',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa men trắng dáng trụ, vẽ hoa sen bằng nét xám đen, trên tấm lót đan.',
    altEn: 'White cylindrical vase painted with a lotus in grey-black lines, on a woven mat.',
  },
  {
    photo: 'pp-FFMW7373',
    target: 'PRODUCT',
    key: 'FFMW7373',
    role: 'COVER',
    position: 0,
    alt: 'Lọ hoa men trắng dáng cao miệng loe, vẽ chuồn chuồn bằng nét đen nâu, đặt ngoài trời cạnh tượng đồng.',
    altEn:
      'Tall white flared-mouth vase painted with dragonflies in dark brown-black strokes, standing outdoors next to a bronze figurine.',
  },
  {
    photo: 'pp-Y2YTVDD6',
    target: 'PRODUCT',
    key: 'Y2YTVDD6',
    role: 'COVER',
    position: 0,
    alt: 'Bát có nắp men ngọc xanh nhạt, nắp và thân khắc nổi hoa sen, núm nắp tròn, đặt trên nền trắng.',
    altEn:
      'Pale jade-green celadon lidded bowl with lotus petals carved on the lid and body and a round knob, on a white background.',
  },
  {
    photo: 'pp-UCTN3QGB',
    target: 'PRODUCT',
    key: 'UCTN3QGB',
    role: 'COVER',
    position: 0,
    alt: 'Bát có nắp men ngọc xanh lục nhạt, vẽ tre và hai chú chim nhỏ, núm nắp hình giọt nước.',
    altEn:
      'Soft green celadon lidded bowl painted with bamboo and two small birds, with a teardrop-shaped lid knob.',
  },
  {
    photo: 'pp-U3G78AEE',
    target: 'PRODUCT',
    key: 'U3G78AEE',
    role: 'COVER',
    position: 0,
    alt: 'Bát có nắp men ngọc xanh nhạt vẽ hoa sen màu nâu xám, đặt trên mặt bàn gỗ.',
    altEn:
      'Pale green celadon lidded bowl with grey-brown lotus flowers painted on the lid and body, standing on a wooden surface.',
  },
  {
    photo: 'pp-FDJXY4Z4',
    target: 'PRODUCT',
    key: 'FDJXY4Z4',
    role: 'COVER',
    position: 0,
    alt: 'Bát có nắp men ngọc xám xanh, nắp và thân chạm nổi hoa văn, núm nắp nhọn, nền trắng.',
    altEn:
      'Grey-green celadon lidded bowl with relief-carved patterns on lid and body and a pointed knob, on a white background.',
  },
  {
    photo: 'pp-HBTKV2DF',
    target: 'PRODUCT',
    key: 'HBTKV2DF',
    role: 'COVER',
    position: 0,
    alt: 'Âu có nắp và hai quai nhỏ, vẽ lam hoa mai và hoa văn dày màu xanh cobalt trên nền trắng.',
    altEn:
      'Lidded soup tureen with two small handles, painted in cobalt blue with plum blossoms and dense motifs on white.',
  },
  {
    photo: 'pp-D3HNYZ8S',
    target: 'PRODUCT',
    key: 'D3HNYZ8S',
    role: 'COVER',
    position: 0,
    alt: 'Âu tròn có nắp, men trắng vẽ lam viền hoa văn và hai họa tiết tròn xanh, đặt trên khăn ren trắng.',
    altEn:
      'Round lidded tureen in white glaze with a blue painted border band and two round blue emblems, resting on white lace.',
  },
  {
    photo: 'pp-S6T8BV6P',
    target: 'PRODUCT',
    key: 'S6T8BV6P',
    role: 'COVER',
    position: 0,
    alt: 'Âu nhỏ hình lục giác có nắp, hai quai và núm nắp màu xanh cobalt, vẽ hoa lam trên nền trắng.',
    altEn:
      'Small hexagonal lidded tureen with two handles and a cobalt blue knob, painted with blue flowers on white.',
  },
  {
    photo: 'pp-PT8R7XHW',
    target: 'PRODUCT',
    key: 'PT8R7XHW',
    role: 'COVER',
    position: 0,
    alt: 'Âu có nắp, đế cao và muỗng, men trắng với hoa hồng xanh lam trên thân và nắp.',
    altEn:
      'Footed lidded soup tureen with a ladle, white glaze with blue rose motifs on the body and lid.',
  },
  {
    photo: 'pp-7SQB7AEZ',
    target: 'PRODUCT',
    key: '7SQB7AEZ',
    role: 'COVER',
    position: 0,
    alt: 'Âu hình chữ nhật bo góc có nắp, quai và muỗng, hoa văn xanh lam trên nền trắng.',
    altEn:
      'Rounded rectangular lidded tureen with handles and a ladle, decorated with blue floral patterns on white.',
  },
  {
    photo: 'pp-VBG7MWZ9',
    target: 'PRODUCT',
    key: 'VBG7MWZ9',
    role: 'COVER',
    position: 0,
    alt: 'Bình có quai và vòi rót, thân vuông bo, vẽ lam hoa văn dày đặc, quai xanh đậm, nền trắng.',
    altEn:
      'Tall pitcher with a spout and curved dark-blue handle, squared body painted in dense blue floral patterns, white background.',
  },
  {
    photo: 'pp-T68X3NBP',
    target: 'PRODUCT',
    key: 'T68X3NBP',
    role: 'COVER',
    position: 0,
    alt: 'Bình có quai, cổ rộng vẽ hoa văn xoắn, thân vẽ hoa lam, đế chân cao, nền trắng.',
    altEn:
      'Pitcher with a handle, scrolled blue pattern around the neck, blue flowers on the body and a footed base, white background.',
  },
  {
    photo: 'pp-AVN3E9QN',
    target: 'PRODUCT',
    key: 'AVN3E9QN',
    role: 'COVER',
    position: 0,
    alt: 'Bình tròn có quai uốn lượn, vẽ lam cảnh sơn thủy, hoa và băng hoa văn trên nền trắng.',
    altEn:
      'Round-bodied pitcher with a wavy handle, painted in blue with a landscape scene, flowers and a pattern band on white.',
  },
  {
    photo: 'pp-YGHEE9PZ',
    target: 'PRODUCT',
    key: 'YGHEE9PZ',
    role: 'COVER',
    position: 0,
    alt: 'Bình có quai đen, thân múi vẽ lam hoa văn, đặt trên bục trắng cắm cành lá.',
    altEn:
      'Pitcher with a black handle and a ribbed body painted in blue ornament, standing on a white block with leafy branches.',
  },
  {
    photo: 'pp-E4KJ2BNU',
    target: 'PRODUCT',
    key: 'E4KJ2BNU',
    role: 'COVER',
    position: 0,
    alt: 'Bình tròn có quai, men trắng ngà vẽ hoa lam tay, nền trắng.',
    altEn:
      'Round pitcher with a handle, ivory-white glaze hand-painted with blue flowers, white background.',
  },
  {
    photo: 'pp-ZA77GA58',
    target: 'PRODUCT',
    key: 'ZA77GA58',
    role: 'COVER',
    position: 0,
    alt: 'Bát thân cao men trắng ngà, vẽ họa tiết cánh hoa màu nâu đậm bên thân.',
    altEn: 'Tall ivory-glazed bowl with a dark brown petal-like motif painted on its side.',
  },
  {
    photo: 'pp-DNENZF4C',
    target: 'PRODUCT',
    key: 'DNENZF4C',
    role: 'COVER',
    position: 0,
    alt: 'Bát loe hình nón men kem ngà, lòng bát vẽ hoa lá màu nâu đậm rõ nét, viền miệng nâu, nền trắng.',
    altEn:
      'Conical flared bowl with a cream-ivory glaze and clearly painted dark-brown flowers and leaves inside, brown-edged rim, on a white background.',
  },
  {
    photo: 'pp-VQAVYC9G',
    target: 'PRODUCT',
    key: 'VQAVYC9G',
    role: 'COVER',
    position: 0,
    alt: 'Bát nhìn từ trên xuống, lòng bát men kem vẽ hoa lá nâu sắt ở giữa và viền sọc quanh miệng.',
    altEn:
      'Bowl seen from above, cream glaze with iron-brown flowers and leaves painted in the centre and a banded rim.',
  },
  {
    photo: 'pp-SK7VPR4P',
    target: 'PRODUCT',
    key: 'SK7VPR4P',
    role: 'COVER',
    position: 0,
    alt: 'Bát loe có chân đế, men nâu vàng chảy loang phủ thân ngoài, miệng để mộc, nền xám.',
    altEn:
      'Flared footed bowl with a mottled brown-amber glaze on the outside and an unglazed rim, on a grey background.',
  },
  {
    photo: 'pp-W8ARW89X',
    target: 'PRODUCT',
    key: 'W8ARW89X',
    role: 'COVER',
    position: 0,
    alt: 'Bát loe men nâu đỏ bóng, miệng loe rộng, thân thắt lại dần xuống chân đế mộc màu be, đặt trên mặt đá trắng.',
    altEn:
      'Glossy reddish-brown glazed bowl with a flared rim, the body narrowing in toward an unglazed tan foot, standing on a white marble surface.',
  },
  {
    photo: 'pp-8SQ95ZKU',
    target: 'PRODUCT',
    key: '8SQ95ZKU',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn men trắng ngà viền nâu mảnh, xếp cạnh chồng đĩa cùng loại, nền trắng.',
    altEn:
      'Round ivory-glazed plate with a thin brown rim, leaning in front of a stack of matching plates on white.',
  },
  {
    photo: 'pp-HJFXRHVE',
    target: 'PRODUCT',
    key: 'HJFXRHVE',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn men kem nhạt, mặt đĩa có vân xoáy, vành cao, chụp từ trên xuống.',
    altEn:
      'Round pale-cream glazed plate with swirled texture and a raised rim, photographed from above.',
  },
  {
    photo: 'pp-985G2ZCY',
    target: 'PRODUCT',
    key: '985G2ZCY',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn men trắng ngà viền nâu, đặt nghiêng trên chồng đĩa cùng loại, nền trắng.',
    altEn:
      'Round ivory-white plate with a brown rim propped on a stack of matching plates, white background.',
  },
  {
    photo: 'pp-Z5H3Q9SK',
    target: 'PRODUCT',
    key: 'Z5H3Q9SK',
    role: 'COVER',
    position: 0,
    alt: 'Chồng đĩa tròn men trắng ngà, đĩa trên cùng nghiêng để lộ viền nâu vàng, nền trắng.',
    altEn: 'Stack of round ivory-glazed plates, the top one tilted to show a tan rim, on white.',
  },
  {
    photo: 'pp-ZZ4BEK63',
    target: 'PRODUCT',
    key: 'ZZ4BEK63',
    role: 'COVER',
    position: 0,
    alt: 'Đĩa tròn men lam cobalt đậm chuyển sắc, viền đen, xếp cạnh chồng đĩa cùng loại, nền trắng.',
    altEn:
      'Round plate in a deep cobalt-blue glaze shading to dark edges, leaning against a stack of matching plates on white.',
  },
  {
    photo: 'pp-ABKB9FPN',
    target: 'PRODUCT',
    key: 'ABKB9FPN',
    role: 'COVER',
    position: 0,
    alt: 'Hai chậu gốm nhỏ men trắng vẽ hoa văn hình học màu nâu đỏ, một chậu trồng dương xỉ.',
    altEn:
      'Two small white ceramic planters with terracotta-brown geometric painted patterns, one holding a fern.',
  },
  {
    photo: 'pp-CKFU38EV',
    target: 'PRODUCT',
    key: 'CKFU38EV',
    role: 'COVER',
    position: 0,
    alt: 'Chậu gốm nhỏ men kem vẽ dải hoa văn hình thoi màu nâu nhạt, trồng cây lá nhỏ, đặt trên khay gỗ.',
    altEn:
      'Small cream-glazed ceramic planter with bands of tan-brown diamond patterns, holding a small-leaved plant on a wooden tray.',
  },
  {
    photo: 'pp-ESPGQA6V',
    target: 'PRODUCT',
    key: 'ESPGQA6V',
    role: 'COVER',
    position: 0,
    alt: 'Chậu gốm tròn men trắng khắc vẽ nét cây cỏ màu nâu, bên cạnh có dây lá xanh.',
    altEn:
      'Round white-glazed ceramic pot with brown line drawings of plants, with green leaves trailing beside it.',
  },
  {
    photo: 'pp-WERPF7SE',
    target: 'PRODUCT',
    key: 'WERPF7SE',
    role: 'COVER',
    position: 0,
    alt: 'Chậu gốm men kem trắng có hoa văn hoa sen cách điệu viền nâu, đặt trên nền trắng.',
    altEn:
      'Cream-white ceramic planter with a stylised lotus-mandala design outlined in brown, on a white background.',
  },
  {
    photo: 'pp-HTV7EG6C',
    target: 'PRODUCT',
    key: 'HTV7EG6C',
    role: 'COVER',
    position: 0,
    alt: 'Chậu gốm trắng có họa tiết cành thông và quả thông màu nâu, đặt trên nền trắng.',
    altEn:
      'White ceramic planter with a brown pine branch and pinecone design on a plain white background.',
  },
  {
    photo: 'pp-FQTZWJNF',
    target: 'PRODUCT',
    key: 'FQTZWJNF',
    role: 'COVER',
    position: 0,
    alt: 'Chậu gốm nhỏ men trắng có họa tiết con rắn và hoa màu nâu vàng, bên trong trồng cây mọng nước.',
    altEn:
      'Small white-glazed ceramic pot with a tan-brown snake and flower motif, holding a green succulent.',
  },
  {
    photo: 'pp-WWYYR7FZ',
    target: 'PRODUCT',
    key: 'WWYYR7FZ',
    role: 'COVER',
    position: 0,
    alt: 'Chậu gốm tròn nhỏ men nâu loang ánh vàng, đặt trên kệ gỗ.',
    altEn:
      'Small round ceramic pot with a mottled brown glaze with golden tones, sitting on a wooden shelf.',
  },
  {
    photo: 'pp-WYND2QMV',
    target: 'PRODUCT',
    key: 'WYND2QMV',
    role: 'COVER',
    position: 0,
    alt: 'Bàn tay cầm chậu gốm vuông nhỏ màu nâu sẫm có chân, thân khắc hình cành lá.',
    altEn:
      'A hand holding a small dark-brown square footed ceramic pot with an incised leaf-branch design.',
  },
  {
    photo: 'pp-J8Z3ZVWD',
    target: 'PRODUCT',
    key: 'J8Z3ZVWD',
    role: 'COVER',
    position: 0,
    alt: 'Bàn tay cầm chậu gốm vuông nhỏ màu nâu sẫm, thân có vòng tròn nổi.',
    altEn:
      'A hand holding a small dark-brown square ceramic pot with a raised circular medallion on its side.',
  },
  {
    photo: 'pp-2XNHP7UY',
    target: 'PRODUCT',
    key: '2XNHP7UY',
    role: 'COVER',
    position: 0,
    alt: 'Ống đựng bút hình trụ men xanh ngọc nhạt, thân có hoa văn chìm, đặt trên nền trắng.',
    altEn:
      'Cylindrical brush pot in a pale jade-green celadon glaze with faint incised pattern on a white background.',
  },
  {
    photo: 'pp-MRZNV5A9',
    target: 'PRODUCT',
    key: 'MRZNV5A9',
    role: 'COVER',
    position: 0,
    alt: 'Ống đựng bút hình trụ men xanh ngọc nhạt có vân rạn nâu, đặt trên nền trắng.',
    altEn:
      'Cylindrical brush pot in a pale celadon glaze with a brown crackle network, on a white background.',
  },
  {
    photo: 'pp-N7AAY7J5',
    target: 'PRODUCT',
    key: 'N7AAY7J5',
    role: 'COVER',
    position: 0,
    alt: 'Ống đựng bút hình trụ men xanh ngọc có hoa văn rồng và mây nổi, đặt trên nền sáng.',
    altEn:
      'Cylindrical celadon-glazed brush pot with raised dragon and cloud relief decoration on a light background.',
  },
  {
    photo: 'pp-FA39H57T',
    target: 'PRODUCT',
    key: 'FA39H57T',
    role: 'COVER',
    position: 0,
    alt: 'Ống đựng bút hình trụ nhỏ men xanh ngọc bóng, đặt trên giá trong suốt.',
    altEn: 'Small cylindrical brush pot with a glossy pale celadon glaze, placed on a clear stand.',
  },
  {
    photo: 'pp-7WDBZ3WM',
    target: 'PRODUCT',
    key: '7WDBZ3WM',
    role: 'COVER',
    position: 0,
    alt: 'Ống đựng bút men xanh ngọc có rồng nổi trên sóng nước, nền tối.',
    altEn:
      'Celadon-glazed brush pot with a relief dragon above waves, photographed against a dark background.',
  },
  {
    photo: 'pp-U4YND79M',
    target: 'PRODUCT',
    key: 'U4YND79M',
    role: 'COVER',
    position: 0,
    alt: 'Ống đựng bút men xanh ngọc thân dạng tre có phần hoa văn rồng được đục lộ.',
    altEn: 'Celadon-glazed bamboo-shaped brush pot with openwork dragon decoration.',
  },
  {
    photo: 'pp-SK8J8SU6',
    target: 'PRODUCT',
    key: 'SK8J8SU6',
    role: 'COVER',
    position: 0,
    alt: 'Lư hương ba chân men nâu bóng có họa tiết rồng và viền vàng, nắp có tượng nghê.',
    altEn:
      'Three-legged incense burner in a glossy brown glaze with gilded dragon relief and a lion finial on the lid.',
  },
  {
    photo: 'pp-GVSRHC37',
    target: 'PRODUCT',
    key: 'GVSRHC37',
    role: 'COVER',
    position: 0,
    alt: 'Bàn tay nâng lư hương gốm ba chân màu nâu có nắp đục lỗ, nền trắng.',
    altEn:
      'A hand holding a three-legged brown ceramic incense burner with a pierced lid on a white background.',
  },
  {
    photo: 'pp-J4D2V8A4',
    target: 'PRODUCT',
    key: 'J4D2V8A4',
    role: 'COVER',
    position: 0,
    alt: 'Hai bàn tay nâng lư hương gốm men nâu loang hình hoa sen, nắp có nhiều lỗ.',
    altEn:
      'Two hands holding a lotus-shaped incense burner with a mottled brown glaze and a perforated lid.',
  },
  {
    photo: 'pp-XN9F53JD',
    target: 'PRODUCT',
    key: 'XN9F53JD',
    role: 'COVER',
    position: 0,
    alt: 'Lư hương gốm màu nâu sẫm hình hoa sen có nắp đục lỗ, đặt trên khay gỗ.',
    altEn: 'Dark-brown lotus-shaped ceramic incense burner with a pierced lid on a wooden tray.',
  },
  {
    photo: 'pp-RHGYT9D9',
    target: 'PRODUCT',
    key: 'RHGYT9D9',
    role: 'COVER',
    position: 0,
    alt: 'Lư hương ba chân thân men kem vẽ chim và nét cọ màu nâu, có dải đỏ cam quanh cổ.',
    altEn:
      'Three-legged incense burner with a cream glaze, a brown painted bird and brushstrokes and an orange-red band around the neck.',
  },
  {
    photo: 'pp-KHE7USRH',
    target: 'PRODUCT',
    key: 'KHE7USRH',
    role: 'COVER',
    position: 0,
    alt: 'Lư hương gốm men kem trên chân cao, miệng loe phẳng khắc hoa văn nâu.',
    altEn:
      'Cream-glazed ceramic incense burner on a tall pedestal foot, with a flat flared top incised with brown linear patterns.',
  },
  {
    photo: 'pp-9V94G9P2',
    target: 'PRODUCT',
    key: '9V94G9P2',
    role: 'COVER',
    position: 0,
    alt: 'Thân lư hương gốm men kem trắng có hoa sen và hoa văn cuộn khắc chìm màu nâu.',
    altEn:
      'Body of a cream-white ceramic incense burner with brown incised lotus and scroll decoration.',
  },
  {
    photo: 'pp-5XS2NP2V',
    target: 'PRODUCT',
    key: '5XS2NP2V',
    role: 'COVER',
    position: 0,
    alt: 'Lư hương gốm men kem miệng loe rộng khắc hoa văn dây cuộn nâu nhạt, chân tròn trơ màu đất.',
    altEn:
      'Cream-glazed ceramic incense burner with a wide flat flared rim carved with pale-brown scrolling patterns on a plain unglazed round foot.',
  },
  {
    photo: 'pp-3EXPSJQK',
    target: 'PRODUCT',
    key: '3EXPSJQK',
    role: 'COVER',
    position: 0,
    alt: 'Lư hương men kem trắng trên chân cao, nắp đục lỗ màu nâu đỏ.',
    altEn: 'Cream-white glazed incense burner on a tall foot with a pierced reddish-brown lid.',
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
