// Exact sums of rupee amounts (2 decimals) in integer paise, so totals have no floating-point drift.
export const toPaise = (v) => Math.round(Number(v || 0) * 100);
export const fromPaise = (p) => p / 100;
