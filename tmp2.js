const playersRaw = '[{"nickname":"t1","seed":200,"ready":false,"lastActive":1770754283138,"walletBeforeBuyIn":20000,"totalBet":4,"splitCards":[],"splitPending":false,"hasSplit":false,"splitHands":[],"splitHistory":[],"roundReturn":0,"roundNet":0,"cards":["4C","4S"],"currentBet":4,"isFolded":false,"hasActed":false,"position":0,"refundApplied":200,"refundProcessed":true,"refundServerProcessed":false,"refundServerSource":"auto-endgame"},{"nickname":"t2","seed":200,"ready":true,"lastActive":1770754281973,"walletBeforeBuyIn":20000,"totalBet":2,"splitCards":[],"splitPending":false,"hasSplit":false,"splitHands":[],"splitHistory":[],"roundReturn":0,"roundNet":0,"cards":["10D","5D"],"currentBet":2,"isFolded":true,"hasActed":true,"position":1,"refundApplied":200,"refundProcessed":true,"refundServerProcessed":false,"refundServerSource":"auto-endgame"}]';
function tryParsePlayersField(value) {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return JSON.parse(value || "[]") || [];
    } catch (err) {
      console.warn("invalid players payload", err);
      return [];
    }
  }
  if (Array.isArray(value)) return value;
  return [];
}
function collectRefundTargets(players, roundStatus) {
  if (!Array.isArray(players) || players.length === 0) return [];
  const finishedStatus = String(roundStatus || "").toLowerCase() === "finished";
  const targets = [];
  for (let idx = 0; idx < players.length; idx++) {
    const player = players[idx];
    if (!player || !player.nickname) continue;
    if (player.refundServerProcessed === true) continue;
    let amount = Number(player.refundApplied || 0);
    if (amount <= 0 && finishedStatus) {
      const stack = Number(player.seed || 0);
      if (stack > 0 && player.refundProcessed !== true) {
        amount = stack;
      }
    }
    amount = Math.max(0, amount);
    if (amount <= 0) continue;
    targets.push({ idx, nickname: player.nickname, amount });
  }
  return targets;
}
const players = tryParsePlayersField(playersRaw);
console.log(collectRefundTargets(players, "finished"));
