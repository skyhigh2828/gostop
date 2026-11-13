// 용도: 고스톱·맞고 점수·정산 계산 로직 (화면과 분리되어 있어 단독으로 검증 가능)
// 사용법: 브라우저에서는 GoStopCalc.scoreRound(판, 룰, 연속나가리수), GoStopCalc.settle(기록, 룰, 인원)
//         검증은 `node calc.test.js`
(function (root) {
  'use strict';

  // 점수 단위 항목(ppuk1 등)은 "몇 점 값"인지로 저장하고, 금액은 pointValue를 곱해 구한다.
  var DEFAULT_RULES = {
    pointValue: 100,   // 점당 금액(원)
    goalScore: 7,      // 날 수 있는 점수
    ppuk1: 7,          // 첫뻑
    ppuk2: 14,         // 연뻑
    ppuk3: 28,         // 삼연뻑
    ttadak: 7,         // 첫따닥
    chongtong: 7,      // 총통
    pibakLimit: 7,     // 피박 기준(패자 피가 이 장수 이하) - 안내 문구용
    gwangValue: 2,     // 4인 광팔기: 광 1장당 몇 점 값
    meongtta: true,    // 열끗 7장 이상 2배
    gobak: true,       // 고박
    nagariDouble: true,// 나가리 다음 판 2배
    bigwang2: true,    // 비광 포함 삼광은 2점
    cap: 0             // 한 사람이 한 판에 내는 상한 금액(0 = 없음)
  };

  // 인원에 따라 달라지는 기본값: 맞고는 7점 기준, 3인 이상은 3점 나기·피박 5장·첫뻑 5점
  function defaultsFor(n) {
    return n === 2
      ? { goalScore: 7, ppuk1: 7, ppuk2: 14, ppuk3: 28, ttadak: 7, chongtong: 7, pibakLimit: 7 }
      : { goalScore: 3, ppuk1: 5, ppuk2: 10, ppuk3: 20, ttadak: 5, chongtong: 10, pibakLimit: 5 };
  }

  var EVENT_LABELS = {
    ppuk1: '첫뻑', ppuk2: '연뻑', ppuk3: '삼연뻑', ttadak: '첫따닥', chongtong: '총통'
  };

  // 패자 한 명 기준의 점수. r = 승자 패(또는 바로 입력한 점수)와 그 패자의 박, nagariStreak = 직전까지 연속된 나가리 수
  function scoreRound(r, rules, nagariStreak) {
    var items = [];

    // 점수 바로 입력 방식: 손으로 센 패 점수(r.score)를 그대로 쓰고, 박은 체크한 대로 적용한다
    if (r.direct) return finish(r, rules, nagariStreak, r.score ? [{ label: '패 점수', pts: r.score }] : [], true, true, !!r.meong);

    var gwangPts = 0;
    if (r.gwang >= 5) gwangPts = 15;
    else if (r.gwang === 4) gwangPts = 4;
    else if (r.gwang === 3) gwangPts = (r.bigwang && rules.bigwang2) ? 2 : 3;
    if (gwangPts) {
      var gl = r.gwang >= 5 ? '오광' : r.gwang === 4 ? '사광' : (gwangPts === 2 ? '비광 포함 삼광' : '삼광');
      items.push({ label: gl, pts: gwangPts });
    }

    if (r.yeol >= 5) items.push({ label: '열끗 ' + r.yeol + '장', pts: r.yeol - 4 });
    if (r.godori) items.push({ label: '고도리', pts: 5 });

    if (r.tti >= 5) items.push({ label: '띠 ' + r.tti + '장', pts: r.tti - 4 });
    if (r.hongdan) items.push({ label: '홍단', pts: 3 });
    if (r.cheongdan) items.push({ label: '청단', pts: 3 });
    if (r.chodan) items.push({ label: '초단', pts: 3 });

    var piPts = r.pi >= 10 ? r.pi - 9 : 0;
    if (piPts) items.push({ label: '피 ' + r.pi + '장', pts: piPts });

    return finish(r, rules, nagariStreak, items, piPts > 0, gwangPts > 0, r.yeol >= 7);
  }

  // 패 점수 항목에 고·배수·상한을 적용해 최종 점수와 금액을 낸다
  function finish(r, rules, nagariStreak, items, canPibak, canGwangbak, meong) {
    var base = 0;
    for (var i = 0; i < items.length; i++) base += items[i].pts;

    // 고: 1고 +1점, 2고 +2점, 3고부터는 한 번마다 2배
    var go = r.go || 0;
    var goAdd = Math.min(go, 2);

    var mults = [];
    if (go >= 3) mults.push({ label: go + '고', x: Math.pow(2, go - 2) });
    if (r.shake > 0) mults.push({ label: '흔들기·폭탄 ' + r.shake + '회', x: Math.pow(2, r.shake) });
    if (rules.meongtta && meong) mults.push({ label: '멍박', x: 2 });
    if (r.pibak && canPibak) mults.push({ label: '피박', x: 2 });
    if (r.gwangbak && canGwangbak) mults.push({ label: '광박', x: 2 });
    if (r.gobak && rules.gobak) mults.push({ label: '고박', x: 2 });
    if (nagariStreak > 0) mults.push({ label: '나가리 ' + nagariStreak + '판 뒤', x: Math.pow(2, nagariStreak) });

    var mult = 1;
    for (var j = 0; j < mults.length; j++) mult *= mults[j].x;

    var points = (base + goAdd) * mult;
    var amount = points * rules.pointValue;
    var capped = rules.cap > 0 && amount > rules.cap;
    if (capped) amount = rules.cap;

    return {
      items: items, base: base, goAdd: goAdd, mults: mults, mult: mult,
      points: points, amount: amount, capped: capped,
      canWin: base >= rules.goalScore
    };
  }

  // 한 판에서 패자별로 낼 돈. e.losers = {번호: {pibak, gwangbak, gobak}}, e.sit = 쉬는 사람(4인)
  // 맞고(패자 1명)의 고박은 2배, 3인 이상의 고박은 다른 패자 몫까지 대신 낸다.
  function roundPays(e, rules, nagariStreak, n) {
    var losers = [];
    for (var i = 0; i < n; i++) if (i !== e.winner && i !== e.sit) losers.push(i);
    var solo = losers.length === 1;
    var pays = losers.map(function (i) {
      var f = e.losers ? (e.losers[i] || {}) : e; // losers가 없으면 예전(맞고 전용) 기록 형식
      var one = {};
      for (var k in e) one[k] = e[k];
      one.pibak = !!f.pibak; one.gwangbak = !!f.gwangbak; one.gobak = solo && !!f.gobak;
      var res = scoreRound(one, rules, nagariStreak);
      var tags = [];
      if (one.pibak && hasMult(res, '피박')) tags.push('피박');
      if (one.gwangbak && hasMult(res, '광박')) tags.push('광박');
      if (f.gobak && rules.gobak) tags.push('고박');
      return { from: i, points: res.points, amount: res.amount, capped: res.capped, res: res, tags: tags, gobak: !!f.gobak, coveredBy: null };
    });
    if (!solo && rules.gobak) {
      var g = null;
      pays.forEach(function (p) { if (p.gobak && !g) g = p; });
      if (g) pays.forEach(function (p) {
        if (p !== g) { g.amount += p.amount; p.amount = 0; p.coveredBy = g.from; }
      });
    }
    return pays;
  }
  function hasMult(res, label) {
    for (var i = 0; i < res.mults.length; i++) if (res.mults[i].label === label) return true;
    return false;
  }

  // 기록 전체를 훑어 누적 손익을 계산한다. 입력값만 저장하고 매번 다시 계산하므로 삭제에 안전하다.
  // 기록 항목: {type:'round', winner, sit, sold, losers, ...패 입력} | {type:'nagari'} | {type:'event', kind, to, from:[...]}
  function settle(log, rules, n) {
    n = n || 2;
    var balances = [];
    for (var b = 0; b < n; b++) balances.push(0);
    var rows = [];
    var streak = 0;
    var roundNo = 0;
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      if (e.type === 'nagari') {
        roundNo++; streak++;
        rows.push({ index: i, entry: e, roundNo: roundNo, amount: 0 });
      } else if (e.type === 'round') {
        roundNo++;
        var st = rules.nagariDouble ? streak : 0;
        var pays = roundPays(e, rules, st, n);
        streak = 0;
        var total = 0;
        pays.forEach(function (p) { balances[p.from] -= p.amount; total += p.amount; });
        balances[e.winner] += total;
        // 광값: 광 판 사람(쉬는 사람)이 그 판 승자에게서 받는다
        var gwangPay = 0;
        if (e.sit != null && e.sold > 0) {
          gwangPay = e.sold * rules.gwangValue * rules.pointValue;
          balances[e.sit] += gwangPay; balances[e.winner] -= gwangPay;
        }
        rows.push({ index: i, entry: e, roundNo: roundNo, pays: pays, common: commonOf(e, rules, st), amount: total, gwangPay: gwangPay });
      } else if (e.type === 'event') {
        var amt = (rules[e.kind] || 0) * rules.pointValue;
        var from = e.from;
        if (!from) { from = []; for (var k = 0; k < n; k++) if (k !== e.to) from.push(k); }
        from.forEach(function (f) { balances[f] -= amt; });
        balances[e.to] += amt * from.length;
        rows.push({ index: i, entry: e, amount: amt * from.length, each: amt, from: from });
      }
    }
    return { balances: balances, rows: rows, nagariStreak: rules.nagariDouble ? streak : 0 };
  }

  // 박을 뺀 공통 점수 내역 (화면 표시용)
  function commonOf(e, rules, nagariStreak) {
    var one = {};
    for (var k in e) one[k] = e[k];
    one.pibak = false; one.gwangbak = false; one.gobak = false;
    return scoreRound(one, rules, nagariStreak);
  }

  // 누적 손익을 "누가 누구에게 얼마"로 정리한다 (송금 횟수를 줄이는 방식)
  function transfers(balances) {
    var debt = [], cred = [];
    balances.forEach(function (v, i) { if (v < 0) debt.push({ i: i, v: -v }); else if (v > 0) cred.push({ i: i, v: v }); });
    debt.sort(function (a, b) { return b.v - a.v; });
    cred.sort(function (a, b) { return b.v - a.v; });
    var out = [], d = 0, c = 0;
    while (d < debt.length && c < cred.length) {
      var amt = Math.min(debt[d].v, cred[c].v);
      out.push({ from: debt[d].i, to: cred[c].i, amount: amt });
      debt[d].v -= amt; cred[c].v -= amt;
      if (debt[d].v === 0) d++;
      if (cred[c].v === 0) c++;
    }
    return out;
  }

  var api = {
    DEFAULT_RULES: DEFAULT_RULES, EVENT_LABELS: EVENT_LABELS, defaultsFor: defaultsFor,
    scoreRound: scoreRound, roundPays: roundPays, commonOf: commonOf, settle: settle, transfers: transfers
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoStopCalc = api;
})(typeof window !== 'undefined' ? window : this);
