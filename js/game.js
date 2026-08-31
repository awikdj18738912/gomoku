/* 五子棋核心逻辑：棋盘、落子、胜负判定、悔棋 */
(function (global) {
  'use strict';

  const BOARD_SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  class GomokuGame {
    constructor() {
      this.reset();
    }

    reset() {
      this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
      this.currentPlayer = BLACK;
      this.moves = [];
      this.winner = null;      // null=进行中, 0=平局, 1=黑胜, 2=白胜
      this.winningLine = null; // 获胜连线
      this.lastMove = null;
    }

    inBounds(r, c) {
      return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }

    place(row, col) {
      if (this.winner !== null) return null;
      if (!this.inBounds(row, col)) return null;
      if (this.board[row][col] !== EMPTY) return null;

      this.board[row][col] = this.currentPlayer;
      const move = { row, col, player: this.currentPlayer };
      this.moves.push(move);
      this.lastMove = move;

      const win = this.checkWin(row, col);
      if (win) {
        this.winner = this.currentPlayer;
        this.winningLine = win;
        return move;
      }
      if (this.moves.length === BOARD_SIZE * BOARD_SIZE) {
        this.winner = 0;
        return move;
      }
      this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
      return move;
    }

    undo(steps = 1) {
      let removed = 0;
      while (removed < steps && this.moves.length > 0) {
        const last = this.moves.pop();
        this.board[last.row][last.col] = EMPTY;
        this.currentPlayer = last.player;
        removed++;
      }
      this.winner = null;
      this.winningLine = null;
      this.lastMove = this.moves.length ? this.moves[this.moves.length - 1] : null;
      return removed;
    }

    checkWin(row, col) {
      const player = this.board[row][col];
      for (const [dr, dc] of DIRECTIONS) {
        const line = [{ row, col }];
        let count = 1;
        for (const sign of [1, -1]) {
          let r = row + dr * sign;
          let c = col + dc * sign;
          while (this.inBounds(r, c) && this.board[r][c] === player) {
            line.push({ row: r, col: c });
            count++;
            r += dr * sign;
            c += dc * sign;
          }
        }
        if (count >= 5) return { player, line, count };
      }
      return null;
    }
  }

  global.GomokuGame = { GomokuGame, BOARD_SIZE, EMPTY, BLACK, WHITE };
})(window);
