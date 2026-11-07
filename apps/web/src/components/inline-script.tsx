/**
 * An inline `<script>` that carries the request's CSP nonce (NFR-SEC-04). Only for constant, trusted
 * source such as the theme and font bootstrap in `lib/theme.ts`; never pass user-controlled text.
 * The browser hides `nonce` from the DOM after parsing, so hydration would flag a mismatch without
 * `suppressHydrationWarning`.
 */
export function InlineScript({ code, nonce }: { code: string; nonce: string | undefined }) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script; as a JSX child React would escape its quotes.
    <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: code }} />
  );
}
