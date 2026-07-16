(function (globalFactory) {
  const exported = globalFactory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  if (typeof window !== 'undefined') {
    window.SnakeGame = exported.SnakeGame;
  }
})(function () {
  const STORAGE_KEY = 'sekundenstopp.snake.highScore';
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  class SnakeGame {
    constructor({ canvas, overlay, scoreNode, highScoreNode, stateNode, storage } = {}) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.overlay = overlay || null;
      this.scoreNode = scoreNode || null;
      this.highScoreNode = highScoreNode || null;
      this.stateNode = stateNode || null;
      this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : null);

      this.boardSize = 24;
      this.tileSize = 24;
      this.timer = null;
      this.enemyTimer = null;
      this.resizeTimer = null;
      this.gameState = 'ready';
      this.score = 0;
      this.highScore = this.loadHighScore();
      this.snake = [];
      this.direction = DIRECTIONS.right;
      this.pendingDirection = DIRECTIONS.right;
      this.food = { x: 0, y: 0 };
      this.enemy = { x: 0, y: 0 };
      this.enemyDirection = DIRECTIONS.left;
      this.enemyStepCountdown = 2;
      this.tickInterval = 110;

      this.handleResize = this.handleResize.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleVisibility = this.handleVisibility.bind(this);

      this.init();
    }

    init() {
      this.resetBoard();
      this.updateHud();
      this.bindGlobalListeners();
      this.draw();
    }

    bindGlobalListeners() {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.handleResize);
        document.addEventListener('keydown', this.handleKeydown);
        document.addEventListener('visibilitychange', this.handleVisibility);
      }
      this.handleResize();
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
        const size = Math.max(280, Math.floor(Math.min(rect.width || 0, rect.height || rect.width || 0) || 0));
        const fallback = Math.floor(this.canvas.clientWidth || 720);
        const target = size || fallback;
        const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;

        this.canvas.width = Math.floor(target * dpr);
        this.canvas.height = Math.floor(target * dpr);
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.tileSize = Math.floor(target / this.boardSize);
        this.draw();
      }, 20);
    }

    handleVisibility() {
      if (typeof document !== 'undefined' && document.hidden && this.gameState === 'playing') {
        this.pause();
      }
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
        // Ignore storage failures in fallback environments.
      }
    }

    resetBoard() {
      const mid = Math.floor(this.boardSize / 2);
      this.snake = [
        { x: mid - 2, y: mid },
        { x: mid - 1, y: mid },
        { x: mid, y: mid },
      ];
      this.direction = DIRECTIONS.right;
      this.pendingDirection = DIRECTIONS.right;
      this.score = 0;
      this.gameState = 'ready';
      this.enemyStepCountdown = 2;
      this.spawnFood();
      this.spawnEnemy();
      this.updateHud();
      this.toggleOverlay(false);
      this.clearTimers();
    }

    clearTimers() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (this.enemyTimer) {
        clearInterval(this.enemyTimer);
        this.enemyTimer = null;
      }
    }

    isOpposite(next, current) {
      return next.x + current.x === 0 && next.y + current.y === 0;
    }

    setDirection(value) {
      const next = typeof value === 'string' ? DIRECTIONS[value.toLowerCase()] : value;
      if (!next) return;
      if (this.isOpposite(next, this.direction) && this.snake.length > 1) {
        return;
      }
      this.pendingDirection = next;
      if (this.gameState === 'ready') {
        this.start();
      } else if (this.gameState === 'paused') {
        this.resume();
      }
    }

    attachKeyboard() {
      return true;
    }

    handleKeydown(event) {
      const key = event.key.toLowerCase();
      const map = {
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
      };

      if (map[key]) {
        event.preventDefault();
        this.setDirection(map[key]);
        return;
      }

      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
        this.togglePause();
        return;
      }

      if (key === 'enter') {
        event.preventDefault();
        if (this.gameState === 'gameover') {
          this.restart();
        } else if (this.gameState === 'ready') {
          this.start();
        }
      }

      if (key === 'r') {
        event.preventDefault();
        this.restart();
      }
    }

    start() {
      if (this.gameState === 'playing') {
        return;
      }
      if (this.gameState === 'gameover') {
        this.resetBoard();
      }
      this.gameState = 'playing';
      this.updateHud();
      this.toggleOverlay(false);
      this.startTimers();
      this.draw();
    }

    resume() {
      if (this.gameState !== 'paused') {
        return;
      }
      this.gameState = 'playing';
      this.updateHud();
      this.toggleOverlay(false);
      this.startTimers();
      this.draw();
    }

    pause() {
      if (this.gameState !== 'playing') {
        return;
      }
      this.gameState = 'paused';
      this.updateHud();
      this.clearTimers();
      this.draw();
    }

    togglePause() {
      if (this.gameState === 'playing') {
        this.pause();
        return;
      }
      if (this.gameState === 'paused') {
        this.resume();
        return;
      }
      if (this.gameState === 'ready') {
        this.start();
      } else if (this.gameState === 'gameover') {
        this.restart();
      }
    }

    restart() {
      this.resetBoard();
      this.start();
    }

    startTimers() {
      if (this.timer) {
        return;
      }
      this.timer = setInterval(() => this.tick(), this.tickInterval);
    }

    tick() {
      if (this.gameState !== 'playing') {
        return;
      }
      this.direction = this.pendingDirection;
      const head = this.snake[this.snake.length - 1];
      const nextHead = {
        x: head.x + this.direction.x,
        y: head.y + this.direction.y,
      };

      if (this.isOutOfBounds(nextHead) || this.hitsBody(nextHead)) {
        this.gameOver();
        return;
      }

      this.snake.push(nextHead);
      let ateFood = false;
      if (this.sameCell(nextHead, this.food)) {
        ateFood = true;
        this.score += 10;
        this.spawnFood();
        this.spawnEnemy(true);
      } else {
        this.snake.shift();
      }

      this.moveEnemy();

      if (this.sameCell(nextHead, this.enemy)) {
        this.gameOver();
        return;
      }

      if (this.sameCell(this.enemy, this.food)) {
        this.spawnFood();
      }

      if (ateFood) {
        this.enemyStepCountdown = Math.max(1, this.enemyStepCountdown - 1);
      }

      this.updateHud();
      this.draw();
    }

    moveEnemy() {
      this.enemyStepCountdown -= 1;
      if (this.enemyStepCountdown > 0) {
        return;
      }
      this.enemyStepCountdown = 2;
      const options = Object.values(DIRECTIONS)
        .map((direction) => ({
          x: this.enemy.x + direction.x,
          y: this.enemy.y + direction.y,
          direction,
        }))
        .filter((option) => !this.isOutOfBounds(option));

      if (options.length === 0) {
        return;
      }

      const choice = options[Math.floor(Math.random() * options.length)];
      this.enemy = { x: choice.x, y: choice.y };
      this.enemyDirection = choice.direction;
    }

    spawnFood() {
      let candidate = this.randomCell();
      let guard = 0;
      while (this.occupied(candidate) && guard < 400) {
        candidate = this.randomCell();
        guard += 1;
      }
      this.food = candidate;
    }

    spawnEnemy(forceRandom = false) {
      let candidate = forceRandom ? this.randomEdgeCell() : this.randomCell();
      let guard = 0;
      while (this.occupied(candidate) && guard < 400) {
        candidate = this.randomCell();
        guard += 1;
      }
      this.enemy = candidate;
      this.enemyDirection = Object.values(DIRECTIONS)[Math.floor(Math.random() * 4)];
    }

    randomCell() {
      return {
        x: Math.floor(Math.random() * this.boardSize),
        y: Math.floor(Math.random() * this.boardSize),
      };
    }

    randomEdgeCell() {
      const edge = Math.floor(Math.random() * 4);
      const max = this.boardSize - 1;
      if (edge === 0) return { x: 0, y: Math.floor(Math.random() * this.boardSize) };
      if (edge === 1) return { x: max, y: Math.floor(Math.random() * this.boardSize) };
      if (edge === 2) return { x: Math.floor(Math.random() * this.boardSize), y: 0 };
      return { x: Math.floor(Math.random() * this.boardSize), y: max };
    }

    occupied(cell) {
      return this.snake.some((segment) => this.sameCell(segment, cell)) ||
        this.sameCell(this.food, cell) ||
        this.sameCell(this.enemy, cell);
    }

    isOutOfBounds(cell) {
      return cell.x < 0 || cell.y < 0 || cell.x >= this.boardSize || cell.y >= this.boardSize;
    }

    hitsBody(cell) {
      return this.snake.some((segment) => this.sameCell(segment, cell));
    }

    sameCell(a, b) {
      return Boolean(a && b && a.x === b.x && a.y === b.y);
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

    toggleOverlay(show) {
      if (!this.overlay) {
        return;
      }
      this.overlay.hidden = !show;
    }

    gameOver() {
      this.gameState = 'gameover';
      this.clearTimers();
      this.toggleOverlay(true);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
      }
      this.updateHud();
      this.draw();
    }

    draw() {
      if (!this.ctx || !this.canvas) {
        return;
      }

      const width = this.canvas.clientWidth || 720;
      const height = this.canvas.clientHeight || 720;
      const tile = Math.max(10, Math.floor(Math.min(width, height) / this.boardSize));
      const boardSize = tile * this.boardSize;
      const offsetX = Math.floor((width - boardSize) / 2);
      const offsetY = Math.floor((height - boardSize) / 2);
      const ctx = this.ctx;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#111812';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(offsetX, offsetY);

      this.drawGrid(ctx, tile);
      this.drawFood(ctx, tile);
      this.drawEnemy(ctx, tile);
      this.drawSnake(ctx, tile);

      ctx.restore();

      if (this.gameState === 'paused') {
        this.drawLabel('Paused', 'Press Space or Pause to continue', width, height);
      } else if (this.gameState === 'ready') {
        this.drawLabel('Ready', 'Press Start, Enter, or a direction key', width, height);
      }
    }

    drawGrid(ctx, tile) {
      for (let row = 0; row < this.boardSize; row += 1) {
        for (let col = 0; col < this.boardSize; col += 1) {
          const isOdd = (row + col) % 2 === 0;
          ctx.fillStyle = isOdd ? '#192219' : '#152015';
          ctx.fillRect(col * tile, row * tile, tile, tile);
        }
      }
    }

    drawSnake(ctx, tile) {
      this.snake.forEach((segment, index) => {
        ctx.fillStyle = index === this.snake.length - 1 ? '#c4e98a' : '#7fb75b';
        this.roundRect(ctx, segment.x * tile + 1, segment.y * tile + 1, tile - 2, tile - 2, 4);
        ctx.fill();
      });
    }

    drawFood(ctx, tile) {
      ctx.fillStyle = '#ffb055';
      this.roundRect(ctx, this.food.x * tile + 2, this.food.y * tile + 2, tile - 4, tile - 4, 5);
      ctx.fill();
    }

    drawEnemy(ctx, tile) {
      ctx.fillStyle = '#bd7cff';
      this.roundRect(ctx, this.enemy.x * tile + 1, this.enemy.y * tile + 1, tile - 2, tile - 2, 4);
      ctx.fill();
    }

    drawLabel(title, copy, width, height) {
      if (!this.ctx) {
        return;
      }
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#edf3e8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 36px "Segoe UI", sans-serif';
      ctx.fillText(title, width / 2, height / 2 - 18);
      ctx.font = '500 18px "Segoe UI", sans-serif';
      ctx.fillStyle = '#b6c3b0';
      ctx.fillText(copy, width / 2, height / 2 + 20);
      ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        return;
      }
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    getSnapshot() {
      return {
        score: this.score,
        highScore: this.highScore,
        state: this.gameState,
        snakeLength: this.snake.length,
        food: { ...this.food },
        enemy: { ...this.enemy },
      };
    }
  }

  return { SnakeGame, DIRECTIONS };
});
