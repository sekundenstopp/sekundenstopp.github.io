document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.querySelector('.site-nav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      siteNav.classList.toggle('is-open');
    });

    siteNav.addEventListener('click', (event) => {
      if (event.target instanceof HTMLAnchorElement && window.matchMedia('(max-width: 880px)').matches) {
        navToggle.setAttribute('aria-expanded', 'false');
        siteNav.classList.remove('is-open');
      }
    });
  }

  const yearNode = document.querySelector('[data-year]');
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  const canvas = document.getElementById('game-canvas');
  const overlay = document.querySelector('[data-game-overlay]');
  const scoreNode = document.querySelector('[data-score]');
  const highScoreNode = document.querySelector('[data-high-score]');
  const stateNode = document.querySelector('[data-state]');
  const controlButtons = document.querySelectorAll('[data-action]');
  const directionButtons = document.querySelectorAll('[data-direction]');

  if (!canvas || !window.TetrisGame) {
    return;
  }

  const game = new window.TetrisGame({
    canvas,
    overlay,
    scoreNode,
    highScoreNode,
    stateNode,
  });

  controlButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      if (action === 'start') game.start();
      if (action === 'pause') game.togglePause();
      if (action === 'restart') game.restart();
      if (action === 'rotate') game.rotate();
    });
  });

  directionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const direction = button.getAttribute('data-direction');
      if (direction) {
        game.setDirection(direction);
      }
    });
  });

  game.attachKeyboard();
  game.draw();
});
