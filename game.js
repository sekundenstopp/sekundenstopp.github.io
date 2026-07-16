(function (globalFactory) {
  const exported = globalFactory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  if (typeof window !== 'undefined') {
    window.TetrisGame = exported.TetrisGame;
  }
})(function () {
  const STORAGE_KEY = 'sekundenstopp.tetris.highScore';
  const BOARD_WIDTH = 10;
  const BOARD_HEIGHT = 20;
  const BASE_DROP_INTERVAL = 650;
  const COLORS = {
    I: '#7ddcff',
    O: '#f8d86e',
    T: '#c58aff',
    S: '#72e69a',
    Z: '#ff8d8d',
    J: '#6fa7ff',
    L: '#ffb66f',
    ghost: 'rgba(255, 255, 255, 0.18)',
    grid: 'rgba(255, 255, 255, 0.05)',
  };

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    O: [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  };

  const PIECE_TYPES = Object.keys(SHAPES);

  function rotateMatrix(matrix) {
    const size = matrix.length;
    const rotated = Array.from({ length: size }, () => Array(size).fill(0));
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        rotated[x][size - 1 - y] = matrix[y][x];
      }
    }
    return rotated;
  }

  class TetrisGame {
    constructor({ canvas, overlay, scoreNode, highScoreNode, stateNode, storage } = {}) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.overlay = overlay || null;
      this.scoreNode = scoreNode || null;
      this.highScoreNode = highScoreNode || null;
      this.stateNode = stateNode || null;
      this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : null);

      this.board = this.createBoard();
      this.currentPiece = null;
      this.nextPiece = null;
      this.score = 0;
      this.lines = 0;
      this.highScore = this.loadHighScore();
      this.level = 1;
      this.gameState = 'ready';
      this.timer = null;
      this.resizeTimer = null;
      this.dropInterval = BASE_DROP_INTERVAL;
      this.dropAccumulator = 0;
      this.lastTimestamp = 0;

      this.handleResize = this.handleResize.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleVisibility = this.handleVisibility.bind(this);
      this.handleFrame = this.handleFrame.bind(this);

      this.init();
    }

    init() {
      this.resetGame();
      this.bindListeners();
      this.draw();
    }

    bindListeners() {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('keydown', this.handleKeydown);
        document.addEventListener('visibilitychange', this.handleVisibility);
      }
      this.handleResize();
    }

    createBoard() {
      return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
    }

    loadHighScore() {
      try {
        if (!this.storage) return 0;
        const value = Number(this.storage.getItem(STORAGE_KEY) || 0);
        return Number.isFinite(value) ? value : 0;
      } catch (_) {
        return 0;
      }
    }

    saveHighScore() {
      try {
        if (!this.storage) return;
        this.storage.setItem(STORAGE_KEY, String(this.highScore));
      } catch (_) {
        // Ignore storage failures in restricted environments.
      }
    }

    handleResize() {
      if (!this.canvas || !this.ctx) {
        return;
      }

      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }

      this.resizeTimer = setTimeout(() => {
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.max(240, Math.floor(rect.width || this.canvas.clientWidth || 360));
        const height = Math.max(440, Math.floor(rect.height || this.canvas.clientHeight || 720));
        const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
      }, 20);
    }

    handleVisibility() {
      if (typeof document !== 'undefined' && document.hidden && this.gameState === 'playing') {
        this.pause();
      }
    }

    handleFrame(timestamp) {
      if (this.gameState !== 'playing') {
        this.lastTimestamp = timestamp;
        return;
      }

      if (!this.lastTimestamp) {
        this.lastTimestamp = timestamp;
      }

      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      this.dropAccumulator += delta;

      while (this.dropAccumulator >= this.dropInterval) {
        this.dropAccumulator -= this.dropInterval;
        if (!this.stepDown()) {
          break;
        }
      }

      this.draw();

      if (typeof window !== 'undefined') {
        this.timer = window.requestAnimationFrame(this.handleFrame);
      }
    }

    resetGame() {
      this.board = this.createBoard();
      this.currentPiece = null;
      this.nextPiece = this.randomPiece();
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.dropInterval = BASE_DROP_INTERVAL;
      this.dropAccumulator = 0;
      this.lastTimestamp = 0;
      this.gameState = 'ready';
      this.clearTimer();
      this.spawnPiece();
      this.toggleOverlay(false);
      this.updateHud();
    }

    clearTimer() {
      if (this.timer && typeof window !== 'undefined') {
        window.cancelAnimationFrame(this.timer);
      }
      this.timer = null;
    }

    randomPiece() {
      const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
      const matrix = SHAPES[type].map((row) => row.slice());
      return {
        type,
        matrix,
        x: 0,
        y: 0,
      };
    }

    spawnPiece() {
      this.currentPiece = this.nextPiece || this.randomPiece();
      this.nextPiece = this.randomPiece();
      this.currentPiece.matrix = this.normalizeMatrix(this.currentPiece.matrix);
      this.currentPiece.x = Math.floor((BOARD_WIDTH - this.currentPiece.matrix.length) / 2);
      this.currentPiece.y = 0;

      if (this.collides(this.currentPiece)) {
        this.gameOver();
      }
    }

    normalizeMatrix(matrix) {
      const size = Math.max(matrix.length, matrix[0].length);
      const normalized = Array.from({ length: size }, () => Array(size).fill(0));
      for (let y = 0; y < matrix.length; y += 1) {
        for (let x = 0; x < matrix[y].length; x += 1) {
          normalized[y][x] = matrix[y][x];
        }
      }
      return normalized;
    }

    start() {
      if (this.gameState === 'playing') {
        return;
      }
      this.toggleOverlay(false);
      if (this.gameState === 'gameover') {
        this.resetGame();
      }
      this.gameState = 'playing';
      this.updateHud();
      this.toggleOverlay(false);
      this.dropAccumulator = 0;
      this.lastTimestamp = 0;
      this.clearTimer();
      if (typeof window !== 'undefined') {
        this.timer = window.requestAnimationFrame(this.handleFrame);
      }
      this.draw();
    }

    pause() {
      if (this.gameState !== 'playing') {
        return;
      }
      this.gameState = 'paused';
      this.updateHud();
      this.clearTimer();
      this.draw();
    }

    togglePause() {
      if (this.gameState === 'playing') {
        this.pause();
        return;
      }
      if (this.gameState === 'paused') {
        this.start();
        return;
      }
      if (this.gameState === 'ready') {
        this.start();
      } else if (this.gameState === 'gameover') {
        this.restart();
      }
    }

    restart() {
      this.toggleOverlay(false);
      this.resetGame();
      this.start();
    }

    attachKeyboard() {
      return true;
    }

    handleKeydown(event) {
      const key = event.key.toLowerCase();
      const keys = {
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
        arrowdown: 'down',
        s: 'down',
        arrowup: 'rotate',
        w: 'rotate',
        x: 'rotate',
      };

      if (keys[key]) {
        event.preventDefault();
        if (keys[key] === 'rotate') {
          this.rotate();
        } else {
          this.move(keys[key]);
        }
        return;
      }

      if (key === ' ' || key === 'spacebar' || key === 'p') {
        event.preventDefault();
        this.togglePause();
        return;
      }

      if (key === 'enter') {
        event.preventDefault();
        if (this.gameState === 'ready') {
          this.start();
        } else if (this.gameState === 'gameover') {
          this.restart();
        }
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        this.restart();
      }
    }

    move(direction) {
      if (this.gameState === 'ready') {
        this.start();
      }
      if (this.gameState !== 'playing') {
        return;
      }

      const offset = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
      const drop = direction === 'down' ? 1 : 0;
      const candidate = {
        ...this.currentPiece,
        x: this.currentPiece.x + offset,
        y: this.currentPiece.y + drop,
      };

      if (!this.collides(candidate)) {
        this.currentPiece = candidate;
        if (direction === 'down') {
          this.score += 1;
        }
        this.draw();
        this.updateHud();
      } else if (direction === 'down') {
        this.lockPiece();
      }
    }

    rotate() {
      if (this.gameState === 'ready') {
        this.start();
      }
      if (this.gameState !== 'playing') {
        return;
      }

      const rotated = {
        ...this.currentPiece,
        matrix: rotateMatrix(this.currentPiece.matrix),
      };
      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) {
        const candidate = { ...rotated, x: rotated.x + kick };
        if (!this.collides(candidate)) {
          this.currentPiece = candidate;
          this.draw();
          return;
        }
      }
    }

    hardDrop() {
      if (this.gameState === 'ready') {
        this.start();
      }
      if (this.gameState !== 'playing') {
        return;
      }

      let candidate = { ...this.currentPiece };
      while (!this.collides({ ...candidate, y: candidate.y + 1 })) {
        candidate.y += 1;
        this.score += 1;
      }
      this.currentPiece = candidate;
      this.lockPiece();
    }

    stepDown() {
      const candidate = { ...this.currentPiece, y: this.currentPiece.y + 1 };
      if (!this.collides(candidate)) {
        this.currentPiece = candidate;
        return true;
      }
      this.lockPiece();
      return false;
    }

    lockPiece() {
      this.mergePiece();
      const cleared = this.clearLines();
      if (cleared > 0) {
        this.lines += cleared;
        this.score += [0, 100, 300, 500, 800][cleared] * this.level;
        this.level = 1 + Math.floor(this.lines / 10);
        this.dropInterval = Math.max(120, BASE_DROP_INTERVAL - ((this.level - 1) * 45));
      }
      this.spawnPiece();
      this.updateHud();
      this.draw();
    }

    mergePiece() {
      const { currentPiece } = this;
      currentPiece.matrix.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (!cell) return;
          const boardY = currentPiece.y + y;
          const boardX = currentPiece.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            this.board[boardY][boardX] = currentPiece.type;
          }
        });
      });
    }

    clearLines() {
      let cleared = 0;
      this.board = this.board.filter((row) => {
        const full = row.every(Boolean);
        if (full) {
          cleared += 1;
        }
        return !full;
      });
      while (this.board.length < BOARD_HEIGHT) {
        this.board.unshift(Array(BOARD_WIDTH).fill(null));
      }
      return cleared;
    }

    collides(piece) {
      const { matrix, x: offsetX, y: offsetY } = piece;
      for (let y = 0; y < matrix.length; y += 1) {
        for (let x = 0; x < matrix[y].length; x += 1) {
          if (!matrix[y][x]) {
            continue;
          }
          const boardX = offsetX + x;
          const boardY = offsetY + y;
          if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
            return true;
          }
          if (boardY >= 0 && this.board[boardY][boardX]) {
            return true;
          }
        }
      }
      return false;
    }

    gameOver() {
      this.gameState = 'gameover';
      this.clearTimer();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
      }
      this.toggleOverlay(true);
      this.updateHud();
      this.draw();
    }

    toggleOverlay(show) {
      if (!this.overlay) {
        return;
      }
      this.overlay.hidden = !show;
      this.overlay.setAttribute('aria-hidden', String(!show));
    }

    updateHud() {
      if (this.scoreNode) {
        this.scoreNode.textContent = String(this.score);
      }
      if (this.highScoreNode) {
        this.highScoreNode.textContent = String(this.highScore);
      }
      if (this.stateNode) {
        const labels = {
          ready: 'Ready',
          playing: 'Playing',
          paused: 'Paused',
          gameover: 'Game Over',
        };
        this.stateNode.textContent = labels[this.gameState] || 'Ready';
      }
    }

    draw() {
      if (!this.ctx || !this.canvas) {
        return;
      }

      const width = this.canvas.clientWidth || 360;
      const height = this.canvas.clientHeight || 720;
      const tile = Math.floor(Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT));
      const boardWidth = tile * BOARD_WIDTH;
      const boardHeight = tile * BOARD_HEIGHT;
      const offsetX = Math.floor((width - boardWidth) / 2);
      const offsetY = Math.floor((height - boardHeight) / 2);
      const ctx = this.ctx;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, width, height);

      this.drawStars(ctx, width, height);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      this.drawGrid(ctx, tile);
      this.drawBoard(ctx, tile);
      this.drawGhost(ctx, tile);
      this.drawPiece(ctx, this.currentPiece, tile);
      ctx.restore();

      if (this.gameState === 'paused') {
        this.drawLabel('Paused', 'Press Space, P, or Pause to continue', width, height);
      } else if (this.gameState === 'ready') {
        this.drawLabel('Ready', 'Press Start, Enter, or a move key', width, height);
      } else if (this.gameState === 'gameover') {
        this.drawLabel('Game Over', 'Press Restart or Enter to try again', width, height);
      }
    }

    drawStars(ctx, width, height) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 24; i += 1) {
        const x = (i * 37) % width;
        const y = (i * 53) % height;
        ctx.beginPath();
        ctx.arc(x, y, i % 3 === 0 ? 1.2 : 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawGrid(ctx, tile) {
      for (let row = 0; row < BOARD_HEIGHT; row += 1) {
        for (let col = 0; col < BOARD_WIDTH; col += 1) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#121a2b' : '#0f1726';
          ctx.fillRect(col * tile, row * tile, tile, tile);
          ctx.strokeStyle = COLORS.grid;
          ctx.lineWidth = 1;
          ctx.strokeRect(col * tile, row * tile, tile, tile);
        }
      }
    }

    drawBoard(ctx, tile) {
      for (let y = 0; y < BOARD_HEIGHT; y += 1) {
        for (let x = 0; x < BOARD_WIDTH; x += 1) {
          const cell = this.board[y][x];
          if (!cell) continue;
          this.drawBlock(ctx, x, y, tile, COLORS[cell] || '#ffffff');
        }
      }
    }

    drawGhost(ctx, tile) {
      if (!this.currentPiece) {
        return;
      }
      let ghost = { ...this.currentPiece, y: this.currentPiece.y };
      while (!this.collides({ ...ghost, y: ghost.y + 1 })) {
        ghost = { ...ghost, y: ghost.y + 1 };
      }
      this.drawPiece(ctx, ghost, tile, COLORS.ghost, true);
    }

    drawPiece(ctx, piece, tile, overrideColor = null, isGhost = false) {
      if (!piece) {
        return;
      }
      piece.matrix.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (!cell) return;
          const color = overrideColor || COLORS[piece.type];
          this.drawBlock(ctx, piece.x + x, piece.y + y, tile, color, isGhost);
        });
      });
    }

    drawBlock(ctx, x, y, tile, color, isGhost = false) {
      const px = x * tile;
      const py = y * tile;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = isGhost ? 'transparent' : 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = isGhost ? 0 : 8;
      ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
      ctx.strokeStyle = isGhost ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
      ctx.restore();
    }

    drawLabel(title, copy, width, height) {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(3, 8, 20, 0.62)';
      ctx.fillRect(0, 0, width, height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f5fbff';
      ctx.font = '700 36px "Segoe UI", sans-serif';
      ctx.fillText(title, width / 2, height / 2 - 18);
      ctx.font = '500 18px "Segoe UI", sans-serif';
      ctx.fillStyle = '#d7e3f2';
      ctx.fillText(copy, width / 2, height / 2 + 20);
      ctx.restore();
    }

    getSnapshot() {
      return {
        score: this.score,
        lines: this.lines,
        highScore: this.highScore,
        state: this.gameState,
        board: this.board.map((row) => row.slice()),
        currentPiece: this.currentPiece ? {
          type: this.currentPiece.type,
          x: this.currentPiece.x,
          y: this.currentPiece.y,
        } : null,
      };
    }
  }

  return { TetrisGame };
});
