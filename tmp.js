const playersRaw = '[{"nickname":"t1","seed":200,"refundApplied":200,"refundProcessed":true,"refundServerProcessed":false},{"nickname":"t2","seed":200,"refundApplied":200,"refundProcessed":true,"refundServerProcessed":false}]';
const players = JSON.parse(playersRaw);
console.log(players.length);
console.log(players.map(p => p.refundApplied));
