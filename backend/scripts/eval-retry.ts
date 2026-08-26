/**
 * Ponowienie po limicie Google, wspolne dla skryptow pomiarowych.
 *
 * Google liczy zapytania na minute, osobno dla kazdego modelu, a pomiar to
 * kilkaset wywolan pod rzad. Odmierzanie tempa z gory wymagaloby jednej
 * zgadnietej liczby na model; odpowiedz 429 niesie czas, ktory sam sobie zyczy,
 * wiec taniej jest zapytac raz i poczekac tyle, ile kazano.
 *
 * Osobny plik, bo importuja to dwa skrypty, a kazdy z nich pisze do bazy juz
 * przy samym zaladowaniu: import jednego z drugiego odpalilby caly przebieg.
 */
export async function patiently<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      const message = (err as Error).message;
      if (attempt >= 5 || !message.includes("429")) throw err;
      const asked = /"retryDelay": "(\d+)s"/.exec(message);
      const wait = (asked ? Number(asked[1]) : 30) + 2;
      console.log(`  limit Gemini, czekam ${wait}s`);
      await sleep(wait * 1000);
    }
  }
}

export const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
