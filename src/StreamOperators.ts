import xs, { Stream } from "xstream";
import split from "xstream/extra/split";
import buffer from "xstream/extra/buffer";
import concat from "xstream/extra/concat";

// 普通のtakeと違ってcomplete時刻を変更しない
// TODO: この関数要らんかも
// TODO: もっと綺麗に実装できるかも
export const justTake = (n: number) => <T>(s$: Stream<T>): Stream<T> =>
  s$
    .take(1)
    .map((first) =>
      s$.fold<[number, T]>((acc, v) => [acc[0] + 1, v], [0, first])
    )
    .flatten()
    .filter(([i, _]) => i < n)
    .map(([_, v]) => v);

export const delayUntil = <Any>(signal$: Stream<Any>) => <T>(
  s$: Stream<T>
): Stream<T> => {
  return xs.merge(
    buffer<T>(signal$)(s$)
      .take(1)
      .map((l) => xs.fromArray(l))
      .flatten(),
    s$
  );
};
