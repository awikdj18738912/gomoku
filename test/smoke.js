/* 冒烟测试：验证核心逻辑与 AI 决策（node test/smoke.js） */
'use strict';

global.window = global;
require('../js/game.js');
require('../js/ai.js');

const { GomokuGame, BOARD_SIZE, BLACK, WHITE, EMPTY } = global.GomokuGame;
const { getBestMove } = global.GomokuAI;

let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  ✔ ' + msg);
  } else {
    console.error('  ✘ ' + msg);
    failed++;
  }
}

console.log('1) 横向五连获胜');
{
  const g = new GomokuGame();
  for (let c = 0; c < 4; c++) {
    assert(g.place(7, c) !== null, '黑方落子 (7,' + c + ')');
    assert(g.place(8, c + 1) !== null, '白方落子 (8,' + (c + 1) + ')');
  }
  assert(g.place(7, 4) !== null, '黑方落下第五子');
  assert(g.winner === BLACK, '黑方横五获胜');
  assert(g.winningLine && g.winningLine.line.length >= 5, '记录获胜连线');
}

console.log('2) 斜向五连与悔棋');
{
  const g = new GomokuGame();
  // 白方沿 (1,0)-(5,4) 斜五连，黑方分散落子
  g.place(7, 7);    // 黑
  g.place(1, 0);    // 白
  g.place(8, 8);    // 黑
  g.place(2, 1);    // 白
  g.place(9, 9);    // 黑
  g.place(3, 2);    // 白
  g.place(10, 10);  // 黑
  g.place(4, 3);    // 白
  g.place(0, 0);    // 黑（非制胜）
  g.place(5, 4);    // 白 → 斜五连
  assert(g.winner === WHITE, '白方斜五获胜');
  const n = g.undo(2);
  assert(n === 2, '悔棋 2 手成功');
  assert(g.winner === null, '悔棋后清除胜负状态');
  assert(g.board[5][4] === EMPTY && g.board[0][0] === EMPTY, '悔棋后棋盘恢复');
  assert(g.moves.length === 8, '落子记录正确回退');
}

console.log('3) AI 空棋盘先走天元');
{
  const g = new GomokuGame();
  const mv = getBestMove(g.board, BLACK, WHITE);
  assert(mv.row === 7 && mv.col === 7, 'AI 先手走天元 (7,7)，实际 (' + mv.row + ',' + mv.col + ')');
}

console.log('4) AI 把握制胜手');
{
  const g = new GomokuGame();
  g.place(7, 0);   // 黑
  g.place(0, 14);  // 白
  g.place(7, 1);   // 黑
  g.place(0, 13);  // 白
  g.place(7, 2);   // 黑
  g.place(0, 12);  // 白
  g.place(7, 3);   // 黑 → 黑四连，轮到黑
  const mv = getBestMove(g.board, BLACK, WHITE);
  assert(mv.row === 7 && mv.col === 4, 'AI 应走出制胜一手 (7,4)，实际 (' + mv.row + ',' + mv.col + ')');
}

console.log('5) AI 必须堵截对手连五');
{
  const g = new GomokuGame();
  g.place(0, 0);  // 黑
  g.place(7, 1);  // 白
  g.place(1, 0);  // 黑
  g.place(7, 2);  // 白
  g.place(2, 0);  // 黑
  g.place(7, 3);  // 白
  g.place(3, 1);  // 黑（不形成制胜）
  g.place(7, 4);  // 白 → 白四连，轮到黑
  const mv = getBestMove(g.board, BLACK, WHITE);
  assert(mv.row === 7 && (mv.col === 0 || mv.col === 5), 'AI 应堵截白方连五，实际 (' + mv.row + ',' + mv.col + ')');
}

console.log('6) 棋盘填满必有终局');
{
  const g = new GomokuGame();
  let moves = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (g.winner !== null) break;
      g.place(r, c);
      moves++;
    }
  }
  assert(g.winner !== null, '棋盘填满后必有胜负或平局（共 ' + moves + ' 手）');
}

console.log('7) AI 自对弈稳定性');
{
  const g = new GomokuGame();
  let safe = true;
  for (let i = 0; i < 120 && g.winner === null; i++) {
    const mv1 = getBestMove(g.board, BLACK, WHITE);
    if (!g.place(mv1.row, mv1.col)) { safe = false; break; }
    if (g.winner !== null) break;
    const mv2 = getBestMove(g.board, WHITE, BLACK);
    if (!g.place(mv2.row, mv2.col)) { safe = false; break; }
  }
  assert(safe, 'AI 自对弈过程无异常落子');
  assert(g.winner !== null, 'AI 自对弈能分出胜负（胜者=' + g.winner + '，共 ' + g.moves.length + ' 手）');
}

console.log('8) 非法落子被拒绝');
{
  const g = new GomokuGame();
  g.place(7, 7);
  assert(g.place(7, 7) === null, '重复落子被拒绝');
  assert(g.place(-1, 0) === null, '越界落子被拒绝');
  assert(g.place(99, 99) === null, '超界落子被拒绝');
}

if (failed > 0) {
  console.error('\n共 ' + failed + ' 个用例失败');
  process.exit(1);
}
console.log('\n全部用例通过 ✅');
