import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PaymentCheckoutData } from '@vcraft/database';
import { paymentsConfig } from '../payments.config';
import type { PaymentSnapshot } from './payment-gateway';

/** The localized path (vi, the default locale) of the public confirm page of the web. */
export const DEMO_CONFIRM_PATH = '/vi/thanh-toan/thu';

/**
 * Demo payment mode (ADR-0025). Stands in for every method while `PAYMENTS_DEMO_MODE=true`: nothing is called
 * outside the process. The buyer is given a link to our own confirm page with a per-payment secret; the web
 * shows it as a QR code to scan with a phone. It is never a VietQR or bank code, so no real bank app can be
 * pointed at an invented account. The secret lives only inside the stored checkout.
 */
@Injectable()
export class DemoGateway {
  async createCheckout(payment: PaymentSnapshot): Promise<PaymentCheckoutData> {
    const token = randomBytes(24).toString('base64url');
    const { appUrl } = paymentsConfig();
    return {
      type: 'DEMO',
      confirmUrl: `${appUrl}${DEMO_CONFIRM_PATH}/${encodeURIComponent(payment.referenceCode)}?k=${token}`,
    };
  }
}
