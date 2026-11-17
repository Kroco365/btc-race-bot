// Dawn Rider: a patient BTC trend rider for the make.fun btc-race-24h-20261117-0603.
// Idea (from grading the kit's dev window locally): on 1-minute cbBTC bars the noise
// (about 6 bps per minute) is large next to the cost of a full round trip (about
// 37 bps at full size: 4 bps fee + 2 bps slippage + ~13 bps of price impact each
// way), so every strategy that trades often bleeds to death on this window — the
// kit's own EMA-cross baseline loses $106 and its RSI/Bollinger baseline $24,
// while simply buying early and holding makes money. This bot therefore trades
// at most a few times: it buys once, on the first confirmed short-term up-move,
// and then holds to the end of the window. It never chases, never re-enters on
// noise, and never sells into a dip. The one exception is a disaster stop: if
// the position ever falls 5% from its peak value the bot sells it all, which
// never fires on the dev window (deepest peak-to-trough there is about 1.3%)
// and only caps a real crash on the unseen race window.
//
// Entry (once per window, while flat): the latest close is above the close 8 bars
// ago AND above its own 8-bar EMA — a short up-move confirmed by the trend the
// last 8 minutes built. The order spends all cash (one position, 100% weight).
// Fills land at the next bar's open, so a buy the market refuses (a price past
// the slippage cap) is simply tried again on the next bar while the signal holds.
//
// Deterministic: only bar closes feed the decision, no clock, no network, no
// randomness, float64 arithmetic only, so two runs on the same bars give the
// same orders byte for byte.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const LOOKBACK_BARS = 8;
const EMA_SPAN = 8;
/** A fill more than 1% past the close it was decided on is refused, not chased. */
const MAX_SLIPPAGE_BPS = 100;

/** One EMA: the closes it has seen until it starts, then its value. */
interface Ema {
  span: number;
  warm: number[];
  value: number | null;
}

const closes: number[] = [];
const ema: Ema = { span: EMA_SPAN, warm: [], value: null };
/** Peak value of the open position, in quote units; resets when flat. */
let peakValue = 0n;

function stepEma(close: number): void {
  if (ema.value !== null) {
    ema.value += (2 / (ema.span + 1)) * (close - ema.value);
    return;
  }
  ema.warm.push(close);
  if (ema.warm.length === ema.span) {
    ema.value = ema.warm.reduce((a, x) => a + x, 0) / ema.span;
  }
}

/** True once the bot holds a position in this symbol. */
function holding(state: BarsState, symbol: string): boolean {
  const held = state.positions.get(symbol);
  return held !== undefined && held.qty > 0n;
}

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) {
      closes.push(Number(bar.c));
      stepEma(Number(bar.c));
    }
    if (state.warmingUp) return [];
    const symbol = 'CBBTC';
    const { caps, fees } = state.hello;
    if (holding(state, symbol)) {
      const held = state.positions.get(symbol)!;
      const value = state.value(symbol, held.qty);
      if (value > peakValue) peakValue = value;
      if (value * 10000n <= peakValue * 9500n) {
        return [{ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    peakValue = 0n;
    if (closes.length < LOOKBACK_BARS + 1 || ema.value === null) return [];
    const latest = closes[closes.length - 1]!;
    const eightAgo = closes[closes.length - 1 - LOOKBACK_BARS]!;
    if (!(latest > eightAgo && latest > ema.value)) return [];
    // Buy with all cash, capped by the weight room (100% of equity here).
    const room = state.weightRoom(symbol);
    let notional = state.cash < room ? state.cash : room;
    if (notional < BigInt(fees.min_notional_quote_units)) return [];
    const orders: (BuyInput | SellInput)[] = [];
    orders.push({ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
    return orders.slice(0, caps.max_orders_per_bar);
  },
});
