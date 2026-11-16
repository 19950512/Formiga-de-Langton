const test = require('node:test');
const assert = require('node:assert/strict');
const { Ant, parseRule } = require('./langton.js');

test('primeiros passos seguem a regra clássica RL', () => {
  const ant = new Ant();
  ant.step();
  assert.deepEqual([ant.x, ant.y, ant.dir], [1, 0, 1]);
  assert.equal(ant.colorAt(0, 0), 1);

  ant.run(3);
  assert.deepEqual([ant.x, ant.y, ant.dir], [0, 0, 0]);
  assert.equal(ant.cells.size, 4);

  ant.step();
  assert.deepEqual([ant.x, ant.y, ant.dir], [-1, 0, 3]);
  assert.equal(ant.colorAt(0, 0), 0);
  assert.equal(ant.cells.size, 3);
});

test('forEachCell devolve as coordenadas certas, inclusive negativas', () => {
  const ant = new Ant();
  ant.run(500);
  const seen = [];
  ant.forEachCell((x, y, c) => seen.push([x, y, c]));
  assert.equal(seen.length, ant.cells.size);
  for (const [x, y, c] of seen) assert.equal(ant.colorAt(x, y), c);
  assert.ok(seen.some(([x, y]) => x < 0 || y < 0));
});

test('depois de ~10 mil passos a formiga constrói a "estrada" (período 104, desloca 2 células na diagonal)', () => {
  const ant = new Ant();
  ant.run(11000);
  const a = { x: ant.x, y: ant.y, dir: ant.dir };
  const windowA = [];
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) windowA.push(ant.colorAt(a.x + dx, a.y + dy));

  ant.run(104);
  assert.equal(Math.abs(ant.x - a.x), 2);
  assert.equal(Math.abs(ant.y - a.y), 2);
  assert.equal(ant.dir, a.dir);

  const windowB = [];
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) windowB.push(ant.colorAt(ant.x + dx, ant.y + dy));
  assert.deepEqual(windowB, windowA);
});

test('regras com mais cores alternam as cores em ciclo', () => {
  const ant = new Ant('LLRR');
  assert.equal(ant.turns.length, 4);
  ant.run(1000);
  ant.forEachCell((_x, _y, c) => assert.ok(c >= 1 && c <= 3));
});

test('regra inválida é rejeitada', () => {
  assert.throws(() => parseRule('R'));
  assert.throws(() => parseRule('RX'));
  assert.deepEqual(parseRule(' rl '), [1, 3]);
});

test('reset limpa o estado', () => {
  const ant = new Ant();
  ant.run(200);
  ant.reset();
  assert.deepEqual([ant.x, ant.y, ant.dir, ant.steps, ant.cells.size], [0, 0, 0, 0, 0]);
});

test('back() desfaz passos exatamente (as regras são reversíveis)', () => {
  for (const rule of ['RL', 'LLRR', 'RLR']) {
    const ant = new Ant(rule);
    ant.run(5000);
    const snap = new Map(ant.cells);
    const pos = [ant.x, ant.y, ant.dir];
    ant.run(3000);
    assert.equal(ant.runBack(3000), 3000);
    assert.deepEqual([ant.x, ant.y, ant.dir], pos);
    assert.deepEqual(ant.cells, snap);
    ant.runBack(5000);
    assert.deepEqual([ant.x, ant.y, ant.dir, ant.steps, ant.cells.size], [0, 0, 0, 0, 0]);
    assert.equal(ant.back(), false);
  }
});

test('detectPeriod: nada antes da estrada, estrada de período 104 iniciando no passo 9977', () => {
  const ant = new Ant('RL');
  while (ant.steps < 9977) {
    ant.run(25);
    assert.equal(ant.detectPeriod(), null, `falso positivo no passo ${ant.steps}`);
  }
  ant.run(2000);
  assert.deepEqual(ant.detectPeriod(), { period: 104, dx: -2, dy: 2, start: 9977 });
});

test('obstáculo na frente da estrada interrompe o ciclo', () => {
  const ant = new Ant('RL');
  ant.run(12000);
  assert.ok(ant.detectPeriod());
  const bx = ant.x - 20, by = ant.y + 20;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ant.setCell(bx + dx, by + dy, 1);
  ant.run(1500);
  assert.equal(ant.detectPeriod(), null);
});

test('setCell pinta, apaga e amplia os limites', () => {
  const ant = new Ant();
  ant.setCell(10, -7, 1);
  assert.equal(ant.colorAt(10, -7), 1);
  assert.deepEqual([ant.maxX, ant.minY], [10, -7]);
  ant.setCell(10, -7, 0);
  assert.equal(ant.cells.size, 0);
});
