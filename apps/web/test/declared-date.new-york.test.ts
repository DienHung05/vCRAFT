// @vitest-environment node
import { declaredDateCases } from './declared-date-cases';

process.env.TZ = 'America/New_York';
declaredDateCases('America/New_York', 240);
