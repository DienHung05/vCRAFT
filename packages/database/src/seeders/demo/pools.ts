import type { JournalStage, ProductCategory } from '@vcraft/domain';

/** Dữ liệu hư cấu cho làng gốm Bát Tràng; mọi tên người, tên hộ đều là mẫu minh họa, không phải người thật. */

export interface HouseholdSeed {
  name: string;
  owner: string;
  craft: string;
  /**
   * The household's story on its page (GH#204, GH#298): a warm Vietnamese narrative of about 90 to 150 words
   * that reads as true and matches the entry's name, owner, craft and number of generations. It covers how the
   * family came to the craft, who works in the workshop now, what and how they make, one sensory detail and what
   * a visitor sees. `{address}` appears exactly once and is replaced by the address of its first workshop (see
   * `householdStory`). It is invented, so it must never name real living people, claim real awards or titles,
   * cite real brands or institutions, or say that it is sample, fictional or demo data.
   */
  story: string;
}

/** 20 hộ đã duyệt. Bốn hộ đầu khớp dữ liệu minh họa của apps/web (slug, tên); hộ thứ ba (Lò Đức Phát) do tài khoản household đại diện. */
export const HOUSEHOLDS: readonly HouseholdSeed[] = [
  {
    name: 'Gốm Minh Hải',
    owner: 'Nguyễn Minh Hải',
    craft: 'men lam',
    story:
      'Ông Hải học nghề men lam từ người cha, người đã nhóm cái lò đầu tiên của gia đình tại {address}; đến nay nhà ông làm gốm được hai đời. Sáng nào ông cũng là người đứng lò, còn việc vẽ và tráng men chia cho những người thợ đã gắn bó với xưởng hơn chục năm. Đất sét được ủ kỹ trước khi vuốt, rồi cành tre, hoa cúc và sóng nước được vẽ tay bằng bút lông trên nền men trắng. Khi lò nguội, sắc lam chìm hẳn vào men, sâu và êm. Khách đến xưởng được ngồi cạnh bàn xoay, hít mùi đất ẩm lẫn khói củi và xem thợ đưa những nét bút đầu tiên.',
  },
  {
    name: 'Gốm Lam Ngọc',
    owner: 'Trần Thị Ngọc',
    craft: 'men ngọc và men rạn',
    story:
      'Ba đời nhà bà Ngọc theo nghề gốm, nhưng riêng bà mới là người say men ngọc và men rạn. Xưởng nhỏ ở {address} giờ do bà cùng cô con gái giữ, hai mẹ con thay nhau pha men, thử nhiệt và ghi từng mẻ vào cuốn sổ bìa đã sờn. Men ngọc được pha đi pha lại cho đến khi lên sắc xanh trong như mặt hồ buổi sớm. Món men rạn thì để nguội thật chậm, và đêm mở lò người ta nghe men tách khẽ như tiếng sương rơi. Khách ghé xưởng thường được mời một chén trà, rồi cầm chiếc chén vừa ra lò lên xem đường rạn dưới ánh sáng.',
  },
  {
    name: 'Lò Đức Phát',
    owner: 'Lê Đức Phát',
    craft: 'đồ gia dụng, cốc và bát in logo',
    story:
      'Lò Đức Phát đã qua bốn đời làm đồ gốm dùng hằng ngày, từ thời ông cố nung chén bát cho cả xóm ăn cơm. Anh Phát nay trông lò ở {address}, còn vợ anh đứng khâu kiểm hàng và đóng gói, lật từng chiếc cốc dưới đèn như lật một trang sách. Cốc, bát, đĩa của lò có dáng gọn, thành vừa dày để cầm không nóng tay, dễ xếp chồng và dễ rửa. Quán cà phê, nhà hàng đặt mỗi lần từ vài chục đến vài trăm chiếc, in tên hoặc biểu tượng riêng của mình. Ghé xưởng buổi sáng, khách sẽ thấy cả dãy cốc trắng xếp thẳng hàng trên giá, chờ vào lò.',
  },
  {
    name: 'Gốm Hạnh Thủy',
    owner: 'Phạm Hạnh Thủy',
    craft: 'vẽ tay hoa sen, chim lạc',
    story:
      'Chị Thủy lớn lên giữa tiếng bàn xoay; nhà chị làm gốm đã năm đời, nhưng chị chọn cây bút thay cho cái lò. Sau nhiều năm làm thợ vẽ cho các xưởng trong làng, chị mở xưởng riêng ở {address} để được vẽ theo ý mình. Hoa sen và chim lạc là hai đề tài chị yêu nhất, mỗi nét đều đi bằng tay chứ không in, không dán, nên chẳng có hai chiếc nào trùng nhau. Chị nhận vẽ riêng cho những bộ quà nhỏ, có khi chỉ ba bốn chiếc. Chiều xuống, nắng chéo qua cửa sổ rọi lên mặt men còn ướt, và khách ghé vào thường bắt gặp chị đang lặng lẽ kéo nét cuối cùng của một cánh sen.',
  },
  {
    name: 'Gốm Thanh Tùng',
    owner: 'Vũ Thanh Tùng',
    craft: 'bình hoa, lục bình',
    story:
      'Anh Tùng là đời thứ hai của một nhà làm gốm, và là người đầu tiên trong nhà dám vuốt những chiếc lục bình cao ngang ngực. Xưởng ở {address} có vài người thợ cùng anh làm bình hoa, từ cỡ để bàn đến cỡ đặt sàn. Thân bình cao được vuốt thành từng khúc, ghép lại khi đất còn ẩm, rồi anh miết bằng ngón tay cho mối nối biến mất. Anh dành nhiều thời gian nhất cho đường cổ và vai bình, bởi theo anh dáng bình đẹp hay không là ở chỗ ấy. Men lam và men nâu da lươn là hai màu quen của xưởng. Khách đến thường đứng rất lâu trước hàng lục bình mới ra lò, lặng lẽ ngước nhìn.',
  },
  {
    name: 'Gốm Bích Hợp',
    owner: 'Đỗ Thị Bích Hợp',
    craft: 'ấm chén men nâu',
    story:
      'Gần ba mươi năm nay, bà Hợp làm ấm chén men nâu trong căn xưởng mái ngói ở {address}, nối nghề của mẹ và bà ngoại, ba đời liền. Đất làm ấm được bà lọc kỹ nhiều lần để thân ấm mỏng mà giữ nóng lâu. Sau khi nung, nắp và vòi còn được mài khít bằng tay; bà đặt nắp lên, xoay nhẹ, nghe tiếng cạch khẽ vừa đủ mới chịu. Một người thợ trẻ phụ bà vuốt ấm, còn phần hoàn thiện bà giữ cho riêng mình. Người trong làng vẫn tìm đến bà đặt bộ ấm dùng hằng ngày, còn khách xa thích ngồi uống thử một ấm trà ngay tại xưởng.',
  },
  {
    name: 'Lò Hải Yến',
    owner: 'Hoàng Hải Yến',
    craft: 'đồ thờ, lư hương',
    story:
      'Bốn đời nhà chị Yến làm đồ thờ, và với họ mỗi chiếc lư hương là món đồ phải làm trong sự tĩnh lặng. Lò ở {address} chuyên lư hương, bát hương, đôi đèn và chân nến cho ban thờ gia đình. Chị Yến chọn men vàng đồng và men lam, hai màu trầm ấm hợp với làn khói hương. Trước khi giao, chị tự tay kiểm vành miệng và đáy từng chiếc, miết ngón tay một vòng để chắc không còn chỗ sắc. Xưởng nhận làm đúng kích thước từng ban thờ, kể cả những ban thờ nhỏ trong căn hộ chật. Khách vào xưởng thường nói khẽ, như thể bước vào gian thờ của một gia đình.',
  },
  {
    name: 'Gốm Quang Vinh',
    owner: 'Nguyễn Quang Vinh',
    craft: 'men rạn cổ',
    story:
      'Anh Vinh là đời thứ năm trong dòng họ làm gốm, và anh dành riêng nghề mình cho men rạn cổ. Công thức men ở xưởng {address} được truyền từ ông nội, ghi bằng những ký hiệu chỉ người nhà đọc hiểu. Sau khi ra lò, anh chờ men nguội hẳn rồi xoa mực vào các đường rạn để mạng vân hiện lên như gân lá. Bình, lọ và chóe là những món anh làm nhiều nhất, cái nào cũng dày dặn, nặng tay. Mỗi mẻ men cho một kiểu rạn khác nhau nên không có hai món giống hệt, và anh bảo chính điều đó khiến anh còn mê nghề. Khách đến được gõ nhẹ vào thành bình để nghe tiếng ngân.',
  },
  {
    name: 'Gốm Thu Hằng',
    owner: 'Bùi Thu Hằng',
    craft: 'đĩa, tô men trắng ngà',
    story:
      'Chị Hằng mới là đời thứ hai làm gốm trong nhà, nhưng đôi tay chị đã quen với đĩa và tô men trắng ngà đến mức nhắm mắt cũng biết chiếc nào lệch. Xưởng ở {address} làm theo bộ cho gia đình và các nhà hàng nhỏ. Men trắng ngà của chị ấm hơn men trắng sứ, đặt món ăn Việt lên trông gần gũi hơn, có bộ còn thêm một đường viền lam mảnh. Khi nung, đĩa được xếp từng chiếc, cách nhau một đốt ngón tay để mặt men không dính vào nhau. Buổi trưa, mùi cơm từ bếp nhà chị lan sang xưởng, và khách ghé vào đôi khi được mời thử bộ bát đĩa mới bên mâm cơm giản dị.',
  },
  {
    name: 'Gốm Đại Phong',
    owner: 'Phan Đại Phong',
    craft: 'tượng và chậu cây',
    story:
      'Ông Phong còn nhớ lần đầu được ông nội cho nặn một con nghê nhỏ bằng chỗ đất thừa, và từ đó nghề tượng gốm theo ông đến tận bây giờ, qua ba đời. Xưởng ở {address} làm tượng và chậu cây, phần lớn là đồ đặt ngoài sân vườn nên men phải chịu được nắng mưa. Tượng được nặn tay hoặc in khuôn, rồi ông ngồi sửa lại từng chi tiết, từ nếp áo đến đôi mắt. Chậu có lỗ thoát nước và đáy dày để không nứt khi trời trở lạnh. Sân xưởng lúc nào cũng la liệt chậu đang phơi, khách đến như lạc vào một khu vườn gốm đầy đất và nắng.',
  },
  {
    name: 'Lò Văn Khánh',
    owner: 'Ngô Văn Khánh',
    craft: 'bát đĩa số lượng lớn',
    story:
      'Bốn đời làm gốm đã dạy nhà anh Khánh một điều: đơn hàng lớn chỉ đẹp khi chiếc thứ một nghìn giống hệt chiếc đầu tiên. Lò ở {address} làm bát đĩa cho bếp ăn, quán cơm và nhà hàng; anh giữ một bộ khuôn cố định và tự tay đo lại kích thước sau mỗi mẻ. Những đơn hàng vài nghìn chiếc được chia giao theo đợt, mỗi đợt có sổ ghi riêng. Men trắng và men lam viền là hai kiểu bán chạy nhất. Những ngày lò đầy, cả xưởng rộn lên tiếng bát chạm nhau lanh canh khi thợ xếp chồng và đếm. Khách ghé thăm hay bất ngờ trước cả trăm chiếc bát đứng thẳng hàng như một đội quân nhỏ.',
  },
  {
    name: 'Gốm Mai Anh',
    owner: 'Lương Mai Anh',
    craft: 'khay trà, tách trà',
    story:
      'Nhà chị Mai Anh làm gốm đã năm đời, nhưng phải đến chị thì xưởng mới có một góc dành riêng cho trà. Ở {address}, chị làm khay trà và tách trà cùng một hai người thợ trẻ. Tách được vuốt mỏng, miệng hơi loe để uống trà nóng không bỏng môi; khay có rãnh thoát nước và chân đế vững. Chị thích những tông men nhạt, vì nước trà hiện màu trong chén mới thấy hết vẻ đẹp của nó. Mỗi lần ra lò, chị pha ngay một ấm trà đầu tiên để thử, đứng bên cửa nghe tiếng nước rót. Khách đến xưởng thường được mời ngồi lại, uống trà và ngắm những chiếc khay mới.',
  },
  {
    name: 'Gốm Tân Lộc',
    owner: 'Đinh Tân Lộc',
    craft: 'bình ngâm rượu',
    story:
      'Cha anh Lộc từng làm chum vại, đến đời anh thì nhà chuyển sang bình ngâm rượu, và hai đời gốm cứ thế nối nhau. Xưởng ở {address} làm bình từ năm lít đến vài chục lít. Thân bình dày, men phủ kín cả trong lẫn ngoài để rượu không thấm, nên bình ngâm lâu năm vẫn sạch mùi. Anh lắp vòi, đổ đầy nước, để qua đêm; sáng ra nền xưởng còn khô ráo thì bình mới được giao. Nhiều khách đặt kèm chữ hoặc họa tiết vẽ trên thân bình. Ghé xưởng vào buổi chiều, khách sẽ thấy cả hàng bình lớn xếp dọc tường, sáng lên dưới ánh nắng xiên qua mái.',
  },
  {
    name: 'Gốm Ngọc Diệp',
    owner: 'Trịnh Ngọc Diệp',
    craft: 'men hoa nâu',
    story:
      'Ba đời nhà chị Diệp giữ nghề men hoa nâu, và chị là người đầu tiên trong nhà khắc hoa văn bằng mũi dao nhỏ thay cho que tre. Xưởng ở {address} làm bình, liễn và đĩa trang trí. Họa tiết được khắc lên thân đồ khi đất còn mềm, rồi tô men nâu để hoa văn nổi lên trên nền sáng. Riêng khâu khắc đã mất vài ngày cho một món, chị bảo phải nín thở mới được nét liền. Giữa trưa, xưởng chỉ còn tiếng mũi dao sột soạt trên đất. Khách ghé vào có thể ngồi xem chị khắc, và thường ra về với một chiếc đĩa nhỏ mang dấu tay người làm.',
  },
  {
    name: 'Gốm Phúc An',
    owner: 'Mai Phúc An',
    craft: 'đồ trang trí sảnh khách sạn',
    story:
      'Gia đình ông An bốn đời nay chuyên những món gốm cao quá đầu người, nên người trong làng hay gọi vui ông là thợ làm đồ khổng lồ. Xưởng ở {address} làm bình cao, đôn và chậu cảnh cho sảnh khách sạn và văn phòng. Ông thường làm theo bản vẽ và bảng màu khách gửi, thử trước một món nhỏ rồi mới vuốt món lớn. Món lớn được chở đi trong thùng gỗ lót rơm, và một bộ thường mất từ vài tuần trở lên. Lò nhà ông phải đỏ lửa cả ngày lẫn đêm, hơi nóng phả ra tận ngoài sân. Khách ghé xưởng hay ngỡ ngàng đứng dưới những chiếc bình cao hơn mình cả cái đầu.',
  },
  {
    name: 'Lò Trường Sơn',
    owner: 'Cao Trường Sơn',
    craft: 'gạch gốm và lọ lớn',
    story:
      'Anh Sơn là đời thứ năm của một dòng họ làm gạch gốm, và là người đầu tiên trong nhà vẽ lam lên từng viên gạch. Lò ở {address} làm gạch ốp tường, lát sân và những chiếc lọ cao gần một mét. Lò đủ rộng để nung cả lọ lớn mà không phải đặt nghiêng. Anh tự kiểm từng viên gạch dưới ánh sáng ban ngày để màu men đều trong cùng một lô. Xưởng thơm mùi đất nung, sân xếp từng chồng gạch còn hầm hập hơi nóng sau mẻ lò. Khách đến có thể chọn một viên gạch hoa lam để về lát riêng một góc bếp hay một khoảng sân của mình.',
  },
  {
    name: 'Gốm Kim Liên',
    owner: 'Tạ Kim Liên',
    craft: 'chén tống, đĩa trà',
    story:
      'Bà Liên học nghề từ mẹ chồng khi đã có gia đình, và đến nay nhà bà có hai đời làm chén tống, đĩa trà. Xưởng nhỏ của bà ở {address} chỉ có vài người, nhưng bộ trà nào cũng đủ một tống, sáu chén và đĩa lót. Chén tống được vuốt cân để rót trà không nhỏ giọt; bà thử bằng cách rót đầy nước rồi nhìn đường chảy ở vòi. Bà ưa men lam nhạt và men trắng, đôi khi điểm thêm một cành mai nhỏ. Buổi sáng, xưởng thoảng mùi trà sen bà pha sẵn trên bàn. Khách đến được mời ngồi uống thử, rồi chọn bộ nào vừa tay mình.',
  },
  {
    name: 'Gốm Hoàng Long',
    owner: 'Dương Hoàng Long',
    craft: 'men xanh rêu',
    story:
      'Anh Long nối nghề của ông và cha, ba đời gốm, rồi tìm cho mình một màu riêng là xanh rêu. Ở xưởng {address}, anh làm bình, cốc và chậu nhỏ để bàn. Xanh rêu chỗ đậm chỗ nhạt tùy men dày hay mỏng, nên mỗi món mang một sắc riêng như mảng rêu trên bờ giếng cũ. Men được nung đi nung lại nhiều lần để thử cho đến khi lên đúng màu anh muốn, có hôm anh đứng canh lò đến quá nửa đêm. Lúc mở lò, hơi nóng hầm hập phả ra, rồi những món men xanh hiện dần trong ánh đèn. Khách ghé xưởng thường được chọn ngay từ mẻ còn ấm.',
  },
  {
    name: 'Lò Thái Bình',
    owner: 'Lý Thái Bình',
    craft: 'ống đựng bút, đồ văn phòng',
    story:
      'Bốn đời nhà anh Bình làm gốm, nhưng riêng anh chọn đưa gốm lên bàn làm việc. Lò ở {address} làm ống đựng bút và đồ văn phòng, nhận cả đơn quà tặng cho hội nghị và công ty, có thể in tên hoặc biểu tượng riêng. Anh chọn dáng gọn, men một màu để món đồ nằm yên trên bàn mà vẫn có hồn. Trước mỗi đơn lớn, anh làm thử vài chiếc, cầm lên, đặt bút vào, xoay đi xoay lại cho đến khi ưng ý. Góc nhỏ trong xưởng bày những chiếc ống bút đủ màu trên giá gỗ cũ, ánh sáng buổi sáng chiếu lên mặt men bóng. Khách ghé thường mua một chiếc về tặng đồng nghiệp.',
  },
  {
    name: 'Gốm Lan Chi',
    owner: 'Hồ Lan Chi',
    craft: 'hũ trà, bình đựng nước',
    story:
      'Nhà chị Lan Chi làm gốm đã năm đời, và chị lớn lên bên những chiếc hũ trà, bình nước của bà. Xưởng nhỏ ở {address} gần như chị tự tay làm hết, từ nhào đất, vuốt dáng đến tráng men và nung, chỉ nhờ một hai người thợ phụ những lúc đông đơn. Hũ trà có nắp kín để giữ hương, bình nước có quai vừa tay cầm; chị thử từng chiếc bằng cách đổ đầy rồi nhấc lên. Chị chọn men màu đất và men trắng ngà vì thích cảm giác mộc, gần gũi. Buổi sáng, nắng đổ vào xưởng, hơi đất ẩm bốc lên nhè nhẹ. Khách đến thường ngồi trò chuyện với chị khá lâu, vì xưởng nhỏ nên ai cũng được nghe chuyện của từng món.',
  },
];

