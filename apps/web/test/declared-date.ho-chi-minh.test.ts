// @vitest-environment node
import { declaredDateCases } from './declared-date-cases';

process.env.TZ = 'Asia/Ho_Chi_Minh';
declaredDateCases('Asia/Ho_Chi_Minh', -420);
