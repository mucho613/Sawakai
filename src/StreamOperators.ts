import xs, { Stream } from "xstream";
import split from "xstream/extra/split";
import buffer from "xstream/extra/buffer";
import concat from "xstream/extra/concat";
import delay from "xstream/extra/delay";
import sampleCombine from "xstream/extra/sampleCombine";

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

export const sample = <Any>(sampler$: Stream<Any>) => <T>(
  data$: Stream<T>
): Stream<T> => sampleCombine(data$)(sampler$).map(([_, d]) => d);

export const stamp = <Any>(stamper$: Stream<Any>) => <T>(
  data$: Stream<T>
): Stream<T> => xs.merge(data$, sample(stamper$)(data$));

export const exponentialRetry = (rate: number) => (firstDelay: number) => <T>(
  try$: Stream<T>
): Stream<T> =>
  try$
    .map((sig: T) => {
      const aProxy$: Stream<number> = xs.create();
      const b$ = aProxy$
        .map((t) => {
          const nd = t * (1 + Math.max(0, rate - 1) * Math.random());
          return delay<number>(t)(xs.of(nd));
        })
        .flatten();
      const a$ = xs.merge(
        xs.of(firstDelay),
        b$.map((t) => t)
      );
      aProxy$.imitate(a$);
      return b$.mapTo(sig);
    })
    .flatten();
