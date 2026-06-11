const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

const UI = {
  time: document.getElementById("timeDisplay"),
  next: document.getElementById("nextDisplay"),
  stacks: document.getElementById("stackDisplay"),
  roleModal: document.getElementById("roleModal"),
  resultModal: document.getElementById("resultModal"),
  resultKicker: document.getElementById("resultKicker"),
  resultTitle: document.getElementById("resultTitle"),
  resultReason: document.getElementById("resultReason"),
  retry: document.getElementById("retryButton"),
  roleButtons: document.getElementById("roleButtons"),
  roleIcon: document.getElementById("roleIcon"),
  roleName: document.getElementById("roleName"),
  pairName: document.getElementById("pairName"),
  markBadge: document.getElementById("markBadge"),
  groupName: document.getElementById("groupName"),
  towerAssignment: document.getElementById("towerAssignment"),
  round: document.getElementById("roundDisplay"),
  timeline: document.getElementById("timeline"),
  speed: document.getElementById("speedSelect"),
  castBar: document.getElementById("castBar"),
  castName: document.getElementById("castName"),
  castFill: document.getElementById("castFill"),
  banner: document.getElementById("banner"),
};

const W = 800;
const ARENA = { x: 400, y: 400, r: 350 };
const BOSS = { x: 400, y: 400, r: 29 };
const TOWERS = [
  { x: 308, y: 503, r: 70, label: "塔1" },
  { x: 492, y: 503, r: 70, label: "塔2" },
];
const BOSS_OUTER_RING = 98;
const BOSS_INNER_RING = BOSS_OUTER_RING * 0.862;
const FIELD_MARKERS = [
  { label: "A", x: 400, y: 214, shape: "circle", color: "#d03c64" },
  { label: "2", x: 531, y: 269, shape: "square", color: "#cdc85d" },
  { label: "B", x: 586, y: 400, shape: "circle", color: "#cdc85d" },
  { label: "3", x: 531, y: 531, shape: "square", color: "#3473c3" },
  { label: "C", x: 400, y: 586, shape: "circle", color: "#3473c3" },
  { label: "4", x: 269, y: 531, shape: "square", color: "#b47bb7" },
  { label: "D", x: 214, y: 400, shape: "circle", color: "#b47bb7" },
  { label: "1", x: 269, y: 269, shape: "square", color: "#d03c64" },
];
const SPELL_RADII = {
  share: 87,
  circle: 72,
};
const FAN_LENGTH = 235;
const FAN_HALF_ANGLE = Math.PI / 4;
const PAST_FUTURE_RADIUS = SPELL_RADII.circle * 1.1;
const DIRECTION_LOCK_DISTANCE = 100;
const DIRECTION_LOCK_TOLERANCE = 82;
const DIRECTION_LOCK_HALF_ANGLE = 15 * Math.PI / 180;
const PLAYER_MOVE_SPEED = 100;
const NPC_ARRIVAL_MARGIN = 0.12;
const ROLES = [
  { id: "MT", pair: "ST", kind: "tank", category: "tank", color: "#3b8ded", icon: "assets/TankRole.png" },
  { id: "ST", pair: "MT", kind: "tank", category: "tank", color: "#3b8ded", icon: "assets/TankRole.png" },
  { id: "H1", pair: "H2", kind: "healer", category: "healer", color: "#43a06b", icon: "assets/HealerRole.png" },
  { id: "H2", pair: "H1", kind: "healer", category: "healer", color: "#43a06b", icon: "assets/HealerRole.png" },
  { id: "D1", pair: "D2", kind: "dps", category: "melee", color: "#e34f57", icon: "assets/DPSRole.png" },
  { id: "D2", pair: "D1", kind: "dps", category: "melee", color: "#e34f57", icon: "assets/DPSRole.png" },
  { id: "D3", pair: "D4", kind: "dps", category: "ranged", color: "#e34f57", icon: "assets/DPSRole.png" },
  { id: "D4", pair: "D3", kind: "dps", category: "ranged", color: "#e34f57", icon: "assets/DPSRole.png" },
];
const YARN_PAIRS = [["MT", "H1"], ["ST", "H2"], ["D1", "D3"], ["D2", "D4"]];
const GROUP_ROUNDS = { A: [1, 2, 3, 8], B: [4, 5, 6, 7] };
const TOWER_TIMES = [10, 20, 30, 40, 50, 60, 70, 80];
const TIMELINE_ITEMS = [
  [0, "ミッシング / 塔出現"],
  [10, "塔1回目"],
  [20, "塔2回目 + 過去/未来"],
  [30, "半面 + 塔3回目"],
  [40, "塔4回目 + 過去/未来"],
  [50, "半面 + 塔5回目"],
  [60, "塔6回目 + 過去/未来"],
  [70, "半面 + 塔7回目"],
  [80, "塔8回目 + 過去/未来"],
  [90, "最後の半面 / 終了"],
];
const MARK_LABEL = { share: "頭割り", fan: "扇", circle: "円" };
const TOWER_PRIORITY = ["healer", "tank", "melee", "ranged"];
const keys = new Set();
const query = new URLSearchParams(location.search);
const querySpeed = Number(query.get("speed"));
const autoplay = query.get("autoplay") === "1";

