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
  category: 'HOUSEHOLD_UPDATE' | 'VILLAGE_EVENT' | 'CRAFT_STORY' | 'SUPPORT_POLICY' | 'GENERAL';
  /** Chỉ số trong HOUSEHOLDS; `null` = tin chung của làng (tin của hộ là tùy chọn, GH#314). */
  h: number | null;
  title: string;
  summary: string;
  /** Plain text, our own paraphrase of the original story; `{hộ}` is replaced by the household name. */
  body: string;
  /** Số ngày trước mốc đóng băng. Bỏ qua khi có `publishedAt`. */
  daysAgo?: number;
  /** Real publish date of the story on this site (ISO 8601). When present it replaces `daysAgo`. */
  publishedAt?: string;
  /** Publisher of the original story, e.g. "VnExpress". Required for real stories (checked by `demo:verify`). */
  sourceName?: string;
  /** https link to the original story. */
  sourceUrl?: string;
  /** Original publication date (ISO 8601); defaults to `publishedAt`. */
  sourcePublishedAt?: string;
  /** English paraphrase of the story. Reserved: the news table has no English columns yet, so it is not stored. */
  en?: { title: string; summary: string; body: string };
  pinned?: boolean;
}

/**
 * Real published stories about Bát Tràng (GH#314). `title` is the original headline, `summary` and `body` (vi and
 * `en`) are our own paraphrase of the article, and `sourceName` / `sourceUrl` / `sourcePublishedAt` point back to
 * the original, which the site shows as a source line. Every story was read in full before it was added.
 */
