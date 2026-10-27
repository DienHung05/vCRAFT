import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Link/redirect/router biết pathnames bản địa hóa. Dùng thay `next/link`, `next/navigation`. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
