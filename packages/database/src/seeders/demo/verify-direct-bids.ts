import type { EntityManager } from '@mikro-orm/core';
import { CooperativeQuotation, QuotationRequest } from '../../entities/index.js';
import { DEMO_HOUSEHOLD_IDS, DEMO_REQUEST_IDS } from './accounts.js';

type AddCheck = (name: string, ok: boolean, detail: string) => void;

/** Competing direct bids the buyer compares and accepts one of (GH#479). */
export const DIRECT_BID_COUNT = 3;
/** The deadline of both requests must leave this many days for the live demo. */
const MIN_OPEN_DAYS = 3;

/**
 * Direct bidding of the demo data (GH#479): one request without coordination in BIDDING with three competing
 * direct (`INDIVIDUAL`) quotations from three different households that differ in unit price and completion date,
 * and one SENT request without coordination where the demo household is invited and has not bid yet. Read-only.
 */
export async function verifyDirectBids(
  em: EntityManager,
  add: AddCheck,
  now: Date = new Date(),
): Promise<void> {
  const daysLeft = (request: QuotationRequest) =>
    (request.biddingClosesAt.getTime() - now.getTime()) / 86_400_000;

  const bidding = await em.findOne(QuotationRequest, DEMO_REQUEST_IDS.biddingDirect);
  const bids = bidding
    ? await em.find(CooperativeQuotation, {
        request: bidding,
        bidType: 'INDIVIDUAL',
        status: 'SUBMITTED',
      })
    : [];
  const bidders = new Set(bids.map((bid) => bid.parts[0]?.householdId));
  const prices = new Set(bids.map((bid) => bid.parts[0]?.unitPriceVnd));
  const dates = new Set(bids.map((bid) => bid.parts[0]?.completionDate));
  const biddingOk =
    bidding?.status === 'BIDDING' &&
    !bidding.coordinationOptIn &&
    bids.length === DIRECT_BID_COUNT &&
    bidders.size === DIRECT_BID_COUNT &&
    !bidders.has(DEMO_HOUSEHOLD_IDS.household) &&
    prices.size === DIRECT_BID_COUNT &&
    dates.size === DIRECT_BID_COUNT &&
    daysLeft(bidding) >= MIN_OPEN_DAYS;
  add(
    `Báo giá trực tiếp: yêu cầu BIDDING không điều phối có ${DIRECT_BID_COUNT} báo giá của ${DIRECT_BID_COUNT} hộ, khác giá và ngày giao, hạn còn ≥ ${MIN_OPEN_DAYS} ngày`,
    biddingOk,
    bidding
      ? `${bidding.status}, ${bids.length} báo giá, ${bidders.size} hộ, ${prices.size} mức giá, ${dates.size} ngày giao, còn ${daysLeft(bidding).toFixed(1)} ngày`
      : 'không tìm thấy yêu cầu',
  );

  const sent = await em.findOne(QuotationRequest, DEMO_REQUEST_IDS.sentDirect);
  const sentBids = sent ? await em.count(CooperativeQuotation, { request: sent }) : 0;
  const sentOk =
    sent?.status === 'SENT' &&
    !sent.coordinationOptIn &&
    sent.invitedHouseholdIds.includes(DEMO_HOUSEHOLD_IDS.household) &&
    sentBids === 0 &&
    daysLeft(sent) >= MIN_OPEN_DAYS;
  add(
    `Báo giá trực tiếp: yêu cầu SENT không điều phối mời hộ household, chưa có báo giá, hạn còn ≥ ${MIN_OPEN_DAYS} ngày`,
    sentOk,
    sent
      ? `${sent.status}, ${sent.invitedHouseholdIds.includes(DEMO_HOUSEHOLD_IDS.household) ? 'đã mời' : 'chưa mời'} hộ household, ${sentBids} báo giá, còn ${daysLeft(sent).toFixed(1)} ngày`
      : 'không tìm thấy yêu cầu',
  );
}
