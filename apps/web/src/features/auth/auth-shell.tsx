import { Card, cn } from '@vcraft/ui';
import type { ReactNode } from 'react';

/** Khung chung của các trang tài khoản: tiêu đề, dẫn nhập, rồi thẻ nội dung giữa trang. */
export function AuthShell({
  title,
  lead,
  children,
  wide = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  /** Rộng hơn cho wizard nhiều bước. */
  wide?: boolean;
}) {
  return (
    <div className="px-gutter pt-10 pb-section md:pt-14">
      <div className={cn('mx-auto flex flex-col gap-6', wide ? 'max-w-3xl' : 'max-w-md')}>
        <header className="flex flex-col gap-2">
          <h1 className="text-h2 text-glaze">{title}</h1>
          {lead ? <p className="text-ash">{lead}</p> : null}
        </header>
        <Card className="p-5 md:p-8">{children}</Card>
      </div>
    </div>
  );
}
