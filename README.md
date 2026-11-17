# btc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Kroco365/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Kroco365/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

**Dawn Rider** — a patient BTC trading bot for the [make.fun bounty "Race a BTC trading bot live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261117-0603). It trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute on-chain prices, starting with $1,000 of paper money.

## Strategy

On 1-minute bars the noise (about 6 bps per minute) is large next to the cost of a full round trip (about 37 bps at full size), so strategies that trade often bleed to death on the dev window — the kit's own EMA-cross baseline loses $106 there. Dawn Rider therefore trades at most a few times:

- **Entry:** buys with all cash the first time the latest close is above the close 8 bars ago *and* above its own 8-bar EMA — a short up-move confirmed by the trend the last 8 minutes built.
- **Hold:** then holds to the end of the window. No chasing, no re-entry on noise, no selling into dips.
- **Disaster stop:** the one exception — if the position ever falls 5% from its peak value, it sells everything. This never fires on the dev window and only caps a real crash on the unseen race window.

Deterministic: only bar closes feed the decision — no clock, no network, no randomness — so two runs on the same bars produce the same orders.

## Local dev grade

Graded with the kit's own CLI (`node cli/makefun.mjs grade-local --kit . --bot . --driver process`):

- **Net PnL: +$3.22 USDC** on the frozen 24-hour dev window (passes the dev gate, net PnL > $0)
- 1 trade, max drawdown 2.1% (guardrail: ≤ 25%), fees $0.80
- Net PnL at 2x fees: +$2.42 — still positive
- Two executions reproduce byte for byte

## Files

- `main.ts` — the bot (Node 22, stdlib only)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bars-replay SDK shim
