# vCraft

Shared language for the craft village digital exhibition and its quotation and order-coordination activities.

## Language

**Digital exhibition / Triển lãm số**:
A public presentation of craft households, their histories, their work, and the processes used to make it. Visitors explore these accounts and objects to understand the craft and discover workshops to visit.
_Avoid_: Social network, shopping district

**Household / Hộ sản xuất**:
A craft-producing unit presented by the exhibition under its own public name and history. A household can include several artisans and operate several workshops, independently of its representative account.
_Avoid_: Artisan when referring to the whole household, account

**Artisan / Nghệ nhân**:
An individual maker associated with a household whose contribution to the craft can be named separately from the household's shared history.
_Avoid_: Household when referring to a person, account

**Household representative / Người đại diện hộ**:
The person designated to act for a household through its representative account. A representative may be an artisan or someone who handles the household's administration.

**Workshop / Xưởng**:
A physical craft location listed under a household, used for making, displaying, or experiencing its work. Each workshop has its own visiting information, and a production location may differ from where visitors are welcome.

**Product / Sản phẩm**:
An identified single physical object or specific production batch for which one household is responsible, with its own production history and QR code. Several artisans may receive credit for making it.
_Avoid_: Product design when referring to a particular object or batch

**Production batch / Lô sản xuất**:
A defined group of objects of one design made during one production run, represented by one product with a shared production history. The number of objects in the batch is distinct from the number still available.
_Avoid_: Product design, stock

**Product design / Mẫu sản phẩm**:
The repeatable appearance and characteristics that objects or production batches can share.
_Avoid_: Product when referring only to a repeatable design


**Guest / Khách vãng lai**:
A visitor with no account. A guest sees only the published public exhibition.
_Avoid_: Buyer

**Buyer / Khách**:
A person with an account who can request wholesale quotations. A buyer does not act for a household.
_Avoid_: Guest, household representative

**Village administration / Ban quản lý**:
The village body that accepts households into the exhibition, reviews certificates those households declare, and publishes village news. It is not a household and not a maker.
_Avoid_: Household, artisan

**Village administrator / Quản trị viên làng**:
A person who acts for the village administration through an administrator account. An administrator is not a member of a household.
_Avoid_: Household representative, artisan

**Household approval / Chấp nhận hộ**:
The village administration's acceptance of a household as a craft-producing unit presented in the exhibition. Approval is not a claim that every public sentence is true, or that a named artisan made a particular object.
_Avoid_: Certificate verification, physical authenticity

**Certificate verification / Kiểm tra giấy tờ**:
The village administration's mark that it reviewed one certificate a household declared. Verification is not a claim that a product is genuine.
_Avoid_: Household approval, physical authenticity

**Journal integrity / Toàn vẹn nhật ký**:
The exhibition's promise that a household's published account of making a product was not silently replaced. Integrity is not a claim that the events happened as written.
_Avoid_: Physical authenticity, proof of origin

**Production journal / Nhật ký sản xuất**:
The ordered record of how one product was made, written as entries attached to that product. A journal is evidence of the published account, distinct from the household's informal story.
_Avoid_: Household story, audit log

**Journal entry / Mốc nhật ký**:
One recorded stage in a production journal, carrying its stage, the date the household declares, a note, and optional images. After publication an entry is only corrected by a later entry that names it.
_Avoid_: Audit record, household story

**Correction entry / Mốc đính chính**:
A journal entry that supersedes an earlier published entry, leaving the original visible. A correction is part of the journal, not a silent edit.
_Avoid_: Edit, deletion

**Suspension / Tạm ngừng trưng bày**:
A state in which a household's public exhibition presence is hidden while its private records remain. Suspension is not a rejection of the application and not a lock on the representative's account.
_Avoid_: Rejection, account lock, workshop closure

**Household-only news / Tin chỉ dành cho hộ**:
News the village administration addresses to representatives of approved households, not to the public.
_Avoid_: Public news, social feed


**Quotation request / Yêu cầu báo giá**:
A buyer's private request for an offer to supply a specified quantity of work. The buyer sends it to selected households, asks the village administration to coordinate a response, or does both. With neither, the system invites up to ten households that work in the request's category.
_Avoid_: Order, public tender

**Quotation / Báo giá**:
An offer to fulfil the whole quantity in a quotation request, made by one household or assembled by the village administration from several households' contributions.
_Avoid_: Quotation request, order

**Cooperative quotation / Báo giá hợp tác**:
A quotation the assigned village administrator assembles from several households' contributions, presented to the buyer as one complete offer.
_Avoid_: Separate orders, direct quotation

**Direct quotation / Báo giá trực tiếp**:
A quotation one invited household sends the buyer for the whole quantity, with its own unit price and completion date, on a request nobody coordinates. The buyer compares the households' direct quotations and accepts one.
_Avoid_: Contribution offer, cooperative quotation

**Contribution offer / Đề xuất tham gia**:
A household's private offer to the village administration stating the maximum quantity, unit price, and completion date it proposes for one quotation request. It is an input to a cooperative quotation and does not reserve capacity across requests.
_Avoid_: Complete quotation, order, allocation

**Order / Đơn hàng**:
The work agreed when a buyer accepts one complete quotation, with its quantity, price, and delivery terms fixed. It awaits confirmation of the participating households' allocations before production starts.
_Avoid_: Quotation request, quotation

**Payment / Thanh toán** _(planned, [ADR-0021](docs/adr/0021-online-payment-for-orders.md))_:
One online settlement of part of an order's price by the buyer, through a bank transfer, VietQR, VNPay or MoMo. It counts as paid only when the provider confirms it to the server, never from the buyer's browser.
_Avoid_: Payout, allocation

**Deposit / Đặt cọc** _(planned, [ADR-0021](docs/adr/0021-online-payment-for-orders.md))_:
The first payment of an order, a fixed share of its price, which must be paid before production starts. The rest of the price is the balance.
_Avoid_: Down payment, advance

**Allocation / Phân bổ**:
One household's specified share of an order, with its own quantity, agreed price, and completion date.
_Avoid_: Production batch, contribution offer


**Progress report / Báo cáo tiến độ**:
A household's private statement of the completed quantity for its allocation, with optional notes and photos. It is distinct from the published production journal of an object or batch.
_Avoid_: Journal entry, receipt confirmation
