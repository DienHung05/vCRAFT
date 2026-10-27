/**
 * Luật ranh giới giữa các workspace (xem docs/ARCHITECTURE.md §3.2).
 * Vi phạm => CI fail.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'packages/domain không được phụ thuộc framework, ORM hay workspace khác',
      severity: 'error',
      from: { path: '^packages/domain' },
      to: { path: '^(apps|packages/(?!domain))|node_modules' },
    },
    {
      name: 'web-no-database',
      comment: 'Frontend chỉ nói chuyện với backend qua REST JSON (api-client), không import ORM',
      severity: 'error',
      from: { path: '^apps/web' },
      to: { path: '^packages/database|^apps/(api|worker)' },
    },
    {
      name: 'ui-no-business',
      comment: 'Design system không biết gì về nghiệp vụ',
      severity: 'error',
      from: { path: '^packages/ui' },
      to: { path: '^packages/(domain|contracts|database|api-client)' },
    },
    {
      name: 'packages-not-import-apps',
      severity: 'error',
      from: { path: '^packages' },
      to: { path: '^apps' },
    },
  ],
  options: { tsConfig: { fileName: 'tooling/typescript/base.json' } },
};