let state = {
  running: false,
  finished: false,
  time: 0,
  lastFrame: 0,
  playerId: null,
  players: [],
  resolvedTowers: new Set(),
  resolvedCircles: new Set(),
  resolvedLocks: new Set(),
  resolvedHalves: new Set(),
  spellEffects: [],
  pastFuture: {},
  pastFutureLocks: {},
  lastTowerResolvedAt: null,
  moveTarget: null,
  bannerUntil: 0,
};

if (querySpeed > 0) {
  if (![...UI.speed.options].some((option) => Number(option.value) === querySpeed)) {
    UI.speed.add(new Option(`${querySpeed}x`, String(querySpeed)));
  }
  UI.speed.value = String(querySpeed);
}

function roleById(id) {
  return ROLES.find((role) => role.id === id);
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createOpeningMarks() {
  const marks = {};
  const thSecondary = randomChoice(["fan", "circle"]);
  const dpsSecondary = thSecondary === "fan" ? "circle" : "fan";
  for (const [ids, secondary] of [
    [["MT", "ST", "H1", "H2"], thSecondary],
    [["D1", "D2", "D3", "D4"], dpsSecondary],
  ]) {
    for (const id of ids) marks[id] = secondary;
    marks[randomChoice(ids)] = "share";
  }
  return marks;
}

function buildGroups(openingMarks) {
  const groupA = new Set();
  for (const pair of YARN_PAIRS) {
    if (pair.some((id) => openingMarks[id] === "share")) {
      pair.forEach((id) => groupA.add(id));
    }
  }
  return groupA;
}

function markForRound(player, round) {
  return player.marks[round];
}

function randomRoundMarks(round) {
  return shuffled(round % 2
    ? ["share", "share", "fan", "circle"]
    : ["fan", "fan", "circle", "circle"]);
}

function nextRoundFor(player, afterRound = 0) {
  return GROUP_ROUNDS[player.group].find((round) => round > afterRound) || null;
}

function createPlayers() {
  const openingMarks = createOpeningMarks();
  const groupA = buildGroups(openingMarks);
  const players = ROLES.map((role, index) => {
    const group = groupA.has(role.id) ? "A" : "B";
    const firstRound = GROUP_ROUNDS[group][0];
    const opening = KTDN_OPENING_POSITIONS[role.id];
    return {
      id: role.id,
      role,
      group,
      x: opening.x,
      y: opening.y,
      startX: opening.x,
      startY: opening.y,
      targetX: 400,
      targetY: 640,
      stacks: 4,
      lastSoaked: 0,
      marks: { [firstRound]: openingMarks[role.id] },
      mark: openingMarks[role.id],
      markUpdatedAt: 0,
      wanderPhase: index * 1.73 + Math.random() * 0.8,
      tower: null,
    };
  });
  for (const [group, rounds] of Object.entries(GROUP_ROUNDS)) {
    const members = players.filter((player) => player.group === group);
    for (const round of rounds.slice(1)) {
      const marks = randomRoundMarks(round);
      members.forEach((player, index) => {
        player.marks[round] = marks[index];
      });
    }
  }
  return players;
}

function setupRoleButtons() {
  UI.roleButtons.innerHTML = "";
  for (const role of ROLES) {
    const button = document.createElement("button");
    button.className = "role-button";
    button.innerHTML = `<img src="${role.icon}" alt=""><strong>${role.id}</strong>`;
    button.addEventListener("click", () => startGame(role.id));
    UI.roleButtons.appendChild(button);
  }
}

function pairIdFor(playerId) {
  const pair = YARN_PAIRS.find((ids) => ids.includes(playerId));
  return pair?.find((id) => id !== playerId) || "—";
}

function startGame(playerId) {
  state = {
    running: true,
    finished: false,
    time: -3,
    lastFrame: performance.now(),
    playerId,
    players: createPlayers(),
    resolvedTowers: new Set(),
    resolvedCircles: new Set(),
    resolvedLocks: new Set(),
    resolvedHalves: new Set(),
    spellEffects: [],
    pastFuture: {
      2: randomChoice(["過去", "未来"]),
      4: randomChoice(["過去", "未来"]),
      6: randomChoice(["過去", "未来"]),
      8: randomChoice(["過去", "未来"]),
    },
    pastFutureLocks: {},
    lastTowerResolvedAt: null,
    moveTarget: null,
    bannerUntil: 0,
  };
  UI.roleModal.classList.add("hidden");
  UI.resultModal.classList.add("hidden");
  updateAssignment();
  requestAnimationFrame(loop);
}

function getPlayer() {
  return state.players.find((player) => player.id === state.playerId);
}

function activeRound() {
  for (let round = 1; round <= 8; round += 1) {
    if (!state.resolvedTowers.has(round)) return round;
  }
  return 8;
}

function towerInfo(round) {
  const group = round <= 3 || round === 8 ? "A" : "B";
  return { round, group, odd: round % 2 === 1, time: TOWER_TIMES[round - 1] };
}

function markSide(player, round) {
  const info = towerInfo(round);
  const peers = state.players
    .filter((member) => member.group === info.group && markForRound(member, round) === markForRound(player, round))
    .sort((a, b) =>
      TOWER_PRIORITY.indexOf(a.role.category) - TOWER_PRIORITY.indexOf(b.role.category)
    );
  return peers.indexOf(player);
}

const KTDN_OPENING_POSITIONS = {
  MT: { x: 254, y: 269 }, H1: { x: 284, y: 269 },
  ST: { x: 516, y: 269 }, H2: { x: 546, y: 269 },
  D2: { x: 516, y: 531 }, D4: { x: 546, y: 531 },
  D1: { x: 254, y: 531 }, D3: { x: 284, y: 531 },
};

const KTDN_POS = {
  oddT1C:  { tower: 0, x: 308, y: 503, name: "塔1・中央(share)" },
  oddT2N:  { tower: 1, x: 478, y: 439, name: "塔2・北(share)" },
  oddT1S:  { tower: 0, x: 308, y: 568, name: "塔1・南(扇)" },
  oddT2S:  { tower: 1, x: 492, y: 568, name: "塔2・南(円)" },
  evenT1N: { tower: 0, x: 322, y: 439, name: "塔1・北(扇)" },
  evenT1S: { tower: 0, x: 308, y: 568, name: "塔1・南(円)" },
  evenT2N: { tower: 1, x: 478, y: 439, name: "塔2・北(扇)" },
  evenT2S: { tower: 1, x: 492, y: 568, name: "塔2・南(円)" },
};

function ktdnComputeRoundLayout(activePlayers, round, priorRound, priorLayout) {
  const info = towerInfo(round);
  const result = {};

  if (info.odd) {
    const shares = activePlayers.filter((p) => p.marks[round] === "share");
    const fan = activePlayers.find((p) => p.marks[round] === "fan");
    const circle = activePlayers.find((p) => p.marks[round] === "circle");

    if (fan) result[fan.id] = KTDN_POS.oddT1S;
    if (circle) result[circle.id] = KTDN_POS.oddT2S;

    if (priorRound == null) {
      for (const p of shares) {
        result[p.id] = markSide(p, round) === 0 ? KTDN_POS.oddT1C : KTDN_POS.oddT2N;
      }
    } else {
      const shareTowers = shares.map((p) => priorLayout[p.id].tower);
      if (shareTowers.length === 2 && shareTowers[0] === shareTowers[1]) {
        const stuckTower = shareTowers[0];
        const swapPlayer = shares.find((p) => p.marks[priorRound] === "circle");
        const stayPlayer = shares.find((p) => p !== swapPlayer);
        if (stuckTower === 0) {
          result[stayPlayer.id] = KTDN_POS.oddT1C;
          result[swapPlayer.id] = KTDN_POS.oddT2N;
        } else {
          result[stayPlayer.id] = KTDN_POS.oddT2N;
          result[swapPlayer.id] = KTDN_POS.oddT1C;
        }
      } else {
        for (const p of shares) {
          const t = priorLayout[p.id].tower;
          result[p.id] = t === 0 ? KTDN_POS.oddT1C : KTDN_POS.oddT2N;
        }
      }
    }
  } else {
    const assignToTower = (player, tower) => {
      const mark = player.marks[round];
      if (tower === 0) {
        result[player.id] = mark === "fan" ? KTDN_POS.evenT1N : KTDN_POS.evenT1S;
      } else {
        result[player.id] = mark === "fan" ? KTDN_POS.evenT2N : KTDN_POS.evenT2S;
      }
    };

    if (priorRound == null) {
      for (const p of activePlayers) {
        const cat = p.role.category;
        const tower = (cat === "tank" || cat === "melee") ? 0 : 1;
        assignToTower(p, tower);
      }
    } else {
      const towerPlayers = [[], []];
      for (const p of activePlayers) {
        towerPlayers[priorLayout[p.id].tower].push(p);
      }
      const t0Marks = towerPlayers[0].map((p) => p.marks[round]);
      const stuck = t0Marks.length === 2 && t0Marks[0] === t0Marks[1];

      if (stuck) {
        const t0South = towerPlayers[0].find((p) => p.marks[priorRound] === "fan");
        const t0Other = towerPlayers[0].find((p) => p !== t0South);
        const t1South = towerPlayers[1].find((p) => p.marks[priorRound] === "circle");
        const t1Other = towerPlayers[1].find((p) => p !== t1South);
        assignToTower(t0Other, 0);
        assignToTower(t1South, 0);
        assignToTower(t0South, 1);
        assignToTower(t1Other, 1);
      } else {
        for (const p of activePlayers) {
          assignToTower(p, priorLayout[p.id].tower);
        }
      }
    }
  }

  return result;
}

function ktdnFullLayout(group) {
  const activePlayers = state.players.filter((p) => p.group === group);
  const rounds = GROUP_ROUNDS[group];
  const layouts = {};
  for (let i = 0; i < rounds.length; i += 1) {
    const round = rounds[i];
    const priorRound = i > 0 ? rounds[i - 1] : null;
    const priorLayout = priorRound != null ? layouts[priorRound] : null;
    layouts[round] = ktdnComputeRoundLayout(activePlayers, round, priorRound, priorLayout);
  }
  return layouts;
}

function ktdnAssignmentFor(player, round) {
  const info = towerInfo(round);
  if (player.group !== info.group) return null;
  const layouts = ktdnFullLayout(player.group);
  return layouts[round] && layouts[round][player.id] || null;
}

function assignmentFor(player, round) {
  return ktdnAssignmentFor(player, round);
}

function supportPosition(player, round) {
  const info = towerInfo(round);
  const positions = info.odd
    ? {
        tank: [371, 463],
        healer: [308, 595],
        melee: [429, 463],
        ranged: [429, 463],
      }
    : {
        tank: [341, 316],
        healer: [239, 400],
        melee: [459, 316],
        ranged: [561, 400],
      };
  const [x, y] = positions[player.role.category];
  return { x, y };
}

function stackPositionFor(sourceRound) {
  const flavor = state.pastFuture[sourceRound] || "過去";
  return {
    x: BOSS.x,
    y: BOSS.y + (flavor === "過去" ? DIRECTION_LOCK_DISTANCE : -DIRECTION_LOCK_DISTANCE),
  };
}

function directionLockPositionFor(sourceRound) {
  if (sourceRound === 8) {
    return { x: BOSS.x, y: BOSS.y - DIRECTION_LOCK_DISTANCE };
  }
  return stackPositionFor(sourceRound);
}

function finalSafePositionFor(sourceRound) {
  const flavor = state.pastFuture[sourceRound] || "過去";
  return {
    x: BOSS.x,
    y: BOSS.y + (flavor === "過去" ? -DIRECTION_LOCK_DISTANCE : DIRECTION_LOCK_DISTANCE),
  };
}

function assignmentPositionFor(player, round) {
  return assignmentFor(player, round) || supportPosition(player, round);
}

function stagingPositionFor(player, round) {
  if (round === 1) return { x: player.startX, y: player.startY };
  const previousRound = round - 1;
  if (previousRound % 2 === 0) {
    return directionLockPositionFor(previousRound);
  }
  return assignmentPositionFor(player, previousRound);
}

function wanderingTarget(player, base, settleAt) {
  const remaining = settleAt - state.time;
  const amplitude = Math.min(34, Math.max(0, (remaining - 1.4) * 4.5));
  const wave = state.time * 1.15 + player.wanderPhase;
  return {
    x: base.x + Math.sin(wave) * amplitude,
    y: base.y + Math.cos(wave * 0.73) * amplitude * 0.55,
  };
}

function timedTarget(player, destination, staging, deadline) {
  const remaining = deadline - state.time;
  const travelTime = distance(player, destination) / PLAYER_MOVE_SPEED;
  const target = remaining <= travelTime + NPC_ARRIVAL_MARGIN ? destination : staging;
  return wanderingTarget(player, target, deadline);
}

function npcTarget(player) {
  if (state.time < 0) {
    return KTDN_OPENING_POSITIONS[player.id];
  }
  if (state.lastTowerResolvedAt != null &&
      state.time < state.lastTowerResolvedAt + 1.6) {
    return { x: player.x, y: player.y };
  }
  if (state.time < player.markUpdatedAt + 1.0) {
    return { x: player.x, y: player.y };
  }
  const round = activeRound();
  const info = towerInfo(round);
  for (const sourceRound of [2, 4, 6, 8]) {
    const base = TOWER_TIMES[sourceRound - 1];
    if (state.resolvedTowers.has(sourceRound) && !state.resolvedLocks.has(sourceRound)) {
      const stack = directionLockPositionFor(sourceRound);
      if (sourceRound === 8) {
        return wanderingTarget(player, stack, base + 4.15);
      }
      return timedTarget(
        player,
        stack,
        assignmentPositionFor(player, sourceRound),
        base + 5
      );
    }
    if (sourceRound === 8 && state.resolvedLocks.has(sourceRound) &&
        state.time < base + 10.6) {
      return timedTarget(
        player,
        finalSafePositionFor(sourceRound),
        directionLockPositionFor(sourceRound),
        base + 10
      );
    }
  }

  return timedTarget(
    player,
    assignmentPositionFor(player, round),
    stagingPositionFor(player, round),
    info.time
  );
}

function moveToward(player, target, dt) {
  const tx = target.x - player.x;
  const ty = target.y - player.y;
  const distance = Math.hypot(tx, ty);
  if (distance <= 1) return;
  const step = Math.min(distance, PLAYER_MOVE_SPEED * dt);
  player.x += (tx / distance) * step;
  player.y += (ty / distance) * step;
}

function movePlayers(dt) {
  const player = getPlayer();
  if (autoplay) {
    moveToward(player, npcTarget(player), dt);
  }
  const sprint = keys.has("Shift") ? 1.55 : 1;
  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("s") || keys.has("ArrowDown")) dy += 1;
  if (keys.has("a") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("d") || keys.has("ArrowRight")) dx += 1;

  if (!autoplay && (dx || dy)) {
    state.moveTarget = null;
    const length = Math.hypot(dx, dy);
    player.x += (dx / length) * PLAYER_MOVE_SPEED * sprint * dt;
    player.y += (dy / length) * PLAYER_MOVE_SPEED * sprint * dt;
  } else if (!autoplay && state.moveTarget) {
    const tx = state.moveTarget.x - player.x;
    const ty = state.moveTarget.y - player.y;
    const distance = Math.hypot(tx, ty);
    const step = PLAYER_MOVE_SPEED * sprint * dt;
    if (distance <= step) {
      player.x = state.moveTarget.x;
      player.y = state.moveTarget.y;
      state.moveTarget = null;
    } else {
      player.x += (tx / distance) * step;
      player.y += (ty / distance) * step;
    }
  }

  for (const npc of state.players) {
    if (npc.id === state.playerId) continue;
    moveToward(npc, npcTarget(npc), dt);
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function checkArena() {
  if (state.time < 0) return;
  if (distance(getPlayer(), ARENA) > ARENA.r - 12) {
    fail("フィールド外へ落下しました。");
  }
}

function resolveTower(round) {
  if (state.resolvedTowers.has(round) || !state.running) return;
  state.resolvedTowers.add(round);
  const info = towerInfo(round);
  const occupied = TOWERS.map((tower) =>
    state.players.filter((member) => distance(member, tower) <= tower.r)
  );

  if (occupied.some((members) => members.length !== 2)) {
    fail(`${round}回目：塔はそれぞれ2人で処理します。`);
    return;
  }

  const active = state.players.filter((member) => member.group === info.group);
  const effects = createSpellEffects(active, round);
  const hazardFailure = spellHazardFailure(effects, round);
  if (hazardFailure) {
    fail(`${round}回目：${hazardFailure}`);
    return;
  }
  for (const member of active) {
    member.stacks -= 1;
    member.lastSoaked = round;
    const next = nextRoundFor(member, round);
    if (next) {
      member.mark = markForRound(member, next);
      member.markUpdatedAt = state.time;
    }
  }
  showBanner(`塔 ${round} / 8  処理成功`, 1.6);
  state.lastTowerResolvedAt = state.time;
  updateAssignment();
}

function createSpellEffects(activePlayers, round) {
  const snapshots = state.players.map((player) => ({
    id: player.id,
    x: player.x,
    y: player.y,
  }));
  for (const player of activePlayers) {
    const origin = snapshots.find((snapshot) => snapshot.id === player.id);
    const mark = player.mark;
    const effect = {
      type: mark,
      sourceId: player.id,
      x: origin.x,
      y: origin.y,
      startedAt: state.time,
      endsAt: state.time + 1.4,
    };
    if (mark === "fan") {
      const nearest = snapshots
        .filter((snapshot) => snapshot.id !== player.id)
        .sort((a, b) => distance(origin, a) - distance(origin, b))[0];
      effect.targetId = nearest.id;
      effect.angle = Math.atan2(nearest.y - origin.y, nearest.x - origin.x);
    }
    state.spellEffects.push(effect);
  }
  return state.spellEffects.slice(-activePlayers.length);
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function isHitBySpell(player, effect) {
  if (effect.type === "fan") {
    if (player.id === effect.sourceId) return false;
    const range = distance(player, effect);
    if (range > FAN_LENGTH) return false;
    const angle = Math.atan2(player.y - effect.y, player.x - effect.x);
    return Math.abs(angleDifference(angle, effect.angle)) <= FAN_HALF_ANGLE;
  }
  return distance(player, effect) <= SPELL_RADII[effect.type];
}

function spellHazardFailure(effects, round) {
  const pastFutureTargets = round % 2 === 0 ? circleTargets(round) : [];
  for (const player of state.players) {
    const spellHits = effects.filter((effect) => isHitBySpell(player, effect));
    if (spellHits.length > 1) {
      return `${player.id}がスペルハザードを複数同時に受けて戦闘不能になりました。`;
    }
    const fanHit = spellHits.some((effect) => effect.type === "fan");
    const pastFutureHit = pastFutureTargets.some(
      (target) => distance(player, target) <= PAST_FUTURE_RADIUS
    );
    if (fanHit && pastFutureHit) {
      return `${player.id}が扇と過去/未来のAoEを同時に受けて戦闘不能になりました。`;
    }
  }

  for (const effect of effects.filter((candidate) => candidate.type === "share")) {
    const targets = state.players.filter((player) => isHitBySpell(player, effect));
    if (targets.length !== 3) {
      const source = state.players.find((player) => player.id === effect.sourceId);
      return `${source?.id || "頭割り対象"}の頭割りは3人で受けます（現在${targets.length}人）。`;
    }
  }
  return null;
}

function liveCircleTargets(round) {
  const info = towerInfo(round);
  const activeFans = state.players.filter(
    (player) => player.group === info.group && markForRound(player, round) === "fan"
  );
  const inactive = state.players.filter((player) => player.group !== info.group);
  const tank = inactive.find((player) => player.role.category === "tank");
  const melee = inactive.find((player) => player.role.category === "melee");
  return [...activeFans, tank, melee].filter(Boolean);
}

function circleTargets(round) {
  const lock = state.pastFutureLocks[round];
  if (lock) return lock.targets;
  return liveCircleTargets(round);
}

function lockPastFutureTargets(round) {
  state.pastFutureLocks[round] = {
    targets: liveCircleTargets(round).map((p) => ({ id: p.id, x: p.x, y: p.y })),
    endsAt: state.time + 1.4,
  };
}

function pastFutureAoeFailure(round) {
  for (const target of circleTargets(round)) {
    const hits = state.players.filter(
      (player) => distance(player, target) <= PAST_FUTURE_RADIUS
    );
    if (hits.length !== 1 || hits[0].id !== target.id) {
      const others = hits.filter((player) => player.id !== target.id);
      if (others.length) {
        return `${target.id}の過去/未来AoEに${others.map((player) => player.id).join("・")}が巻き込まれました。`;
      }
      return `${target.id}が自身の過去/未来AoEを正しく受けられていません。`;
    }
  }
  return null;
}

function resolveCircle(round) {
  if (state.resolvedCircles.has(round) || !state.running) return;
  state.resolvedCircles.add(round);
  const aoeFailure = pastFutureAoeFailure(round);
  if (aoeFailure) {
    fail(`${round}回目：${aoeFailure}`);
  }
}

function isDirectionLockPositionValid(player, sourceRound) {
  const stack = directionLockPositionFor(sourceRound);
  const targetAngle = Math.atan2(stack.y - BOSS.y, stack.x - BOSS.x);
  const playerAngle = Math.atan2(player.y - BOSS.y, player.x - BOSS.x);
  const radialDifference = Math.abs(distance(player, BOSS) - DIRECTION_LOCK_DISTANCE);
  const angleOffset = Math.abs(angleDifference(playerAngle, targetAngle));
  return radialDifference <= DIRECTION_LOCK_TOLERANCE &&
    angleOffset <= DIRECTION_LOCK_HALF_ANGLE;
}

function resolveDirectionLock(sourceRound) {
  if (state.resolvedLocks.has(sourceRound) || !state.running) return;
  state.resolvedLocks.add(sourceRound);
  if (!isDirectionLockPositionValid(getPlayer(), sourceRound)) {
    fail(`${state.pastFuture[sourceRound]}：向き確定時に誘導位置へ集合できていません。`);
  }
}

function resolveHalf(sourceRound) {
  if (state.resolvedHalves.has(sourceRound) || !state.running) return;
  state.resolvedHalves.add(sourceRound);
  const player = getPlayer();
  const safePosition = sourceRound === 8
    ? finalSafePositionFor(sourceRound)
    : { x: BOSS.x, y: BOSS.y + DIRECTION_LOCK_DISTANCE };
  const onUnsafeSide = safePosition.y < BOSS.y
    ? player.y > BOSS.y - 4
    : player.y < BOSS.y + 4;
  if (onUnsafeSide) {
    fail(`${state.pastFuture[sourceRound]}：分身の半面AoEを受けました。`);
    return;
  }
}

function resolveEvents() {
  for (let round = 1; round <= 8; round += 1) {
    const hitTime = TOWER_TIMES[round - 1];
    if (round % 2 === 0 && state.time >= hitTime && !state.pastFutureLocks[round]) {
      lockPastFutureTargets(round);
    }
    if (state.time >= hitTime) resolveTower(round);
    if (round % 2 === 0 && state.time >= hitTime) resolveCircle(round);
    if (round % 2 === 0 && state.time >= hitTime + 5) resolveDirectionLock(round);
    if (round % 2 === 0 && state.time >= hitTime + 10) resolveHalf(round);
  }
  if (state.time >= 91 && state.running) clearGame();
}

function fail(reason) {
  if (!state.running) return;
  state.running = false;
  state.finished = true;
  UI.resultKicker.textContent = "DUTY FAILED";
  UI.resultTitle.textContent = "GAME OVER";
  UI.resultReason.textContent = reason;
  UI.resultModal.classList.remove("hidden");
}

function clearGame() {
  state.running = false;
  state.finished = true;
  UI.resultKicker.textContent = "DUTY COMPLETE";
  UI.resultTitle.textContent = "ミッシング突破";
  UI.resultReason.textContent = "8回の塔と4回の過去／未来をすべて処理しました。";
  UI.resultModal.classList.remove("hidden");
}

function showBanner(text, duration) {
  UI.banner.textContent = text;
  UI.banner.classList.remove("hidden");
  state.bannerUntil = state.time + duration;
}

function eventDisplay() {
  const time = Math.max(0, state.time);
  let next = TIMELINE_ITEMS.find(([at]) => at > time + 0.05);
  if (!next) next = [91, "終了"];
  UI.next.textContent = `${Math.max(0, Math.ceil(next[0] - time))}s ${next[1]}`;
  UI.time.textContent = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;

  const round = activeRound();
  UI.round.textContent = `ROUND ${round} / 8`;
  for (const item of UI.timeline.children) {
    item.classList.toggle("active", Number(item.dataset.time) <= time &&
      (item.nextElementSibling ? Number(item.nextElementSibling.dataset.time) > time : true));
  }

  if (state.time < 0) {
    UI.banner.textContent = Math.ceil(-state.time);
    UI.banner.classList.remove("hidden");
  } else if (state.time < 2) {
    UI.banner.textContent = "ミッシング";
    UI.banner.classList.remove("hidden");
  } else if (state.time > state.bannerUntil) {
    UI.banner.classList.add("hidden");
  }

  updateCastBar();
}

function updateCastBar() {
  let name = "";
  let progress = 0;
  for (const round of [2, 4, 6, 8]) {
    const base = TOWER_TIMES[round - 1];
    if (state.time >= base - 4 && state.time < base) {
      name = `${state.pastFuture[round]}の終焉`;
      progress = (state.time - (base - 4)) / 4;
    }
    if (state.time >= base + 5 && state.time < base + 10) {
      name = "消滅の脚";
      progress = (state.time - (base + 5)) / 5;
    }
  }
  UI.castBar.classList.toggle("hidden", !name);
  UI.castName.textContent = name;
  UI.castFill.style.width = `${progress * 100}%`;
}

function updateAssignment() {
  const player = getPlayer();
  if (!player) return;
  const round = nextRoundFor(player, player.lastSoaked);
  const assignment = round ? assignmentFor(player, round) : null;
  UI.roleIcon.src = player.role.icon;
  UI.roleName.textContent = player.id;
  UI.pairName.textContent = `PAIR ${pairIdFor(player.id)}`;
  UI.groupName.textContent = `${player.group === "A" ? "先組" : "後組"} · ${GROUP_ROUNDS[player.group].join(" / ")}`;
  UI.markBadge.textContent = MARK_LABEL[player.mark];
  UI.markBadge.className = `mark-badge ${player.mark}`;
  UI.towerAssignment.textContent = assignment ? `${round}回目 ${assignment.name}` : "完了";
  UI.stacks.textContent = String(player.stacks);
}

function drawArena() {
  ctx.clearRect(0, 0, W, W);
  const gradient = ctx.createRadialGradient(400, 380, 80, 400, 400, 355);
  gradient.addColorStop(0, "#172334");
  gradient.addColorStop(1, "#0c1420");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ARENA.x, ARENA.y, ARENA.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3d526e";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ARENA.x, ARENA.y, ARENA.r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(83,111,148,0.32)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(ARENA.x, ARENA.y);
    ctx.lineTo(ARENA.x + Math.cos(angle) * ARENA.r, ARENA.y + Math.sin(angle) * ARENA.r);
    ctx.stroke();
  }
  drawFieldMarkers();
  drawMechanics();
  ctx.restore();

  drawBoss();
  drawPlayers();
}

function drawMechanics() {
  if (state.time >= 0 && state.time < 80) {
    for (const tower of TOWERS) {
      ctx.fillStyle = "rgba(53,111,218,0.15)";
      ctx.strokeStyle = "#5b91ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a7c7ff";
      ctx.font = "700 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tower.label, tower.x, tower.y + 6);
    }
    drawTowerDrops();
  }
  drawSpellEffects();

  for (const sourceRound of [2, 4, 6, 8]) {
    const lock = state.pastFutureLocks[sourceRound];
    if (!lock || state.time > lock.endsAt) continue;
    for (const target of lock.targets) {
      ctx.fillStyle = "rgba(33,196,213,0.18)";
      ctx.strokeStyle = "#31d5e5";
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, PAST_FUTURE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (const sourceRound of [2, 4, 6, 8]) {
    const base = TOWER_TIMES[sourceRound - 1];
    if (state.time >= base + 10 && state.time < base + 11.4) {
      ctx.fillStyle = "rgba(192, 65, 79, 0.45)";
      const safePosition = sourceRound === 8
        ? finalSafePositionFor(sourceRound)
        : { x: BOSS.x, y: BOSS.y + DIRECTION_LOCK_DISTANCE };
      if (safePosition.y < BOSS.y) {
        ctx.fillRect(0, BOSS.y, W, W - BOSS.y);
      } else {
        ctx.fillRect(0, 0, W, BOSS.y);
      }
      ctx.strokeStyle = "#ff7d86";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, BOSS.y);
      ctx.lineTo(750, BOSS.y);
      ctx.stroke();
      drawClones(sourceRound);
    }
  }
}

function drawSpellEffects() {
  state.spellEffects = state.spellEffects.filter((effect) => effect.endsAt > state.time);
  for (const effect of state.spellEffects) {
    const life = Math.max(0, Math.min(1, (effect.endsAt - state.time) / 1.4));
    const alpha = 0.18 + life * 0.18;
    ctx.save();
    ctx.lineWidth = 3;
    if (effect.type === "share") {
      ctx.fillStyle = `rgba(239, 177, 49, ${alpha})`;
      ctx.strokeStyle = "rgba(255, 220, 125, 0.95)";
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, SPELL_RADII.share, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (effect.type === "circle") {
      ctx.fillStyle = `rgba(218, 66, 168, ${alpha})`;
      ctx.strokeStyle = "rgba(255, 115, 207, 0.95)";
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, SPELL_RADII.circle, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(111, 78, 239, ${alpha})`;
      ctx.strokeStyle = "rgba(160, 132, 255, 0.95)";
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.arc(
        effect.x,
        effect.y,
        FAN_LENGTH,
        effect.angle - FAN_HALF_ANGLE,
        effect.angle + FAN_HALF_ANGLE
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTowerDrops() {
  const round = activeRound();
  const hitTime = TOWER_TIMES[round - 1];
  const spawnTime = round === 1 ? 0 : TOWER_TIMES[round - 2];
  const progress = Math.min(1, Math.max(0, (state.time - spawnTime) / (hitTime - spawnTime)));
  const eased = progress * progress * (3 - 2 * progress);

  for (const tower of TOWERS) {
    const startY = tower.y - 175;
    const orbY = startY + (tower.y - startY) * eased;
    const pulse = 1 + Math.sin(state.time * 7) * 0.08;

    ctx.save();
    ctx.strokeStyle = `rgba(113, 176, 255, ${0.18 + progress * 0.42})`;
    ctx.lineWidth = 3 + progress * 3;
    ctx.beginPath();
    ctx.moveTo(tower.x, orbY + 13);
    ctx.lineTo(tower.x, tower.y);
    ctx.stroke();

    ctx.shadowColor = progress > 0.75 ? "#fff1a3" : "#72b5ff";
    ctx.shadowBlur = 18 + progress * 16;
    ctx.fillStyle = progress > 0.75 ? "#ffe783" : "#b7d9ff";
    ctx.beginPath();
    ctx.arc(tower.x, orbY, (11 + progress * 7) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawClones(round) {
  const targets = circleTargets(round);
  for (const target of targets) {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = "rgba(134,232,242,0.75)";
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(11, 12);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawFieldMarkers() {
  const HALF = 25;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.font = "700 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const m of FIELD_MARKERS) {
    ctx.strokeStyle = m.color;
    ctx.fillStyle = m.color;
    if (m.shape === "circle") {
      ctx.beginPath();
      ctx.arc(m.x, m.y, HALF, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(m.x - HALF, m.y - HALF, HALF * 2, HALF * 2);
      ctx.stroke();
    }
    ctx.fillText(m.label, m.x, m.y + 1);
  }
  ctx.restore();
}

function drawBoss() {
  ctx.save();
  ctx.translate(BOSS.x, BOSS.y);
  ctx.strokeStyle = "#ff3a4a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, BOSS_OUTER_RING, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, BOSS_INNER_RING, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = "#d7e5ff";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#d8e4f6";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, BOSS.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1c2a3e";
  ctx.font = "900 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("BOSS", 0, 4);
  ctx.restore();
}

function drawMark(player) {
  if (state.time < player.markUpdatedAt || state.time > player.markUpdatedAt + 3) return;
  const y = player.y - 32;
  ctx.save();
  ctx.translate(player.x, y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  if (player.mark === "share") {
    ctx.fillStyle = "#e4ab2d";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const arrows = [
      [[0, -5], [3, -8], [3, -13], [-3, -13], [-3, -8]],
      [[5, 0], [8, -3], [13, -3], [13, 3], [8, 3]],
      [[0, 5], [3, 8], [3, 13], [-3, 13], [-3, 8]],
      [[-5, 0], [-8, -3], [-13, -3], [-13, 3], [-8, 3]],
    ];
    for (const points of arrows) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (player.mark === "circle") {
    ctx.fillStyle = "#d84cac";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = "#7359ef";
    const fanHalfAngle = Math.PI / 8;
    const fanRadius = 26;
    const apexY = 13;
    ctx.beginPath();
    ctx.moveTo(0, apexY);
    ctx.arc(0, apexY, fanRadius, -Math.PI / 2 - fanHalfAngle, -Math.PI / 2 + fanHalfAngle);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayers() {
  for (const player of state.players) {
    drawMark(player);
    const controlled = player.id === state.playerId;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (controlled) {
      ctx.strokeStyle = "#fff4a8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = player.role.color;
    ctx.strokeStyle = "#07101b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `${controlled ? 900 : 700} 11px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(player.id, 0, 30);
    ctx.restore();
  }
}

function loop(now) {
  const rawDt = Math.min(0.04, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  if (state.running) {
    const speed = Number(UI.speed.value);
    const dt = rawDt * speed;
    state.time += dt;
    movePlayers(dt);
    checkArena();
    resolveEvents();
    eventDisplay();
    drawArena();
    requestAnimationFrame(loop);
  } else if (!state.finished) {
    requestAnimationFrame(loop);
  }
}

function setupTimeline() {
  UI.timeline.innerHTML = "";
  for (const [time, label] of TIMELINE_ITEMS) {
    const item = document.createElement("li");
    item.dataset.time = time;
    item.innerHTML = `<time>${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}</time><span>${label}</span>`;
    UI.timeline.appendChild(item);
  }
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
canvas.addEventListener("pointerdown", (event) => {
  if (!state.running) return;
  const rect = canvas.getBoundingClientRect();
  state.moveTarget = {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * W,
  };
});
UI.retry.addEventListener("click", () => {
  startGame(state.playerId);
});

setupRoleButtons();
setupTimeline();
drawArena();
if (autoplay) startGame(query.get("role") || "MT");

window.__sim = {
  get state() { return state; },
  assignmentFor,
  supportPosition,
  towerInfo,
  createPlayers,
  markForRound,
  markSide,
  ROLES,
  GROUP_ROUNDS,
  YARN_PAIRS,
  TOWERS,
  BOSS,
  ARENA,
  TOWER_TIMES,
  MARK_LABEL,
  TOWER_PRIORITY,
  SPELL_RADII,
  FAN_LENGTH,
  FAN_HALF_ANGLE,
};
