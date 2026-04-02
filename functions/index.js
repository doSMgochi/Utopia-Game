"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

function getSheetsConfig() {
  const config = functions.config() || {};
  const sheets = config.sheets || {};
  return {
    sheetId: sheets.id,
    clientEmail: sheets.client_email,
    privateKey: sheets.private_key ? sheets.private_key.replace(/\\n/g, "\n") : "",
    tabName: sheets.tab || "Sheet1"
  };
}

function getSheetsClient() {
  const { sheetId, clientEmail, privateKey, tabName } = getSheetsConfig();
  if (!sheetId || !clientEmail || !privateKey) {
    throw new Error("Missing sheets config. Run firebase functions:config:set sheets.*");
  }

  const { google } = require("googleapis");
  const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ["https://www.googleapis.com/auth/spreadsheets"]
  );
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, sheetId, tabName };
}

function isTesterAuth(data) {
  const auth = (data && data.auth !== undefined) ? String(data.auth) : "";
  return auth.toLowerCase() === "tester";
}

async function syncUsersToSheet() {
  const snap = await admin.firestore().collection("users").get();
  const rows = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (isTesterAuth(data)) return;
    const nick = data.nickname || doc.id || "";
    const majNick = data.majNick || "";
    const seed = typeof data.seed === "number" ? data.seed : 0;
    if (nick) rows.push({ nick, majNick, seed });
  });
  rows.sort((a, b) => {
    if (b.seed !== a.seed) return b.seed - a.seed;
    return String(a.nick).localeCompare(String(b.nick));
  });

  // [확인 1] B열 닉네임, C열 작혼 닉네임, D열 시드
  const values = rows.map((r) => [r.nick, r.majNick, r.seed]);

  const { sheets, sheetId, tabName } = getSheetsClient();
  
  // [디버깅] 여기에 B7이라고 썼는지 확실히 하기 위해 로그를 남깁니다.
  const targetRange = `${tabName}!B7`; 
  console.log(`[DEBUG] Updating sheet: ${sheetId}, range: ${targetRange}, FirstRow: ${JSON.stringify(values[0])}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: targetRange, // 변수로 넣어서 실수 방지
    valueInputOption: "RAW",
    requestBody: { values }
  });
}

async function seedShopItems() {
  const items = [
    { order: 1, name: "\uC2EC\uC7A5", price: 2000, sellPrice: 1000 },
    { order: 2, name: "\uC704", price: 1500, sellPrice: 1000 },
    { order: 3, name: "\uC18C\uC7A5", price: 1500, sellPrice: 1000 },
    { order: 4, name: "\uB300\uC7A5", price: 1500, sellPrice: 1000 },
    { order: 5, name: "\uCDE8\uC7A5", price: 1500, sellPrice: 1000 },
    { order: 6, name: "\uAC04", price: 2000, sellPrice: 1000 },
    { order: 7, name: "\uD3D0", price: 3000, sellPrice: 800, bundleSize: 2 },
    { order: 8, name: "\uCF69\uD314", price: 2500, sellPrice: 700, bundleSize: 2 },
    { order: 9, name: "\uC774\uC8FC\uAD8C", price: 20000, sellPrice: 15000, maxPerUser: 1, trackBuyer: true, buyers: [] },
    { order: 10, name: "\uD3EC\uC7A5\uC9C0", price: 300, noSell: true },
    { order: 11, name: "\uAC70\uC808\uAD8C", price: 100, noSell: true },
    { order: 12, name: "\uACB0\uD22C\uC7A5", price: 800, sellPrice: 800 },
    { order: 13, name: "\uD2B9\uC218 \uC791\uD0C1 \uC774\uC6A9\uAD8C", price: 400, sellPrice: 400 },
    { order: 14, name: "\uB3C4\uC6D0\uD5A5 \uC785\uC0AC \uC2E0\uCCAD\uC11C", price: 1000, noSell: true },
    { order: 15, name: "\uB3C4\uC6D0\uD5A5 \uD638\uD154\uD300\uC7A5 \uC785\uC0AC \uCD94\uCC9C\uC11C", price: 3000, noSell: true, maxPerUser: 1, remaining: 1 },
    { order: 16, name: "\uB3C4\uC6D0\uD5A5 \uBCF4\uC548\uD300\uC7A5 \uC785\uC0AC \uCD94\uCC9C\uC11C", price: 3000, noSell: true, maxPerUser: 1, remaining: 1 },
    { order: 17, name: "\uB3C4\uC6D0\uD5A5 \uC758\uB8CC\uD300\uC7A5 \uC785\uC0AC \uCD94\uCC9C\uC11C", price: 3000, noSell: true, maxPerUser: 1, remaining: 1 },
    { order: 18, name: "\uB3C4\uC6D0\uD5A5 \uC5D4\uC9C0\uB2C8\uC5B4\uD300\uC7A5 \uC785\uC0AC \uCD94\uCC9C\uC11C", price: 3000, noSell: true, maxPerUser: 1, remaining: 1 },
    { order: 19, name: "\uC2DD\uAD8C", price: 100, sellPrice: 5 }
  ];

  const db = admin.firestore();
  const batch = db.batch();
  items.forEach((item) => {
    const ref = db.collection("shop").doc(item.name);
    const payload = {
      name: item.name,
      desc: "",
      price: item.price,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "Tester",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (typeof item.sellPrice === "number") payload.sellPrice = item.sellPrice;
    if (typeof item.order === "number") payload.order = item.order;
    if (item.bundleSize) payload.bundleSize = item.bundleSize;
    if (item.maxPerUser) payload.maxPerUser = item.maxPerUser;
    if (item.trackBuyer) payload.trackBuyer = true;
    if (Array.isArray(item.buyers)) payload.buyers = item.buyers;
    if (item.noSell) payload.noSell = true;
    if (typeof item.remaining === "number") payload.remaining = item.remaining;
    if (typeof item.remaining !== "number") payload.unlimited = true;
    batch.set(ref, payload, { merge: true });
  });
  await batch.commit();
}

async function seedGachaItems() {
  const items = [];
  const add = (name, remaining, opts = {}) => {
    items.push({
      name: name.trim(),
      remaining,
      desc: opts.desc || "",
      rewardChips: opts.rewardChips || 0
    });
  };

  [
    "백호 인형",
    "윤설 인형",
    "슈란 인형",
    "무진 인형",
    "강림 인형",
    "강백서 인형",
    "견미진 인형",
    "노라 인형",
    "닥터 아이 인형",
    "라이어 인형",
    "류신오 인형",
    "리 샤오린 인형",
    "린다 인형",
    "메이사 인형",
    "미하일 인형",
    "백 연 인형",
    "사기리 인형",
    "사다마츠 치카게 인형",
    "상아 인형",
    "성양 인형",
    "수이 인형",
    "시왕 인형",
    "온유 인형",
    "왕싱 인형",
    "위련 인형",
    "이에시키 하쿠 인형",
    "카코 인형",
    "쿠로 인형",
    "한무연 인형",
    "한우리 인형",
    "호타루 인형",
    "곰 인형",
    "슬픈 토끼 인형",
    "행복한 쿼카 인형"
  ].forEach((name) => add(name, 5));

  [
    "바니걸",
    "메이드복",
    "프릴이 잔뜩 달린 잠옷",
    "속옷(화려한)",
    "속옷(민무늬)",
    "속옷(티팬티)",
    "속옷(체크무늬)",
    "속옷(땡땡이 무늬)",
    "동물 잠옷",
    "대형견용 목줄",
    "소형견용 목줄",
    "대형견용 입마개",
    "소형견용 입마개",
    "하네스",
    "한복",
    "치파오",
    "기모노",
    "고급스러운 정장",
    "동물 머리띠와 꼬리 세트",
    "팔찌",
    "반지",
    "귀걸이"
  ].forEach((name) => add(name, 5));

  [
    "딱딱한 빵",
    "촉촉한 빵",
    "초콜릿",
    "막대사탕",
    "슈크림",
    "에스프레소",
    "에너지 음료",
    "핫도그",
    "피쉬앤칩스",
    "정어리파이",
    "취두부",
    "커피쿠키",
    "식혜",
    "삶은계란",
    "탄산음료",
    "치킨랩",
    "정체불명의 고기"
  ].forEach((name) => add(name, 5));

  [
    "밀짚",
    "누군가의 머리카락",
    "가짜 칩",
    "마술용 트럼프 카드",
    "6만 있는 주사위",
    "수갑",
    "밧줄",
    "열쇠",
    "루비",
    "사파이어",
    "다이아",
    "비취",
    "박제된 안구",
    "박제된 뇌",
    "박제된 성대",
    "박제된 쓸개",
    "안드로이드 부품 A",
    "안드로이드 부품 B",
    "안드로이드 부품 C",
    "안드로이드 부품 D",
    "찢겨진 페이지 A",
    "찢겨진 페이지 B",
    "찢겨진 페이지 C",
    "찢겨진 페이지 D",
    "칠면조",
    "향신료",
    "감자",
    "당근",
    "아스파라거스",
    "컵케익",
    "당근라페",
    "스콘",
    "푸딩",
    "샌드위치",
    "피 묻은 러브레터",
    "누군가의 첫사랑 사진",
    "행운의 편지",
    "눈물젖은 손수건",
    "파란색 화살표"
  ].forEach((name) => add(name, 5));

  add("24시간 노예 계약서", 5, { desc: "상호 동의하에 사용할 수 있다." });
  add("이벤트 도박 개설권포장지", 5);
  add("빨간 구두", 5, {
    desc: "어쩐지 춤을 추고싶은 기분이다! *해당 캐릭터는 30분간 춤을 추게 되는 상태 이상에 걸리게 됩니다."
  });

  [
    "야광으로 빛나는 바나나 장난감(무해)",
    "야광으로 빛나는 바나나 장난감(유해)",
    "무지개로 빛나는 바나나 장난감(무해)",
    "살아 있는 송충이",
    "살아 있는 파리지옥",
    "애완용 돌",
    "성경",
    "염주",
    "십자가",
    "목탁",
    "담배",
    "전자 담배"
  ].forEach((name) => add(name, 5));

  add("100칩", 5, { rewardChips: 100 });
  add("500칩", 1, { rewardChips: 500 });

  [
    "포장지",
    "거절권",
    "결투장",
    "특수 작탁 이용권"
  ].forEach((name) => add(name, 20));

  [
    "먼지",
    "머리카락",
    "구겨진 영수증",
    "부서진 연필",
    "다 쓴 볼펜",
    "이면지",
    "휴지 한 장",
    "볼트",
    "나사",
    "모래",
    "텅 빈 과자봉지",
    "부서진 샤프심",
    "끊어진 고무줄",
    "말라비틀어진 물티슈 한 장",
    "다 쓴 인공눈물",
    "톱밥"
  ].forEach((name) => add(name, 40));

  const db = admin.firestore();
  const batch = db.batch();
  const nameCounts = new Map();

  items.forEach((item) => {
    const base = item.name;
    const count = (nameCounts.get(base) || 0) + 1;
    nameCounts.set(base, count);
    const docId = count === 1 ? base : `${base}__${count}`;
    const ref = db.collection("gacha").doc(docId);
    const payload = {
      name: item.name,
      desc: item.desc || "",
      price: 0,
      remaining: item.remaining,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "Seeder",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (item.rewardChips > 0) payload.rewardChips = item.rewardChips;
    batch.set(ref, payload, { merge: true });
  });

  await batch.commit();
}

async function syncItemsToSheet() {
  const snap = await admin.firestore().collection("users").get();
  const rows = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (isTesterAuth(data)) return;
    const nick = data.nickname || doc.id || "";
    const items = Array.isArray(data.items) ? data.items : [];
    const auth = data.auth === "admin" ? 0 : 1;
    const stripItemDesc = (value) => {
      const trimmed = String(value || "").trim();
      const match = trimmed.match(/^(.+?)\s*\(.*\)$/);
      return match ? match[1].trim() : trimmed;
    };
    const itemText = items.map((x) => {
      if (typeof x === "string") return stripItemDesc(x);
      if (x && typeof x === "object") {
        const name = x.name || x.itemName || "";
        return stripItemDesc(name);
      }
      return "";
    }).filter((v) => v).join(", ");
    if (nick) rows.push({ nick, itemText, auth });
  });
  rows.sort((a, b) => {
    if (a.auth !== b.auth) return a.auth - b.auth;
    return String(a.nick).localeCompare(String(b.nick));
  });
  const values = rows.map((r) => [r.nick, r.itemText]);

  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "보유 소지품 목록!A4:B",
    valueInputOption: "RAW",
    requestBody: { values }
  });
}

async function syncEventsToSheet() {
  const snap = await admin.firestore().collection("event").get();
  const rows = [];
  const formatItemDelta = (delta) => {
    if (!delta) return "";
    if (typeof delta !== "object") return String(delta);
    const action = delta.action || "";
    const name = delta.itemName || "";
    const actionLabel = action === "add"
        ? "추가"
        : (action === "remove" ? "삭제" : action);
    const nameLabel = name || "";
    return `${actionLabel}:${nameLabel}`.trim();
  };
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const createdAt = data.createdAt && data.createdAt.toDate
        ? data.createdAt.toDate().getTime()
        : 0;
    const itemDelta = (data.itemDelta === null || data.itemDelta === undefined)
        ? ""
        : formatItemDelta(data.itemDelta);
    rows.push({
      actor: data.actorNickname || "",
      target: data.targetNickname || "",
      reason: data.reason || "",
      coinDelta: data.coinDelta ?? "",
      itemDelta: itemDelta,
      createdAt
    });
  });
  rows.sort((a, b) => a.createdAt - b.createdAt);
  const values = rows.map((r) => [r.actor, r.target, r.reason, r.coinDelta, r.itemDelta]);

  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "운영진 메뉴!A4:E",
    valueInputOption: "RAW",
    requestBody: { values }
  });
}

function formatKst(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function calcAccruedDue(loan, nowMs) {
  const createdAtMs = loan.createdAt && loan.createdAt.toDate
      ? loan.createdAt.toDate().getTime()
      : 0;
  if (!createdAtMs) return null;

  const rate = (typeof loan.ratePerHour === "number") ? loan.ratePerHour : 0.03;
  const hours = Math.floor((nowMs - createdAtMs) / 3600000);
  if (hours < 1) return null;

  const principal = Number(loan.principal ?? 0);
  const totalRepaid = Number(loan.totalRepaid ?? 0);
  const due = principal * Math.pow(1 + rate, hours) - totalRepaid;
  return {
    nextDue: Math.max(0, Math.round(due)),
    nextAccruedAtMs: createdAtMs + (hours * 3600000)
  };
}

async function syncLoansToSheet() {
  const snap = await admin.firestore().collection("loan").get();
  const rows = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    rows.push({
      borrower: data.borrower || "",
      principal: data.principal ?? "",
      totalRepaid: data.totalRepaid ?? 0,
      remainingDue: data.remainingDue ?? "",
      createdAt: data.createdAt || null
    });
  });
  rows.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
    const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
    return ta - tb;
  });
  const values = rows.map((r) => [
    r.borrower,
    r.principal,
    r.totalRepaid,
    r.remainingDue,
    formatKst(r.createdAt)
  ]);

  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "대출 현황!A4:E",
    valueInputOption: "RAW",
    requestBody: { values }
  });
}

exports.onUsersChanged = functions.firestore
    .document("users/{userId}")
    .onWrite(async () => {
      await syncUsersToSheet();
      await syncItemsToSheet();
    });

exports.syncUsersToSheet = functions.https.onRequest(async (req, res) => {
  try {
    await syncUsersToSheet();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});

exports.seedShopItems = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  try {
    await seedShopItems();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});

exports.seedGachaItems = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  try {
    await seedGachaItems();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});

exports.onEventsChanged = functions.firestore
    .document("event/{eventId}")
    .onWrite(async () => {
      await syncEventsToSheet();
    });

exports.syncEventsToSheet = functions.https.onRequest(async (req, res) => {
  try {
    await syncEventsToSheet();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});

exports.onLoansChanged = functions.firestore
    .document("loan/{loanId}")
    .onWrite(async () => {
      await syncLoansToSheet();
    });

exports.syncLoansToSheet = functions.https.onRequest(async (req, res) => {
  try {
    await syncLoansToSheet();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});

exports.syncItemsToSheet = functions.https.onRequest(async (req, res) => {
  try {
    await syncItemsToSheet();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});


exports.hourlySheetSync = functions.pubsub
    .schedule("every 1 hours")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
      await syncUsersToSheet();
      await syncItemsToSheet();
      await syncEventsToSheet();
      await syncLoansToSheet();
      return null;
    });

function tryParsePlayersField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  let raw = value;
  const MAX_DEPTH = 4;
  for (let attempt = 0; attempt < MAX_DEPTH; attempt++) {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") {
        raw = parsed;
        continue;
      }
      return [];
    } catch (err) {
      const preview = trimmed.slice(0, 120);
      console.warn("[refund] invalid players payload, parsing failed:", err, preview);
      return [];
    }
  }
  return [];
}

function collectRefundTargets(players, roundStatus) {
  if (!Array.isArray(players) || players.length === 0) return [];
  const targets = [];
  for (let idx = 0; idx < players.length; idx++) {
    const player = players[idx];
    if (!player || !player.nickname) continue;
    const serverProcessed = player.refundServerProcessed === true
        || String(player.refundServerProcessed || "").toLowerCase() === "true";
    if (serverProcessed) continue;
    const amount = Math.max(0, Number(player.refundApplied || 0));
    if (amount <= 0) continue;
    targets.push({ idx, nickname: player.nickname, amount });
  }
  return targets;
}

async function processRoundRefund(change, collectionPath, gameType) {
  const after = change.after;
  if (!after.exists) return null;
  const playersRaw = after.data().players;
  if (!playersRaw) return null;
  const parsedPlayers = tryParsePlayersField(playersRaw);
  const preliminary = collectRefundTargets(parsedPlayers, after.data().status);
  if (!preliminary.length) return null;

  const roundRef = admin.firestore().collection(collectionPath).doc(after.id);
  try {
    await admin.firestore().runTransaction(async (t) => {
      const docSnap = await t.get(roundRef);
      if (!docSnap.exists) return;
      const docData = docSnap.data();
      if (!docData) return;
      const status = docData.status || "";
      const players = tryParsePlayersField(docData.players);
      const targets = collectRefundTargets(players, status);
      if (!targets.length) return;
      const now = admin.firestore.Timestamp.now();
      const refundsForLog = [];

      const userRefs = {};
      const userSnaps = {};
      for (const target of targets) {
        userRefs[target.nickname] = admin.firestore().collection("users").doc(target.nickname);
        userSnaps[target.nickname] = await t.get(userRefs[target.nickname]);
      }

      for (const target of targets) {
        const player = players[target.idx];
        if (!player) continue;

        const userRef = userRefs[target.nickname];
        const userSnap = userSnaps[target.nickname];
        if (userSnap && userSnap.exists) {
          t.update(userRef, { seed: admin.firestore.FieldValue.increment(target.amount) });
        } else {
          t.set(userRef, { nickname: target.nickname, seed: target.amount }, { merge: true });
        }

        player.refundServerProcessed = true;
        player.refundProcessed = true;
        player.refundServerProcessedAt = now;
        player.refundServerSource = `auto-${gameType.toLowerCase()}`;
        player.refundApplied = 0;
        const remainingSeed = Number(player.seed || 0);
        player.seed = Math.max(0, remainingSeed - target.amount);

        refundsForLog.push({
          nickname: target.nickname,
          amount: target.amount
        });
      }

      t.update(roundRef, { players: JSON.stringify(players) });
      t.set(admin.firestore().collection("refund_logs").doc(), {
        roundId: after.id,
        collection: collectionPath,
        gameType,
        processedAt: now,
        refunds: refundsForLog
      });
    });
  } catch (err) {
    console.error("[refund] transaction failed:", err);
  }
  return null;
}

exports.onHFRoundRefund = functions.firestore
    .document("HF_rounds/{roundId}")
    .onWrite((change) => processRoundRefund(change, "HF_rounds", "HF"));

exports.onHDRoundRefund = functions.firestore
    .document("HD_rounds/{roundId}")
    .onWrite((change) => processRoundRefund(change, "HD_rounds", "HD"));

async function runAccrueLoanInterest() {
  const nowMs = Date.now();
  const snap = await admin.firestore()
      .collection("loan")
      .where("repaid", "==", false)
      .get();

  if (snap.empty) return;

  const batch = admin.firestore().batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (data.repaid) continue;
    const accrual = calcAccruedDue(data, nowMs);
    if (accrual === null) continue;

    batch.update(doc.ref, {
      remainingDue: accrual.nextDue,
      lastAccruedAt: admin.firestore.Timestamp.fromMillis(accrual.nextAccruedAtMs)
    });
    ops += 1;

    if (ops >= 400) {
      await batch.commit();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
}

exports.accrueLoanInterestNow = functions.https.onRequest(async (req, res) => {
  try {
    await runAccrueLoanInterest();
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send(String(err));
  }
});

exports.accrueLoanInterest = functions.pubsub
    .schedule("every 1 hours")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
      await runAccrueLoanInterest();
      return null;
    });
