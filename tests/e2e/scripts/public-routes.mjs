/** One manifest for the public-route audit tools (GH#301): captures, measurements, Lighthouse. */
export const PUBLIC_ROUTES = [
  { id: 'home', path: '/vi' },
  { id: 'san-pham', path: '/vi/san-pham' },
  { id: 'san-pham-detail', path: '/vi/san-pham/binh-hut-loc-men-lam-bt7k2qxm' },
  { id: 'nghe-nhan', path: '/vi/nghe-nhan' },
  { id: 'nghe-nhan-detail', path: '/vi/nghe-nhan/gom-bich-hop' },
  { id: 'ban-do', path: '/vi/ban-do' },
  { id: 'tin-tuc', path: '/vi/tin-tuc' },
  { id: 'tin-tuc-detail', path: '/vi/tin-tuc/cho-gom-dem-bat-trang-tro-lai-vao-cuoi-tuan' },
  {
    id: 'bao-gia',
    path: '/vi/yeu-cau-bao-gia/moi',
    // The form belongs to the buyer area. Public visitors must sign in first.
    signedOutPath: '/vi/dang-nhap',
  },
  { id: 'truy-xuat', path: '/vi/truy-xuat/BT7K2QXM' },
  { id: 'dang-nhap', path: '/vi/dang-nhap' },
  { id: 'dang-ky', path: '/vi/dang-ky' },
];

/** The three-route subset the performance/CLS comparison reports on (GH#301). */
export const PERF_ROUTES = PUBLIC_ROUTES.filter((r) =>
  ['home', 'san-pham-detail', 'nghe-nhan-detail'].includes(r.id),
);
