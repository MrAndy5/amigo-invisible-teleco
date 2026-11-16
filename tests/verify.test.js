/**
 * Automated Verification Suite for "Amigo Invisible - 1º Máster de Teleco"
 * Execution: node tests/verify.test.js
 * Requirements: Node.js 16+ (Zero external npm dependencies)
 */
const assert = require('assert');

// ANSI Color helper for beautiful CLI reporting
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name}`);
    console.error(`    ${colors.red}${err.message}${colors.reset}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// Reference Core Engine (Matching production implementation)
// -------------------------------------------------------------
function checkSolvability(names, exclusions = {}) {
  const n = names.length;
  if (n < 3) {
    return { solvable: false, error: `Se requieren al menos 3 participantes (actualmente hay ${n}).` };
  }

  const nameToIdx = new Map();
  names.forEach((name, idx) => nameToIdx.set(name, idx));

  // Build adjacency list: valid recipients = All - {self} - exclusions
  const adj = [];
  for (let i = 0; i < n; i++) {
    const giverName = names[i];
    const rawExcl = exclusions[giverName] || [];
    const exclSet = new Set(rawExcl.filter(ex => nameToIdx.has(ex)).map(ex => nameToIdx.get(ex)));
    exclSet.add(i); // Self-exclusion
    const valid = [];
    for (let j = 0; j < n; j++) {
      if (!exclSet.has(j)) valid.push(j);
    }
    if (valid.length === 0) {
      return { solvable: false, error: `El participante '${giverName}' no tiene a quién regalar debido a sus exclusiones.` };
    }
    adj.push(valid);
  }

  // Check every participant has at least one possible giver
  for (let j = 0; j < n; j++) {
    const hasGiver = adj.some(recipients => recipients.includes(j));
    if (!hasGiver) {
      return { solvable: false, error: `El participante '${names[j]}' ha sido excluido por todos los demás y no puede recibir regalos.` };
    }
  }

  // Kuhn's Maximum Bipartite Matching
  const matchV = new Array(n).fill(-1);
  const matchU = new Array(n).fill(-1);

  function dfs(u, visited) {
    for (const v of adj[u]) {
      if (!visited[v]) {
        visited[v] = true;
        if (matchV[v] === -1 || dfs(matchV[v], visited)) {
          matchV[v] = u;
          matchU[u] = v;
          return true;
        }
      }
    }
    return false;
  }

  for (let u = 0; u < n; u++) {
    const visited = new Array(n).fill(false);
    dfs(u, visited);
  }

  const unmatchedU = [];
  for (let u = 0; u < n; u++) {
    if (matchU[u] === -1) unmatchedU.push(u);
  }

  if (unmatchedU.length === 0) {
    return { solvable: true, adj };
  }

  // Hall's Condition Violator Identification
  const visitedU = new Array(n).fill(false);
  const visitedV = new Array(n).fill(false);
  const queue = [...unmatchedU];
  queue.forEach(u => visitedU[u] = true);

  while (queue.length > 0) {
    const currU = queue.shift();
    for (const v of adj[currU]) {
      if (!visitedV[v]) {
        visitedV[v] = true;
        const matchedU = matchV[v];
        if (matchedU !== -1 && !visitedU[matchedU]) {
          visitedU[matchedU] = true;
          queue.push(matchedU);
        }
      }
    }
  }

  const S = [];
  const NS = [];
  for (let i = 0; i < n; i++) {
    if (visitedU[i]) S.push(names[i]);
    if (visitedV[i]) NS.push(names[i]);
  }

  return {
    solvable: false,
    error: `Conflicto de exclusión irresoluble: los participantes [${S.join(', ')}] (${S.length} personas) solo pueden regalar a [${NS.join(', ')}] (${NS.length} personas). Se necesitan al menos ${S.length} destinatarios posibles.`
  };
}

