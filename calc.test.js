// 용도: calc.js 계산 로직 검증 (손으로 계산한 예시 판과 비교)
// 사용법: node calc.test.js
const C = require('./calc.js');
const R = C.DEFAULT_RULES;
const blank = { gwang: 0, bigwang: false, yeol: 0, godori: false, tti: 0, hongdan: false, cheongdan: false, chodan: false, pi: 0, go: 0, shake: 0, pibak: false, gwangbak: false, gobak: false };
const hand = (o) => Object.assign({}, blank, o);

let fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? '통과' : '실패') + ' | ' + name + ' | 결과 ' + got + (ok ? '' : ' (기대 ' + want + ')'));
}
const pts = (o, rules, streak) => C.scoreRound(hand(o), rules || R, streak || 0).points;

check('삼광 3 + 홍단 3 + 피10장 1 = 7점', pts({ gwang: 3, tti: 3, hongdan: true, pi: 10 }), 7);
check('비광 포함 삼광은 2점', pts({ gwang: 3, bigwang: true }), 2);
check('사광 4점', pts({ gwang: 4 }), 4);
check('오광 15점에 광박 2배 = 30점', pts({ gwang: 5, gwangbak: true }), 30);
check('열끗 7장 3 + 고도리 5 = 8점, 멍따 2배 = 16점', pts({ yeol: 7, godori: true }), 16);
check('멍따 끄면 8점', pts({ yeol: 7, godori: true }, Object.assign({}, R, { meongtta: false })), 8);
check('띠 6장 2 + 청단 3 + 초단 3 = 8점', pts({ tti: 6, cheongdan: true, chodan: true }), 8);
check('피 15장 6 + 띠 5장 1 = 7점, 피박 2배 = 14점', pts({ pi: 15, tti: 5, pibak: true }), 14);
check('피 점수가 없으면 피박 무시', pts({ gwang: 5, pi: 9, pibak: true }), 15);
check('광 점수가 없으면 광박 무시', pts({ pi: 16, gwang: 2, gwangbak: true }), 7);
check('7점에 1고 = 8점', pts({ gwang: 3, tti: 3, hongdan: true, pi: 10, go: 1 }), 8);
check('7점에 2고 = 9점', pts({ gwang: 3, tti: 3, hongdan: true, pi: 10, go: 2 }), 9);
check('7점에 3고 = (7+2)x2 = 18점', pts({ gwang: 3, tti: 3, hongdan: true, pi: 10, go: 3 }), 18);
check('7점에 4고 = (7+2)x4 = 36점', pts({ gwang: 3, tti: 3, hongdan: true, pi: 10, go: 4 }), 36);
check('흔들기 2회 = 4배', pts({ gwang: 4, pi: 12, shake: 2 }), 28);
check('고박 2배', pts({ gwang: 4, pi: 12, gobak: true }), 14);
check('나가리 1판 뒤 2배', pts({ gwang: 4, pi: 12 }, R, 1), 14);
check('나가리 2판 연속 뒤 4배', pts({ gwang: 4, pi: 12 }, R, 2), 28);
check('피박+광박+3고 겹침 = (4+6+2)x2x2x2 = 96점', pts({ gwang: 4, pi: 15, go: 3, pibak: true, gwangbak: true }), 96);

// 점수 바로 입력 방식
const direct = (o, rules, streak) => C.scoreRound(Object.assign({ direct: true, score: 0, go: 0, shake: 0 }, o), rules || R, streak || 0);
check('바로 입력 9점 = 9점', direct({ score: 9 }).points, 9);
check('바로 입력 9점 3고 = (9+2)x2 = 22점', direct({ score: 9, go: 3 }).points, 22);
check('바로 입력 7점 피박+광박+멍박+고박 = 7x16 = 112점', direct({ score: 7, pibak: true, gwangbak: true, meong: true, gobak: true }).points, 112);
check('바로 입력 멍박은 룰에서 끄면 무시', direct({ score: 7, meong: true }, Object.assign({}, R, { meongtta: false })).points, 7);
check('바로 입력 8점 흔들기 1회, 나가리 뒤 = 32점', direct({ score: 8, shake: 1 }, R, 1).points, 32);
check('바로 입력 5점은 날 수 없음', direct({ score: 5 }).canWin, false);
check('바로 입력 10점 금액 1,000원', direct({ score: 10 }).amount, 1000);

const low = C.scoreRound(hand({ gwang: 3, pi: 10 }), R, 0);
check('4점은 7점 미만이라 날 수 없음', low.canWin, false);

const capRules = Object.assign({}, R, { cap: 5000 });
const capped = C.scoreRound(hand({ gwang: 5, gwangbak: true, go: 3 }), capRules, 0);
check('상한 5,000원 적용 (원래 68점 6,800원)', capped.amount, 5000);
check('상한 적용 표시', capped.capped, true);

// 정산: A가 7점 승 -> 나가리 -> B가 7점 승(2배) -> A 첫뻑
const log = [
  Object.assign({ type: 'round', winner: 0 }, hand({ gwang: 4, pi: 12 })),
  { type: 'nagari' },
  Object.assign({ type: 'round', winner: 1 }, hand({ gwang: 4, pi: 12 })),
  { type: 'event', kind: 'ppuk1', to: 0 }
];
const s = C.settle(log, R);
check('정산 A: +700 -1400 +700 = 0원', s.balances[0], 0);
check('정산 손익 합계 0원', s.balances[0] + s.balances[1], 0);
const s2 = C.settle(log.slice(0, 2), R);
check('나가리 직후 다음 판 배수 예고 1', s2.nagariStreak, 1);
check('정산 A 첫 판 뒤 +700원', s2.balances[0], 700);

console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과');
process.exit(fail ? 1 : 0);
