'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { FALLBACK_USD_RATE, type UsdRate } from '@/lib/currency';

const UsdRateContext = createContext<UsdRate>(FALLBACK_USD_RATE);

/**
 * Makes the daily USD rate (fetched once in the locale layout) available to every price on the
 * page, in server and client components alike, without a request from the browser.
 */
export function UsdRateProvider({ value, children }: { value: UsdRate; children: ReactNode }) {
  return <UsdRateContext value={value}>{children}</UsdRateContext>;
}

export function useUsdRate(): UsdRate {
  return useContext(UsdRateContext);
}
