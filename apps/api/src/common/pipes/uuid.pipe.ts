import type { PipeTransform } from '@nestjs/common';
import { notFound } from '../errors/app-error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id trên URL không phải uuid ⇒ 404 (không để CSDL ném lỗi kiểu dữ liệu). */
export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw notFound();
    return value.toLowerCase();
  }
}
