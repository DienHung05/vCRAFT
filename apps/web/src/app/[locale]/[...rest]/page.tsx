import { notFound } from 'next/navigation';

/**
 * Catches every URL no page matches so the 404 renders inside the locale layout (with `<html lang>`,
 * header and footer). Without it Next falls back to its bare built-in 404 page.
 */
export default function UnmatchedPage() {
  notFound();
}
