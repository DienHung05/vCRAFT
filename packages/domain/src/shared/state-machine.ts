import { DomainError } from './domain-error';
import { err, ok, type Result } from './result';

/**
 * Helper máy trạng thái tổng quát (State pattern, ARCHITECTURE §5) dùng chung cho
 * RFQ, Bid và Allocation. Bảng chuyển trạng thái là DỮ LIỆU khai báo; helper chỉ tra bảng.
 *
 * - `S` trạng thái, `E` sự kiện, `C` ngữ cảnh đánh giá guard, `G` mã lỗi guard.
 * - Mỗi luật có hai nhóm guard:
 *   - `guards`: điều kiện về *khả dụng* (tác nhân, thời điểm, dữ liệu liên quan). `availableEvents`
 *     cũng đánh giá nhóm này để UI chỉ hiện nút hợp lệ (FR-RFQ-12).
 *   - `inputGuards`: kiểm tra dữ liệu người dùng nhập kèm lệnh (vd. lý do hủy). Chỉ `transition`
 *     đánh giá, để nút vẫn hiện trước khi người dùng nhập xong.
 * - `transition` và `availableEvents` BẮT BUỘC `ctx` và luôn chạy guard (không có đường tắt bỏ qua
 *   kiểm quyền). Cần tra cứu thuần cấu trúc bảng (vẽ sơ đồ, test bảng) thì dùng `structuralNext` /
 *   `structuralEvents`: các hàm này KHÔNG kiểm tác nhân hay guard, không được dùng để cho phép hành động.
 */
export type Guard<C, G extends string> = (ctx: C) => DomainError<G> | undefined;

export interface TransitionRule<S extends string, C, G extends string> {
  readonly to: S;
  /** Mã dòng trong SRS (vd. 'T1'), phục vụ truy vết và tài liệu. */
  readonly ref?: string;
  readonly guards?: readonly Guard<C, G>[];
  readonly inputGuards?: readonly Guard<C, G>[];
}

export type TransitionTable<S extends string, E extends string, C, G extends string> = {
  readonly [K in S]: { readonly [P in E]?: TransitionRule<S, C, G> };
};

export interface StateMachineDefinition<S extends string, E extends string, C, G extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly events: readonly E[];
  readonly table: TransitionTable<S, E, C, G>;
}

export type TransitionError<G extends string> = DomainError<'INVALID_TRANSITION' | G>;

export interface StateMachine<S extends string, E extends string, C, G extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly events: readonly E[];
  /** Trạng thái kế tiếp hoặc lỗi `INVALID_TRANSITION` / mã guard. Luôn chạy guard; `ctx` bắt buộc. */
  transition(state: S, event: E, ctx: C): Result<S, TransitionError<G>>;
  /** Sự kiện hợp lệ ở `state`, theo thứ tự khai báo, đã lọc theo guard khả dụng của `ctx`. */
  availableEvents(state: S, ctx: C): E[];
  /**
   * Tra cứu CẤU TRÚC bảng: trạng thái đích nếu bảng có dòng (state, event), nếu không `INVALID_TRANSITION`.
   * KHÔNG kiểm tác nhân, thời điểm hay bất kỳ guard nào; không dùng để quyết định cho phép hành động.
   */
  structuralNext(state: S, event: E): Result<S, DomainError<'INVALID_TRANSITION'>>;
  /** Sự kiện có dòng trong bảng ở `state`, theo thứ tự khai báo. KHÔNG kiểm quyền/guard (xem `structuralNext`). */
  structuralEvents(state: S): E[];
  /** Trạng thái kết thúc: không có sự kiện nào đi ra. */
  isTerminal(state: S): boolean;
}

export function createStateMachine<S extends string, E extends string, C, G extends string>(
  def: StateMachineDefinition<S, E, C, G>,
): StateMachine<S, E, C, G> {
  const ruleOf = (state: S, event: E): TransitionRule<S, C, G> | undefined =>
    def.table[state][event];

  const firstFailure = (
    guards: readonly Guard<C, G>[] | undefined,
    ctx: C,
  ): DomainError<G> | undefined => {
    for (const guard of guards ?? []) {
      const failure = guard(ctx);
      if (failure) return failure;
    }
    return undefined;
  };

  // Không dùng `this`: các máy được xuất dưới dạng hàm rời (`export const transition = machine.transition`).
  const structuralNext = (state: S, event: E): Result<S, DomainError<'INVALID_TRANSITION'>> => {
    const rule = ruleOf(state, event);
    if (!rule) {
      return err(
        new DomainError(
          'INVALID_TRANSITION',
          `${def.name}: event ${event} is not allowed in state ${state}`,
          { machine: def.name, from: state, event },
        ),
      );
    }
    return ok(rule.to);
  };

  return {
    name: def.name,
    states: def.states,
    events: def.events,

    structuralNext,

    structuralEvents(state) {
      return def.events.filter((event) => ruleOf(state, event) !== undefined);
    },

    transition(state, event, ctx) {
      const rule = ruleOf(state, event);
      if (!rule) return structuralNext(state, event);
      const failure = firstFailure(rule.guards, ctx) ?? firstFailure(rule.inputGuards, ctx);
      if (failure) return err(failure);
      return ok(rule.to);
    },

    availableEvents(state, ctx) {
      return def.events.filter((event) => {
        const rule = ruleOf(state, event);
        return rule !== undefined && firstFailure(rule.guards, ctx) === undefined;
      });
    },

    isTerminal(state) {
      return def.events.every((event) => ruleOf(state, event) === undefined);
    },
  };
}
