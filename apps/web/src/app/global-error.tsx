'use client';

/**
 * Error boundary of the root layout itself. It replaces the whole document, so it renders its own
 * `<html>` and `<body>` and cannot use the next-intl provider: the copy is static, in both languages.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <main role="alert" style={{ maxWidth: '36rem' }}>
          <h1>Đã có trục trặc ở phía chúng tôi</h1>
          <p>Trang này chưa hiển thị được. Bạn hãy thử lại sau ít phút.</p>
          <h2 lang="en" style={{ fontSize: '1.1rem', marginTop: '2rem' }}>
            Something went wrong on our side
          </h2>
          <p lang="en">This page could not be shown. Please try again in a few minutes.</p>
          <button type="button" onClick={reset} style={{ marginTop: '1rem', padding: '8px 20px' }}>
            Thử lại / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