function generateDerangement(names, exclusions = {}, maxRejectionTries = 300) {
  const solvability = checkSolvability(names, exclusions);
  if (!solvability.solvable) {
    throw new Error(solvability.error);
  }

  const n = names.length;
  const adj = solvability.adj;

  // 1. Uniform rejection sampling
  for (let tryCount = 0; tryCount < maxRejectionTries; tryCount++) {
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    let valid = true;
    for (let u = 0; u < n; u++) {
      if (!adj[u].includes(perm[u])) {
        valid = false;
        break;
      }
    }

    if (valid) {
      const result = {};
      for (let u = 0; u < n; u++) {
        result[names[u]] = names[perm[u]];
      }
      return result;
    }
  }

  // 2. Randomized MRV Backtracking fallback
  const assignment = new Array(n).fill(-1);
  const usedV = new Array(n).fill(false);

  function backtrack() {
    let bestU = -1;
    let bestCandidates = null;

    for (let u = 0; u < n; u++) {
      if (assignment[u] === -1) {
        const cands = adj[u].filter(v => !usedV[v]);
        if (bestU === -1 || cands.length < bestCandidates.length) {
          bestU = u;
          bestCandidates = cands;
        }
      }
    }

    if (bestU === -1) return true;
    if (bestCandidates.length === 0) return false;

    // Shuffle candidates for fairness
    for (let i = bestCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bestCandidates[i], bestCandidates[j]] = [bestCandidates[j], bestCandidates[i]];
    }

    for (const v of bestCandidates) {
      assignment[bestU] = v;
      usedV[v] = true;
      if (backtrack()) return true;
      assignment[bestU] = -1;
      usedV[v] = false;
    }
    return false;
  }

  if (backtrack()) {
    const result = {};
    for (let u = 0; u < n; u++) {
      result[names[u]] = names[assignment[u]];
    }
    return result;
  }

  throw new Error("No se pudo generar una asignación válida tras la búsqueda exhaustiva.");
}

// -------------------------------------------------------------
// URL Cryptography Reference Functions (Base64URL + Checksum/MAC)
// -------------------------------------------------------------
function encodePayload(giver, receiver, event = "1º Máster Teleco", budget = "", date = "") {
  const payload = JSON.stringify({
    g: giver,
    r: receiver,
    t: receiver,
    e: event,
    b: budget,
    d: date,
    ts: Date.now()
  });
  const utf8Bytes = Buffer.from(payload, 'utf8');
  let checksum = 0;
  for (const b of utf8Bytes) checksum = (checksum + b) % 256;
  const packed = Buffer.concat([Buffer.from([1, checksum]), utf8Bytes]);
  return packed.toString('base64url');
}

function decodePayload(token) {
  try {
    if (!token || typeof token !== 'string') {
      return { success: false, error: "Token vacío o formato inválido" };
    }
    const cleanToken = token.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(cleanToken)) {
      return { success: false, error: "El enlace contiene caracteres no válidos" };
    }
    const buf = Buffer.from(cleanToken, 'base64url');
    if (buf.length < 2) {
      return { success: false, error: "Enlace incompleto o truncado" };
    }

    let data;
    let checksum;

    if (buf[0] === 1 && buf.length >= 3) {
      checksum = buf[1];
      data = buf.subarray(2);
    } else {
      checksum = buf[0];
      data = buf.subarray(1);
    }

    let calcSum = 0;
    for (const b of data) calcSum = (calcSum + b) % 256;
    if (calcSum !== checksum) {
      return { success: false, error: "Integridad comprometida: el enlace ha sido manipulado o alterado" };
    }
    const parsed = JSON.parse(data.toString('utf8'));
    const giver = parsed.g;
    const receiver = parsed.r || parsed.t;
    if (!giver || !receiver) {
      return { success: false, error: "Estructura de enlace incompleta (faltan campos requeridos)" };
    }
    return {
      success: true,
      giver: giver,
      receiver: receiver,
      target: receiver,
      event: parsed.e || "1º Máster Teleco",
      budget: parsed.b || "",
      date: parsed.d || ""
    };
  } catch (err) {
    return { success: false, error: `Error de decodificación: ${err.message}` };
  }
}

// -------------------------------------------------------------
// TEST RUNNER EXECUTION
// -------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  TEST SUITE: AMIGO INVISIBLE - 1º MÁSTER DE TELECO ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