export const NEWS: readonly NewsSeed[] = [
  {
    key: 'bt-creative-craft-network',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Làng Bát Tràng, Vạn Phúc gia nhập mạng lưới các thành phố thủ công sáng tạo',
    summary:
      'Tối 14/2/2025 tại Hoàng thành Thăng Long, Bát Tràng và Vạn Phúc được đón nhận là thành viên của mạng lưới thủ công sáng tạo thế giới.',
    body: 'Buổi lễ diễn ra tại Hoàng thành Thăng Long vào tối 14/2/2025, trao chứng nhận thành viên mạng lưới các thành phố thủ công sáng tạo cho đại diện hai làng nghề: làng gốm Bát Tràng và làng lụa Vạn Phúc. Chủ tịch Hội đồng Thủ công Thế giới đến dự và khen ngợi sự tinh xảo của gốm Bát Tràng và lụa Vạn Phúc.\n\nChương trình có phần biểu diễn nghệ thuật, lễ rước tổ nghề và triển lãm, trình diễn sản phẩm thủ công Hà Nội. Bài báo cho biết Hà Nội có khoảng 1.350 làng nghề và làng có nghề, phủ 47 trong 52 nghề truyền thống của cả nước.\n\nTheo báo, toàn mạng lưới lúc này có 68 làng nghề của 28 quốc gia, và việc gia nhập được xem là minh chứng cho nỗ lực giữ giá trị truyền thống song song với nhu cầu hiện đại.',
    en: {
      title: 'Bát Tràng and Vạn Phúc villages join the network of creative craft cities',
      summary:
        'On the evening of 14 February 2025 at the Thăng Long Imperial Citadel, Bát Tràng and Vạn Phúc were welcomed as members of the World Crafts Council network.',
      body: "The ceremony took place at the Thăng Long Imperial Citadel on the evening of 14 February 2025, handing membership certificates of the creative craft cities network to the pottery village of Bát Tràng and the silk village of Vạn Phúc. The president of the World Crafts Council attended and praised the refinement of Bát Tràng ceramics and Vạn Phúc silk.\n\nThe programme included a stage performance, a procession honouring the craft ancestor and an exhibition with demonstrations of Hanoi handicrafts. The report notes that Hanoi has about 1,350 craft villages and villages with crafts, covering 47 of the country's 52 traditional crafts.\n\nAccording to the paper the network now counts 68 craft villages from 28 countries, and joining it is presented as proof of efforts to keep traditional values while meeting modern demand.",
    },
    publishedAt: '2025-02-15T08:37:00+07:00',
    sourceName: 'Báo Nông nghiệp và Môi trường',
    sourceUrl:
      'https://nongnghiepmoitruong.vn/lang-bat-trang-van-phuc-gia-nhap-mang-luoi-cac-thanh-pho-thu-cong-sang-tao-d421126.html',
    sourcePublishedAt: '2025-02-15T08:37:00+07:00',
  },
  {
    key: 'bt-festival-heritage-2025',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Công bố lễ hội làng Bát Tràng là Di sản văn hóa phi vật thể quốc gia',
    summary:
      'Tối 12/3/2025 tại đình làng, huyện Gia Lâm công bố quyết định công nhận lễ hội làng và khai mạc lễ hội truyền thống năm 2025.',
    body: 'Tối 12/3/2025, tại đình làng Bát Tràng, UBND huyện Gia Lâm tổ chức lễ công bố quyết định của Bộ Văn hóa, Thể thao và Du lịch đưa lễ hội làng Bát Tràng vào danh mục di sản văn hóa phi vật thể quốc gia, đồng thời khai mạc lễ hội truyền thống năm 2025. Bộ công nhận lễ hội từ ngày 10/12/2024.\n\nLễ hội có các nghi thức dâng hương, tam sinh, rước kiệu, cấp thủy, nhập thủy và tế thần, cùng các hoạt động như thi nấu cỗ truyền thống, giao lưu với các làng khác, thả đèn hoa đăng, bắn pháo hoa, thưởng trà và trò chơi dân gian.\n\nBài báo nhắc rằng nghề gốm Bát Tràng đã vào danh mục di sản quốc gia từ năm 2023, làng có hai Nghệ nhân Nhân dân và sáu Nghệ nhân Ưu tú, nhiều sản phẩm đạt OCOP 3 đến 5 sao.',
    en: {
      title: 'Bát Tràng village festival announced as national intangible cultural heritage',
      summary:
        'On the evening of 12 March 2025 at the communal house, Gia Lâm district announced the decision recognising the village festival and opened the 2025 traditional festival.',
      body: "On the evening of 12 March 2025, at the Bát Tràng communal house, the Gia Lâm District People's Committee held a ceremony announcing the Ministry of Culture, Sports and Tourism's decision to list the Bát Tràng village festival as national intangible cultural heritage, and opened the 2025 traditional festival. The ministry recognised the festival on 10 December 2024.\n\nThe festival includes rites of incense offering, the three-animal offering, the palanquin procession, water-drawing and water-entering, and the sacrifice to the deities, along with a traditional feast cooking contest, exchanges with other villages, a floating-lantern ceremony, fireworks, tea tasting and folk games.\n\nThe article recalls that Bát Tràng pottery joined the national heritage list in 2023, that the village has two People's Artisans and six Meritorious Artisans, and that many products hold OCOP ratings of 3 to 5 stars.",
    },
    publishedAt: '2025-03-13T08:53:00+07:00',
    sourceName: 'Báo Nhân Dân',
    sourceUrl:
      'https://nhandan.vn/cong-bo-le-hoi-lang-bat-trang-la-di-san-van-hoa-phi-vat-the-quoc-gia-post864820.html',
    sourcePublishedAt: '2025-03-13T08:53:00+07:00',
  },
  {
    key: 'bt-green-kilns-policy',
    category: 'SUPPORT_POLICY',
    h: null,
    title: "Doanh nghiệp làng nghề khó chuyển đổi 'xanh'",
    summary:
      'Bài báo nói về khó khăn giữ môi trường của các làng nghề Hà Nội, trong đó Bát Tràng đã chuyển gần 1.000 hộ sang lò gas hóa lỏng, và các đề xuất hỗ trợ của Sở Công Thương.',
    body: 'Hà Nội có khoảng 1.350 làng nghề và làng có nghề, trong đó 327 làng được thành phố công nhận. Các chuyên gia cho rằng làng nghề phải bảo vệ môi trường nhưng phần lớn là cơ sở nhỏ theo hộ gia đình nên chuyển đổi xanh không dễ.\n\nVới gốm Bát Tràng, bài báo cho biết các cơ sở đã bỏ lò than và lò gas cũ để dùng lò khí gas hóa lỏng, hiện gần 1.000 hộ áp dụng. Lò mới giúp giảm hẳn sản phẩm lỗi, tiết kiệm năng lượng và hiệu quả hơn. Chủ tịch xã nói làng giữ cách làm truyền thống nhưng tinh chỉnh quy trình để bớt bụi và ô nhiễm.\n\nMục tiêu đến năm 2030 là mọi làng nghề được công nhận đều đạt yêu cầu môi trường. Sở Công Thương đề xuất quy hoạch kết hợp sản xuất với du lịch, cụm công nghiệp nhỏ và vừa ở nông thôn, miễn giảm thuế phí cho cơ sở tuân thủ quy định và hỗ trợ vốn từ quỹ bảo vệ môi trường; bài báo trình bày đây là các đề xuất, chưa nói đề xuất nào đã được áp dụng.',
    en: {
      title: 'Craft village businesses find the green transition difficult',
      summary:
        'The article looks at how hard it is for Hanoi craft villages to protect the environment, including Bát Tràng moving nearly 1,000 households to LPG kilns, and the support measures proposed by the Department of Industry and Trade.',
      body: 'Hanoi has about 1,350 craft villages and villages with crafts, 327 of them officially recognised by the city. Experts say craft villages must protect the environment, but most are small household operations, so a green transition is not easy.\n\nFor Bát Tràng ceramics, the article reports that producers have dropped coal kilns and older gas kilns for liquefied-gas (LPG) kilns, now used by nearly 1,000 households. The new kilns sharply cut defective pieces, save energy and improve efficiency. The commune chairman says the village keeps its traditional methods while refining processes to reduce dust and pollution.\n\nBy 2030 the goal is for every recognised craft village to meet environmental requirements. The Department of Industry and Trade proposes spatial planning that combines production with tourism, small and medium industrial clusters in rural areas, tax and fee reductions for compliant establishments and capital support from an environmental protection fund; the article presents these as proposals and does not say which have been adopted.',
    },
    publishedAt: '2025-04-16T13:04:00+07:00',
    sourceName: 'Báo Đại Đoàn Kết',
    sourceUrl: 'https://daidoanket.vn/doanh-nghiep-lang-nghe-kho-chuyen-doi-xanh-10303748.html',
    sourcePublishedAt: '2025-04-16T13:04:00+07:00',
  },
  {
    key: 'bt-feast-heritage',
    category: 'CRAFT_STORY',
    h: null,
    title: "Đến Bát Tràng ăn 'cỗ quốc gia'",
    summary:
      'Sau khi tri thức nấu cỗ Bát Tràng được đưa vào danh mục di sản phi vật thể quốc gia, một phóng viên đặt bữa cỗ tại nhà nghệ nhân trong làng.',
    body: 'Ngày 18/8/2025, Bộ Văn hóa, Thể thao và Du lịch đưa "tri thức nấu cỗ Bát Tràng" vào danh mục di sản văn hóa phi vật thể quốc gia. Bài báo kể về bữa cỗ đặt qua nghệ nhân Nguyễn Thị Thu Hằng, con dâu nghệ nhân Nguyễn Thị Lâm, trong một ngôi nhà kiểu Pháp trăm năm tuổi; phải đặt trước 10 đến 15 ngày và mức giá khoảng 350.000 đồng một người.\n\nMón đặc trưng là canh măng mực. Măng khô lấy từ Yên Bái được luộc nhiều lần, mực được ngâm rượu gừng, nướng than rồi mới xào; đổi thứ tự nấu là vị đổi theo. Cách bày mâm cũng có ý nghĩa: bốn bát sáu đĩa là đầy đủ, sáu bát tám đĩa của ngày Tết gọi là cỗ bát trân.\n\nNgày xưa cỗ chỉ dành cho lễ tết, việc lớn trong nhà, nay được phục vụ hằng ngày cho khách du lịch, nhiều đoàn khách nước ngoài đến để "ăn" văn hóa của làng.',
    en: {
      title: "Eating Bát Tràng's 'national feast'",
      summary:
        "After the knowledge of cooking the Bát Tràng feast was added to the national intangible heritage list, a reporter books a feast at an artisan's home in the village.",
      body: 'On 18 August 2025 the Ministry of Culture, Sports and Tourism added "the knowledge of cooking Bát Tràng feasts" to the national intangible cultural heritage list. The article describes a feast booked through artisan Nguyễn Thị Thu Hằng, daughter-in-law of artisan Nguyễn Thị Lâm, in a century-old French-style house; bookings are needed 10 to 15 days ahead and the price is about 350,000 VND per person.\n\nThe signature dish is bamboo shoot and squid soup. Dried bamboo shoots from Yên Bái are boiled several times and the squid is soaked in ginger wine and grilled over charcoal before stir-frying; change the order of the steps and the taste changes. The tray layout carries meaning too: four bowls and six plates mean completeness, while the six bowls and eight plates of Tết are called the "bát trân" feast.\n\nFeasts were once kept for festivals and big family occasions but are now served daily to visitors, and many foreign groups come to "eat" the culture of the village.',
    },
    publishedAt: '2025-08-29T06:24:00+07:00',
    sourceName: 'Báo điện tử Tiền Phong',
    sourceUrl: 'https://tienphong.vn/den-bat-trang-an-co-quoc-gia-post1773636.html',
    sourcePublishedAt: '2025-08-29T06:24:00+07:00',
  },
  {
    key: 'bt-young-artisans',
    category: 'CRAFT_STORY',
    h: null,
    title: 'Young artisans revive Bát Tràng pottery craft',
    summary:
      'Những người trẻ học đại học ở Hà Nội quay về Bát Tràng nối nghề gốm của gia đình và đem theo cách làm mới.',
    body: 'Bài báo giới thiệu hai bạn trẻ trở về làng. Nguyễn Minh Quang, 25 tuổi, học một trường đại học mỹ thuật và thiết kế ở Hà Nội, khôi phục xưởng gốm của gia đình đã ngừng hoạt động từ lâu; anh làm men rạn và men ngọc, được giải ba cuộc thi "Bàn tay vàng" của làng năm 2023. Tô Minh Hoàng, 24 tuổi, tốt nghiệp một trường đại học ngoại ngữ ở Hà Nội, dùng ngoại ngữ để kể với du khách về giá trị gốm Bát Tràng.\n\nQuang cho rằng nhồi đất phải học ít nhất sáu tháng và vuốt gốm cần cỡ 10.000 giờ luyện tập, còn nhiệt độ nung là bí quyết phải thử hàng trăm lần mới nắm được.\n\nCác nghệ nhân lớn tuổi nhận xét số thợ trẻ đang tăng, và hội nghệ nhân của làng tổ chức thi, triển lãm để họ giao lưu và được biết đến.',
    en: {
      title: 'Young artisans revive Bát Tràng pottery craft',
      summary:
        "Young people who studied at universities in Hanoi are returning to Bát Tràng to carry on their families' pottery trade and bring new ways of working.",
      body: "The article profiles two young people who came home. Nguyễn Minh Quang, 25, studied at an art and design university in Hanoi and revived his family's long-idle pottery workshop; he makes crackle and emerald glazes and took third place in the village's \"Golden Hands\" contest in 2023. Tô Minh Hoàng, 24, a graduate of a foreign languages university in Hanoi, uses his languages to explain the value of Bát Tràng pottery to visitors.\n\nQuang says kneading clay takes at least six months to learn and wheel-throwing around 10,000 hours of practice, while kiln temperatures are a closely guarded secret that takes hundreds of trials to master.\n\nOlder artisans note that the number of young potters is growing, and the village artisans' association holds contests and exhibitions so they can meet each other and be seen.",
    },
    publishedAt: '2025-10-09T11:08:00+07:00',
    sourceName: 'Viet Nam News',
    sourceUrl:
      'https://vietnamnews.vn/society/1726872/young-artisans-revive-bat-trang-pottery-craft.html',
    sourcePublishedAt: '2025-10-09T11:08:00+07:00',
  },
  {
    key: 'bt-ocop-five-star',
    category: 'GENERAL',
    h: null,
    title: 'Đẳng cấp của những sản phẩm gốm OCOP 5 sao ở Bát Tràng',
    summary:
      'Hai đơn vị ở Bát Tràng có sản phẩm đạt OCOP 5 sao: HTX Gốm sứ Tân Thịnh với dòng men Suối Ngọc và Công ty Gốm sứ Quang Vinh.',
    body: 'HTX Sản xuất Kinh doanh Gốm sứ Tân Thịnh, thành lập năm 2013, phát triển dòng men Suối Ngọc từ nguyên liệu trong nước, cho năm gam màu riêng, nung ở 1.250 đến 1.300 độ C; bộ sản phẩm được hội đồng quốc gia chấm 5 sao năm 2023.\n\nCông ty TNHH Gốm sứ Quang Vinh có bốn sản phẩm 5 sao, đều là bộ bát đĩa hoặc ấm chén hoa văn sen, chim én, rồng phượng. Bà Hà Thị Vinh, giám đốc công ty và Chủ tịch Hiệp hội Làng nghề, nghề thủ công Hà Nội, cho biết phần lớn sản phẩm xuất sang hơn 30 nước.\n\nBài báo cũng nhắc đến Trung tâm Tinh hoa Làng nghề Việt do bà Vinh sáng lập, nơi triển lãm, sáng tạo và đón hàng trăm nghìn lượt khách.',
    en: {
      title: "The prestige of Bát Tràng's 5-star OCOP ceramic products",
      summary:
        'Two Bát Tràng units hold 5-star OCOP products: the Tân Thịnh Ceramics Cooperative with its Suối Ngọc glaze line and Quang Vinh Ceramics Company.',
      body: 'The Tân Thịnh Ceramics Production and Trading Cooperative, founded in 2013, developed the Suối Ngọc glaze from domestic materials, giving five distinctive colours fired at 1,250 to 1,300 degrees Celsius; the set was rated 5 stars by the national jury in 2023.\n\nQuang Vinh Ceramics Co. Ltd. has four 5-star products, all bowl-and-plate or tea sets with lotus, swallow and dragon-phoenix motifs. Hà Thị Vinh, its director and chair of the Hanoi Association of Handicrafts and Craft Villages, says most of its output is exported to more than 30 countries.\n\nThe article also mentions the Vietnam Craft Village Essence Center that Ms Vinh founded, a place for exhibitions, creative work and tourism that has drawn hundreds of thousands of visitors.',
    },
    publishedAt: '2025-10-19T19:20:00+07:00',
    sourceName: 'Báo Nông nghiệp và Môi trường',
    sourceUrl:
      'https://nongnghiepmoitruong.vn/dang-cap-cua-nhung-san-pham-gom-ocop-5-sao-o-bat-trang-d784589.html',
    sourcePublishedAt: '2025-10-19T19:20:00+07:00',
  },
  {
    key: 'bt-imports-workshop',
    category: 'GENERAL',
    h: null,
    title: 'Gốm sứ Bát Tràng đẩy lùi hàng nhập ngoại',
    summary:
      'Tại hội thảo ngày 16/12/2025, các đại biểu cho biết gốm trang trí Bát Tràng đã chiếm lại thị trường trong nước và nêu những thách thức khi làng lớn mạnh.',
    body: 'Ngày 16/12/2025, xã Bát Tràng tổ chức hội thảo về bảo tồn, phát triển làng nghề gắn với du lịch và chuyển đổi số. Bà Hà Thị Vinh nhận định những năm gần đây gốm trang trí nhập ngoại xuất hiện ít dần vì gốm Bát Tràng đã chiếm lĩnh thị trường nội địa.\n\nXã có ba làng gốm truyền thống là Bát Tràng, Giang Cao và Kim Lan, với hơn 300 nghệ nhân, gần 200 doanh nghiệp, khoảng 1.200 hộ sản xuất, việc làm ổn định cho hơn 20.000 lao động thu nhập 8 đến 9 triệu đồng mỗi tháng, và giá trị sản xuất, kinh doanh ước trên 2.500 tỷ đồng một năm.\n\nĐại diện Bộ Nông nghiệp và Môi trường nêu cơ hội về thương hiệu và thị trường khó tính, đồng thời chỉ ra thách thức: giữ kỹ thuật và men truyền thống khi mở rộng sản xuất, chuyển lò từ than sang gas hoặc điện, phát triển du lịch xanh và đào tạo thế hệ kế cận.',
    en: {
      title: 'Bát Tràng ceramics push back against imports',
      summary:
        'At a workshop on 16 December 2025, speakers said Bát Tràng decorative ceramics have taken back the domestic market, and set out the challenges of a growing village.',
      body: 'On 16 December 2025 Bát Tràng commune held a workshop on preserving and developing craft villages alongside tourism and digital transformation. Hà Thị Vinh observed that imported decorative ceramics have appeared less and less in recent years because Bát Tràng ceramics have taken over the domestic market.\n\nThe commune has three traditional pottery villages, Bát Tràng, Giang Cao and Kim Lan, with more than 300 artisans, nearly 200 enterprises, about 1,200 household businesses, steady jobs for over 20,000 workers earning 8 to 9 million VND a month, and output and trade worth an estimated 2,500 billion VND a year.\n\nA representative of the Ministry of Agriculture and Environment pointed to opportunities in branding and demanding markets, and to challenges: keeping traditional techniques and glazes while scaling up, moving kilns from coal to gas or electricity, developing green tourism and training the next generation.',
    },
    publishedAt: '2025-12-16T16:53:00+07:00',
    sourceName: 'Báo Nông nghiệp và Môi trường',
    sourceUrl:
      'https://nongnghiepmoitruong.vn/gom-su-bat-trang-day-lui-hang-nhap-ngoai-d789697.html',
    sourcePublishedAt: '2025-12-16T16:53:00+07:00',
  },
  {
    key: 'bt-livestream-ocop',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Gốm Bát Tràng lan tỏa trong không gian số',
    summary:
      'Nghệ nhân Vũ Như Quỳnh của thương hiệu Gốm Vạn An Lộc mở màn ngày hội livestream OCOP tại Hoàng thành Thăng Long.',
    body: 'Ngày hội livestream OCOP diễn ra tại Hoàng thành Thăng Long trong lễ khai mạc Festival OCOP Việt Nam 2025, do Bộ Nông nghiệp và Môi trường và UBND thành phố Hà Nội tổ chức, có TikTok Shop đồng hành. Các nghệ nhân kể chuyện nghề, giới thiệu sản phẩm và mở thêm kênh bán hàng cho đồ thủ công truyền thống.\n\nNghệ nhân Vũ Như Quỳnh, chủ thương hiệu Gốm Vạn An Lộc, thế hệ thứ 16 của một dòng họ làm gốm ở Bát Tràng, là người mở màn buổi livestream và chia sẻ cách đưa gốm làng đến khách hàng cả nước và quốc tế qua nền tảng số. Chị cũng xây dựng một kênh TikTok riêng về nghề gốm, cách phân biệt gốm thật và gốm kém chất lượng.\n\nBài báo nhận xét khi nghệ nhân livestream, nghề được nhiều người biết đến hơn và giá trị truyền thống được lưu giữ.',
    en: {
      title: 'Bát Tràng ceramics reach audiences in the digital space',
      summary:
        'Artisan Vũ Như Quỳnh of the Gốm Vạn An Lộc brand opened the OCOP livestream day at the Thăng Long Imperial Citadel.',
      body: "The OCOP livestream day was held at the Thăng Long Imperial Citadel during the opening of Festival OCOP Việt Nam 2025, organised by the Ministry of Agriculture and Environment and the Hanoi People's Committee with TikTok Shop as a partner. Craft artisans told the story of their trade, presented products and opened new sales channels for traditional handicrafts.\n\nArtisan Vũ Như Quỳnh, owner of the Gốm Vạn An Lộc brand and a 16th-generation member of a Bát Tràng pottery family, hosted the opening livestream and shared how the village can reach customers nationwide and abroad through digital platforms. She also runs her own TikTok channel about pottery, including how to tell genuine ware from poor-quality pieces.\n\nThe article argues that when artisans livestream, the craft becomes better known and its traditional values are kept alive.",
    },
    publishedAt: '2025-12-23T20:32:00+07:00',
    sourceName: 'Tạp chí Kinh tế - Tài chính',
    sourceUrl:
      'https://thuehaiquan.tapchikinhtetaichinh.vn/gom-bat-trang-lan-toa-trong-khong-gian-so-134368.html',
    sourcePublishedAt: '2025-12-23T20:32:00+07:00',
  },
  {
    key: 'bt-festival-2026',
    category: 'VILLAGE_EVENT',
    h: null,
    title: 'Lễ hội làng gốm Bát Tràng tiếp nối sứ mệnh gìn giữ văn hóa làng cổ',
    summary:
      'Lễ hội xuân Bính Ngọ 2026 khai hội bằng nghi lễ đánh trống sáng 31/3 và kéo dài bốn ngày tại đình Bát Tràng.',
    body: 'Lễ hội xuân Bính Ngọ 2026 của làng gốm Bát Tràng khai hội sáng 31/3 bằng nghi thức đánh trống, kéo dài bốn ngày đến 3/4 tại đình làng. Chương trình văn hóa, nghệ thuật diễn ra từ chiều 1/4 đến 3/4 và kết thúc bằng lễ phóng đăng trên sông Hồng tối 3/4.\n\nĐình thờ sáu vị thần có công giúp nước, gồm Bạch Mã Đại Vương, Phan Đại Tướng và các vị khác. Các nghi lễ gồm dâng hương, tam sinh, rước kiệu, cấp thủy trên sông Hồng, nhập thủy và tế thần; cảnh kiệu quay thu hút nhiều du khách. Ban tổ chức có 79 thành viên, dân làng bắt tay chuẩn bị ngay sau Tết Nguyên đán.\n\nPhó chủ tịch Vũ Văn Đoàn cho biết lễ hội cầu thời tiết thuận hòa, nghề gốm hưng thịnh, tri ân thành hoàng, tổ nghề và các thế hệ trước, đồng thời gắn bảo tồn di sản với du lịch.',
    en: {
      title:
        'Bát Tràng pottery village festival carries on the mission of keeping the old village culture',
      summary:
        'The spring 2026 (Bính Ngọ) festival opened with a drum ceremony on the morning of 31 March and ran for four days at the Bát Tràng communal house.',
      body: 'The spring Bính Ngọ 2026 festival of Bát Tràng pottery village opened on the morning of 31 March with a drum ceremony and ran for four days until 3 April at the communal house. Cultural and art programmes ran from the afternoon of 1 April to 3 April, and the festival closed with a lantern release on the Red River on the evening of 3 April.\n\nThe communal house worships six deities credited with helping the country, among them Bạch Mã Đại Vương and Phan Đại Tướng. The rites include incense offering, the three-animal offering, the palanquin procession, water-drawing on the Red River, water-entering and the sacrifice to the deities; the spinning palanquins draw many visitors. The organising committee has 79 members and villagers began preparing right after the Lunar New Year.\n\nVice chair Vũ Văn Đoàn said the festival prays for good weather and a thriving pottery trade, honours the guardian deity, the craft ancestors and earlier generations, and links heritage conservation with tourism.',
    },
    publishedAt: '2026-04-01T14:55:00+07:00',
    sourceName: 'Báo Nông nghiệp và Môi trường',
    sourceUrl:
      'https://nongnghiepmoitruong.vn/le-hoi-lang-gom-bat-trang-tiep-noi-su-menh-gin-giu-van-hoa-lang-co-d804150.html',
    sourcePublishedAt: '2026-04-01T14:55:00+07:00',
    pinned: true,
  },
  {
    key: 'bt-digital-village',
    category: 'GENERAL',
    h: null,
    title: 'Bát Tràng phát huy giá trị truyền thống thông qua định hình làng nghề số',
    summary:
      'Bát Tràng đặt mục tiêu thành làng nghề số: mọi hộ làm gốm đã có logo nhận diện sản phẩm, khoảng 20% cơ sở thường xuyên bán qua livestream.',
    body: 'Bát Tràng đang chuyển đổi số để nâng giá trị, thương hiệu và sức cạnh tranh cho sản phẩm, kết hợp công nghệ với việc giữ gìn văn hóa và nghề truyền thống. Bài báo gắn việc này với các nghị quyết của Đảng về văn hóa và về khoa học công nghệ.\n\nTheo số liệu nêu trong bài, làng có khoảng 814 doanh nghiệp và 2.805 hộ kinh doanh, hơn 1.350 hộ làm nghề ở Bát Tràng, Giang Cao và Kim Lan. Mọi hộ làm gốm đã có logo nhận diện sản phẩm, khoảng 20% cơ sở bán hàng bằng livestream thường xuyên, 70 sản phẩm OCOP 3 đến 5 sao gắn tem truy xuất QR, và lò nung đã chuyển từ than sang gas hoặc điện.\n\nLãnh đạo địa phương đề nghị thành phố hỗ trợ cơ sở dữ liệu nghề, số hóa sản phẩm, nghệ nhân và di sản, thương mại điện tử, bảo hộ sở hữu trí tuệ; về lâu dài làng hướng tới mô hình làng nghề số, du lịch thông minh và bảo tàng số.',
    en: {
      title: 'Bát Tràng builds on its traditions by shaping a digital craft village',
      summary:
        'Bát Tràng aims to become a digital craft village: every pottery household has a product identity logo and about 20% of establishments sell by livestream regularly.',
      body: 'Bát Tràng is going digital to raise the value, brand and competitiveness of its products, combining technology with the preservation of culture and the traditional craft. The article ties this to the Party resolutions on culture and on science and technology.\n\nAccording to the figures in the piece, the village has about 814 enterprises and 2,805 business households, with more than 1,350 households practising the craft across Bát Tràng, Giang Cao and Kim Lan. Every pottery household has a product identity logo, about 20% of establishments livestream regularly, 70 OCOP products rated 3 to 5 stars carry QR traceability stamps, and kilns have moved from coal to gas or electricity.\n\nLocal leaders asked the city for support with a digital craft database, digitisation of products, artisans and heritage, e-commerce and intellectual property protection; in the long run the village aims for a digital craft village model, smart tourism and a digital museum.',
    },
    publishedAt: '2026-08-27T17:32:00+07:00',
    sourceName: 'VietnamPlus',
    sourceUrl:
      'https://www.vietnamplus.vn/bat-trang-phat-huy-gia-tri-truyen-thong-thong-qua-dinh-hinh-lang-nghe-so-post1132289.vnp',
    sourcePublishedAt: '2026-08-27T17:32:00+07:00',
    pinned: true,
  },
  {
    key: 'bt-tan-thinh-ip',
    category: 'CRAFT_STORY',
    h: null,
    title: 'HTX Gốm sứ Tân Thịnh: Từ giữ nghề bằng đôi tay đến bảo vệ bằng tài sản trí tuệ',
    summary:
      'HTX Tân Thịnh kết hợp máy móc với tay nghề thợ và đăng ký bảo hộ nhãn hiệu cho các dòng men đặc trưng gắn với nhãn hiệu tập thể Gốm sứ Bát Tràng.',
    body: 'HTX Gốm sứ Tân Thịnh thành lập năm 2013 với 11 nghệ nhân, nay có hơn 300 lao động và làm ra hơn 50.000 sản phẩm mỗi năm. Từ năm 2021, hợp tác xã đầu tư máy cho các khâu như trộn đất, nghiền, tạo hình, in hoa văn và lò nung; lò chuyển từ than, củi sang gas và điện nên kiểm soát nhiệt tốt hơn, ít khói hơn. Chủ nhiệm, nghệ nhân Trần Đức Tân, nói máy làm việc nặng và lặp lại, còn khâu cần óc phán đoán và sáng tạo vẫn do thợ làm.\n\nMen Suối Ngọc được nghiên cứu khoảng năm năm từ nguyên liệu trong nước, nung quanh 1.250 độ C; mỗi mẻ lại có khác biệt nhỏ, vừa là nét nghệ thuật vừa là thách thức kiểm soát. Bộ Suối Ngọc đạt OCOP 5 sao năm 2023.\n\nHợp tác xã đã đăng ký bảo hộ nhãn hiệu cho các dòng men chủ lực, gắn với nhãn hiệu tập thể Gốm sứ Bát Tràng, vì một bộ sản phẩm mới thường mất 6 đến 12 tháng nghiên cứu. Năm 2026 đơn vị muốn mở rộng thị trường quốc tế, trong đó có Ấn Độ.',
    en: {
      title:
        'Tân Thịnh Ceramics Cooperative: from keeping the craft by hand to protecting it with intellectual property',
      summary:
        'The Tân Thịnh cooperative pairs machines with skilled hands and has registered trademarks for its signature glaze lines, linked to the collective mark Gốm sứ Bát Tràng.',
      body: 'The Tân Thịnh Ceramics Cooperative was founded in 2013 with 11 artisans and now has more than 300 workers and makes over 50,000 products a year. Since 2021 it has invested in machines for steps such as clay mixing, grinding, forming, pattern printing and the kilns; kilns moved from coal and wood to gas and electricity, giving better heat control and less smoke. Chairman and artisan Trần Đức Tân says machines take the heavy, repetitive work while the steps that need judgment and creativity stay with the artisans.\n\nThe Suối Ngọc glaze took about five years to develop from domestic materials and is fired at around 1,250 degrees Celsius; each firing varies slightly, which is both an artistic feature and a control challenge. The Suối Ngọc set earned OCOP 5 stars in 2023.\n\nThe cooperative has registered trademarks for its main glaze lines, tied to the collective mark Gốm sứ Bát Tràng, since a new product set usually takes 6 to 12 months to develop. In 2026 it aims to widen its international markets, including India.',
    },
    publishedAt: '2026-09-15T08:23:00+07:00',
    sourceName: 'VnBusiness',
    sourceUrl:
      'https://vnbusiness.vn/htx-gom-su-tan-thinh-tu-giu-nghe-bang-doi-tay-den-bao-ve-bang-tai-san-tri-tue.html',
    sourcePublishedAt: '2026-09-15T08:23:00+07:00',
  },
];
