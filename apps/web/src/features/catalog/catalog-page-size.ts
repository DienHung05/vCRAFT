/**
 * Products per catalog page. Lives in its own module (no `'use client'`): the server page needs the
 * value, and a constant exported from a client module reaches server code as a client reference
 * function, not a number.
 */
export const CATALOG_PAGE_SIZE = 12;