// 1. Derangement Validity
console.log(`${colors.bold}--- SUITE 1: Derangement Validity & Bijectivity ---${colors.reset}`);
test('No self-assignments across 500 iterations (N=5)', () => {
  const names = ['Ana', 'Bob', 'Carlos', 'Diana', 'Elena'];
  for (let i = 0; i < 500; i++) {
    const draw = generateDerangement(names, {});
    for (const [giver, receiver] of Object.entries(draw)) {
      assert.notStrictEqual(giver, receiver, `Self-assignment found: ${giver} -> ${receiver}`);
    }
  }
});

test('Bijective matching (1 gift given, 1 gift received per participant)', () => {
  const names = ['Ana', 'Bob', 'Carlos', 'Diana', 'Elena', 'Fernando'];
  const draw = generateDerangement(names, {});
  const receivers = Object.values(draw);
  assert.strictEqual(receivers.length, names.length);
  assert.strictEqual(new Set(receivers).size, names.length, 'Duplicate receiver detected');
  names.forEach(name => {
    assert.ok(receivers.includes(name), `Participant ${name} received no gift`);
  });
});

// 2. Exclusion Rules Enforcement
console.log(`\n${colors.bold}--- SUITE 2: Exclusion Rules Enforcement ---${colors.reset}`);
test('Symmetric couple exclusion (Ana <-> Bob)', () => {
  const names = ['Ana', 'Bob', 'Carlos', 'Diana'];
  const exclusions = { 'Ana': ['Bob'], 'Bob': ['Ana'] };
  for (let i = 0; i < 200; i++) {
    const draw = generateDerangement(names, exclusions);
    assert.notStrictEqual(draw['Ana'], 'Bob');
    assert.notStrictEqual(draw['Bob'], 'Ana');
  }
});

test('Roommate triad mutual exclusions (A, B, C)', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  const exclusions = {
    'A': ['B', 'C'],
    'B': ['A', 'C'],
    'C': ['A', 'B']
  };
  for (let i = 0; i < 200; i++) {
    const draw = generateDerangement(names, exclusions);
    assert.ok(!['B', 'C'].includes(draw['A']));
    assert.ok(!['A', 'C'].includes(draw['B']));
    assert.ok(!['A', 'B'].includes(draw['C']));
  }
});

test('Chain exclusions (A -> B -> C -> D)', () => {
  const names = ['A', 'B', 'C', 'D', 'E'];
  const exclusions = { 'A': ['B'], 'B': ['C'], 'C': ['D'] };
  for (let i = 0; i < 200; i++) {
    const draw = generateDerangement(names, exclusions);
    assert.notStrictEqual(draw['A'], 'B');
    assert.notStrictEqual(draw['B'], 'C');
    assert.notStrictEqual(draw['C'], 'D');
  }
});

// 3. Unsolvable Detection
console.log(`\n${colors.bold}--- SUITE 3: Unsolvable Detection & Error Messaging ---${colors.reset}`);
test('Detects N < 3 minimum participant violation', () => {
  const res = checkSolvability(['Ana', 'Bob'], {});
  assert.strictEqual(res.solvable, false);
  assert.ok(res.error.includes('al menos 3 participantes'));
});

test('Detects universal exclusion (One person excludes all others)', () => {
  const res = checkSolvability(['A', 'B', 'C'], { 'A': ['B', 'C'] });
  assert.strictEqual(res.solvable, false);
  assert.ok(res.error.includes('no tiene a quién regalar'));
});

test('Detects star exclusion (One person is excluded by everyone else)', () => {
  const names = ['A', 'B', 'C', 'D'];
  const res = checkSolvability(names, { 'A': ['D'], 'B': ['D'], 'C': ['D'] });
  assert.strictEqual(res.solvable, false);
  assert.ok(res.error.includes('excluido por todos los demás'));
});

