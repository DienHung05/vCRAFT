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
 * - Không truyền `ctx` ⇒ chỉ kiểm tra cấu trúc bảng (bỏ qua mọi guard).
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
  /** Trạng thái kế tiếp hoặc lỗi `INVALID_TRANSITION` / mã guard. */
  transition(state: S, event: E, ctx?: C): Result<S, TransitionError<G>>;
  /** Sự kiện hợp lệ ở `state`, theo thứ tự khai báo; có `ctx` thì lọc thêm theo guard khả dụng. */
  availableEvents(state: S, ctx?: C): E[];
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

  return {
    name: def.name,
    states: def.states,
    events: def.events,

    transition(state, event, ctx) {
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
      if (ctx !== undefined) {
        const failure = firstFailure(rule.guards, ctx) ?? firstFailure(rule.inputGuards, ctx);
        if (failure) return err(failure);
      }
      return ok(rule.to);
    },

    availableEvents(state, ctx) {
      return def.events.filter((event) => {
        const rule = ruleOf(state, event);
        if (!rule) return false;
        return ctx === undefined || firstFailure(rule.guards, ctx) === undefined;
      });
    },

    isTerminal(state) {
      return def.events.every((event) => ruleOf(state, event) === undefined);
    },
  };
}
