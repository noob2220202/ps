const nf = new Intl.NumberFormat("ko-KR");

export const won = (n: number) => `${nf.format(n)}원`;

// 영상 기준: 출금은 "-1,500원", 입금은 부호 없이 "7원"(파란색)
export const signedWon = (n: number) => (n < 0 ? `-${won(-n)}` : won(n));

export function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  return [...map];
}
