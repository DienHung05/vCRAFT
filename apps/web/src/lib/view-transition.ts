/**
 * Guard for cross-document view transitions. `globals.css` opts every page in (`@view-transition`), because
 * both the old and the new document must opt in, but the only navigation that should animate is the one after
 * a sealed sign-in (`kiln-feedback.ts` marks the leaving document with `data-kiln-vt`). Any other hard
 * navigation skips the transition in `pageswap`, the last moment the old document can still do so.
 * Browsers without cross-document view transitions never fire a `viewTransition` here.
 *
 * It is an inline script in the root layout head, like `FONTS_FLAG_SCRIPT`: it has to be registered before
 * the first navigation away, with no hydration needed. The site's CSP (`deploy-config.ts`) sets no `script-src`.
 */
export const VIEW_TRANSITION_GUARD_SCRIPT = `addEventListener('pageswap',function(e){if(e.viewTransition&&!document.documentElement.dataset.kilnVt)e.viewTransition.skipTransition()})`;