export const PENDING_HOUSEHOLD: HouseholdSeed = {
  name: 'Gốm Bảo Châu',
  owner: 'Kiều Bảo Châu',
  craft: 'men lam vẽ tay',
  story:
    'Mẹ chị Bảo Châu từng là thợ phụ ở một lò men lam trong làng, nên chị lớn lên cùng mùi men và tiếng bút lông, rồi nối nghề thành đời gốm thứ hai của gia đình. Sau nhiều năm học vẽ lam từ các thợ lâu năm, chị mới mở xưởng riêng ở {address}. Những món đầu tiên của xưởng là bát, đĩa và chén vẽ hoa lá, nét còn mới nhưng rất cẩn trọng. Chị giữ thói quen vẽ thử lên mảnh gốm vỡ trước khi đặt bút lên món thật. Xưởng đang chờ Ban quản lý duyệt hồ sơ để giới thiệu sản phẩm trên vCraft, và khi đó khách sẽ được mời ghé xem chị vẽ.',
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
/** Danh mục của từng mẫu sản phẩm; giữ riêng khỏi danh sách để thứ tự mẫu (và dữ liệu đóng băng) không đổi. */
export const TEMPLATE_CATEGORY: Record<(typeof PRODUCT_TEMPLATES)[number], ProductCategory> = {
  'Bình hút lộc': 'VASE',
  'Bát chiết yêu': 'TABLEWARE',
  'Cốc quai': 'TEA',
  'Bộ ấm chén': 'TEA',
  'Đĩa tròn': 'TABLEWARE',
  'Lọ hoa miệng loe': 'VASE',
  'Âu đựng canh': 'TABLEWARE',
  'Tách trà': 'TEA',
  'Lục bình': 'VASE',
  'Chậu cây mini': 'DECOR',
  'Ống đựng bút': 'DECOR',
  'Bình ngâm rượu': 'VASE',
  'Đĩa trà': 'TEA',
  'Hũ đựng trà': 'TEA',
  'Bình đựng nước': 'VASE',
  'Bát ăn cơm': 'TABLEWARE',
  'Chén tống': 'TEA',
  'Lư hương': 'WORSHIP',
  'Tô sứ': 'TABLEWARE',
  'Khay trà': 'TEA',
};

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