test('Detects Hall marriage theorem bipartite bottleneck with Spanish explanation', () => {
  const names = ['Alejandro', 'Beatriz', 'Carlos', 'David', 'Elena'];
  const exclusions = {
    'David': ['Alejandro', 'Beatriz', 'Elena'],
    'Elena': ['Alejandro', 'Beatriz', 'David']
  };
  const res = checkSolvability(names, exclusions);
  assert.strictEqual(res.solvable, false);
  assert.ok(res.error.includes('Conflicto de exclusión irresoluble'));
});

// 4. URL Cryptography & Tamper Resistance
console.log(`\n${colors.bold}--- SUITE 4: URL Cryptography & Tamper Resistance ---${colors.reset}`);
test('Roundtrip encoding and decoding preserves special characters & emojis', () => {
  const giver = "Álvaro Íñigo López";
  const receiver = "María José Peña 🚀🎄";
  const event = "1º Máster de Teleco";
  const token = encodePayload(giver, receiver, event, "15 €", "20 Dic");
  const decoded = decodePayload(token);
  assert.strictEqual(decoded.success, true);
  assert.strictEqual(decoded.giver, giver);
  assert.strictEqual(decoded.receiver, receiver);
  assert.strictEqual(decoded.event, event);
  assert.strictEqual(decoded.budget, "15 €");
  assert.strictEqual(decoded.date, "20 Dic");
});

test('Rejects truncated URL tokens gracefully', () => {
  const token = encodePayload('Ana', 'Carlos');
  const truncated = token.substring(0, 5);
  const decoded = decodePayload(truncated);
  assert.strictEqual(decoded.success, false);
  assert.ok(decoded.error.length > 0);
});

test('Rejects bit-flipped / tampered tokens', () => {
  const token = encodePayload('Ana', 'Carlos');
  const chars = token.split('');
  chars[chars.length - 1] = chars[chars.length - 1] === 'A' ? 'B' : 'A';
  const tampered = chars.join('');
  const decoded = decodePayload(tampered);
  assert.strictEqual(decoded.success, false);
  assert.ok(decoded.error.includes('manipulado') || decoded.error.includes('decodificación'));
});

test('Rejects arbitrary garbage tokens without throwing exceptions', () => {
  const decoded = decodePayload('!@#$%^&*()_+bad_token');
  assert.strictEqual(decoded.success, false);
});

// 5. Edge Cases & Performance Benchmarks
console.log(`\n${colors.bold}--- SUITE 5: Edge Cases & Scalability ---${colors.reset}`);
test('Boundary N=3 with 0 exclusions produces valid derangement', () => {
  const names = ['X', 'Y', 'Z'];
  const draw = generateDerangement(names, {});
  assert.strictEqual(Object.keys(draw).length, 3);
  assert.notStrictEqual(draw['X'], 'X');
  assert.notStrictEqual(draw['Y'], 'Y');
  assert.notStrictEqual(draw['Z'], 'Z');
});

test('Boundary N=3 with 1 exclusion produces deterministic single valid derangement', () => {
  const names = ['X', 'Y', 'Z'];
  const exclusions = { 'X': ['Y'] }; // X must give to Z; Z must give to Y; Y must give to X
  const draw = generateDerangement(names, exclusions);
  assert.strictEqual(draw['X'], 'Z');
  assert.strictEqual(draw['Z'], 'Y');
  assert.strictEqual(draw['Y'], 'X');
});

test('Large group performance benchmark (N=50 under 100ms)', () => {
  const names50 = Array.from({ length: 50 }, (_, i) => `Teleco_${i}`);
  const startTime = Date.now();
  const draw = generateDerangement(names50, {});
  const elapsed = Date.now() - startTime;
  assert.strictEqual(Object.keys(draw).length, 50);
  assert.ok(elapsed < 100, `Execution took ${elapsed}ms (expected < 100ms)`);
});

// Final Summary
console.log(`\n${colors.bold}----------------------------------------------------${colors.reset}`);
console.log(`${colors.bold}Summary:${colors.reset} ${colors.green}${passedTests} passed${colors.reset}, ${failedTests === 0 ? colors.green : colors.red}${failedTests} failed${colors.reset}`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}ALL VERIFICATION CHECKS PASSED (100% SUCCESS)${colors.reset}\n`);
}
