// 용도: 맞고 점수·정산 계산 로직 (화면과 분리되어 있어 단독으로 검증 가능)
// 사용법: 브라우저에서는 GoStopCalc.scoreRound(판, 룰, 연속나가리수), GoStopCalc.settle(기록, 룰)
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
    meongtta: true,    // 열끗 7장 이상 2배
    gobak: true,       // 고박 2배
    nagariDouble: true,// 나가리 다음 판 2배
    bigwang2: true,    // 비광 포함 삼광은 2점
    cap: 0             // 판당 상한 금액(0 = 없음)
  };

  var EVENT_LABELS = {
    ppuk1: '첫뻑', ppuk2: '연뻑', ppuk3: '삼연뻑', ttadak: '첫따닥', chongtong: '총통'
  };

  // 한 판의 점수. r = 승자 패와 배수 입력, nagariStreak = 직전까지 연속된 나가리 수
  function scoreRound(r, rules, nagariStreak) {
    var items = [];

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

    var base = 0;
    for (var i = 0; i < items.length; i++) base += items[i].pts;

    // 고: 1고 +1점, 2고 +2점, 3고부터는 한 번마다 2배
    var go = r.go || 0;
    var goAdd = Math.min(go, 2);

    var mults = [];
    if (go >= 3) mults.push({ label: go + '고', x: Math.pow(2, go - 2) });
    if (r.shake > 0) mults.push({ label: '흔들기·폭탄 ' + r.shake + '회', x: Math.pow(2, r.shake) });
    if (rules.meongtta && r.yeol >= 7) mults.push({ label: '멍따', x: 2 });
    if (r.pibak && piPts > 0) mults.push({ label: '피박', x: 2 });
    if (r.gwangbak && gwangPts > 0) mults.push({ label: '광박', x: 2 });
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

  // 기록 전체를 훑어 누적 손익을 계산한다. 입력값만 저장하고 매번 다시 계산하므로 수정·삭제에 안전하다.
  // 기록 항목: {type:'round', winner:0|1, ...패 입력} | {type:'nagari'} | {type:'event', kind, to:0|1}
  function settle(log, rules) {
    var balances = [0, 0];
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
        var res = scoreRound(e, rules, rules.nagariDouble ? streak : 0);
        streak = 0;
        balances[e.winner] += res.amount;
        balances[1 - e.winner] -= res.amount;
        rows.push({ index: i, entry: e, roundNo: roundNo, result: res, amount: res.amount });
      } else if (e.type === 'event') {
        var amt = (rules[e.kind] || 0) * rules.pointValue;
        balances[e.to] += amt;
        balances[1 - e.to] -= amt;
        rows.push({ index: i, entry: e, amount: amt });
      }
    }
    return { balances: balances, rows: rows, nagariStreak: rules.nagariDouble ? streak : 0 };
  }

  var api = { DEFAULT_RULES: DEFAULT_RULES, EVENT_LABELS: EVENT_LABELS, scoreRound: scoreRound, settle: settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoStopCalc = api;
})(typeof window !== 'undefined' ? window : this);
