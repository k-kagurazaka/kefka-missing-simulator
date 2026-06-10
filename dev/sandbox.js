(() => {
  const W = 800;
  const PLAYER_RADIUS = 12;
  const HIT_RADIUS = 16;
  const LS_KEY = "sandbox-layout-v3";
  const STRATEGY = "yarn";
  const SPREAD = "ktdn";

  function waitForSim() {
    if (!window.__sim) {
      setTimeout(waitForSim, 50);
      return;
    }
    init();
  }

  function init() {
    const sim = window.__sim;
    const canvas = document.getElementById("sandbox-arena");
    const ctx = canvas.getContext("2d");

    const getField = (name) => document.querySelector(`[data-field="${name}"]`);
    const els = {
      pager: getField("round-pager"),
      showMarkers: getField("show-markers"),
      simulateAttacks: getField("simulate-attacks"),
      marksGrid: getField("marks-grid"),
      marksRound: getField("marks-round"),
      groupA: getField("group-a"),
      groupB: getField("group-b"),
    };

    let currentRound = 1;
    const posOverrides = {}; // {round: {playerId: {x, y}}}

    function activeGroupFor(round) {
      return sim.towerInfo(round).group;
    }

    function buildState() {
      sim.state.strategy = STRATEGY;
      sim.state.spread = SPREAD;
      sim.state.players = sim.createPlayers(STRATEGY);
      restoreFromStorage();
      syncPlayersToRound();
      refreshMarksGrid();
      refreshGroupInfo();
      refreshPagerHighlight();
    }

    function restoreFromStorage() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.marks) {
          for (const p of sim.state.players) {
            if (data.marks[p.id]) {
              const restored = {};
              for (const [k, v] of Object.entries(data.marks[p.id])) {
                restored[Number(k)] = v;
              }
              p.marks = { ...p.marks, ...restored };
            }
          }
        }
        if (data.posOverrides) {
          for (const k of Object.keys(posOverrides)) delete posOverrides[k];
          for (const [round, byId] of Object.entries(data.posOverrides)) {
            posOverrides[Number(round)] = { ...byId };
          }
        }
      } catch {
        // ignore
      }
    }

    function saveLayoutToStorage() {
      const marks = {};
      for (const p of sim.state.players) {
        marks[p.id] = { ...p.marks };
      }
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ marks, posOverrides }));
      } catch {
        // ignore
      }
    }

    function syncPlayersToRound() {
      const overrides = posOverrides[currentRound] || {};
      for (const p of sim.state.players) {
        const ov = overrides[p.id];
        if (ov) {
          p.x = ov.x;
          p.y = ov.y;
        } else {
          p.x = p.startX;
          p.y = p.startY;
        }
      }
    }

    function buildPager() {
      els.pager.innerHTML = "";
      for (let r = 1; r <= 8; r += 1) {
        const info = sim.towerInfo(r);
        const odd = r % 2 === 1;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.round = String(r);
        btn.className = "pager-btn";
        btn.innerHTML = `<b>${r}</b><span>${info.group}${odd ? "奇" : "偶"}</span>`;
        btn.addEventListener("click", () => setRound(r));
        els.pager.appendChild(btn);
      }
    }

    function refreshPagerHighlight() {
      for (const btn of els.pager.querySelectorAll(".pager-btn")) {
        btn.classList.toggle("active", Number(btn.dataset.round) === currentRound);
      }
    }

    function setRound(r) {
      currentRound = r;
      syncPlayersToRound();
      refreshMarksGrid();
      refreshPagerHighlight();
    }

    function refreshMarksGrid() {
      els.marksRound.textContent = String(currentRound);
      els.marksGrid.innerHTML = "";
      const activeGroup = activeGroupFor(currentRound);
      for (const role of sim.ROLES) {
        const player = sim.state.players.find((p) => p.id === role.id);
        if (!player || player.group !== activeGroup) continue;
        const currentMark = player.marks?.[currentRound] || "";
        const sel = document.createElement("select");
        sel.dataset.player = role.id;
        sel.dataset.round = String(currentRound);
        for (const opt of ["share", "fan", "circle"]) {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          if (opt === currentMark) o.selected = true;
          sel.appendChild(o);
        }
        sel.addEventListener("change", () => {
          if (!player.marks) player.marks = {};
          player.marks[currentRound] = sel.value;
          saveLayoutToStorage();
        });
        const label = document.createElement("label");
        label.style.setProperty("--id-color", role.color);
        label.innerHTML = `<b>${role.id}</b>`;
        label.appendChild(sel);
        els.marksGrid.appendChild(label);
      }
    }

    function refreshGroupInfo() {
      const a = sim.state.players.filter((p) => p.group === "A").map((p) => p.id);
      const b = sim.state.players.filter((p) => p.group === "B").map((p) => p.id);
      els.groupA.textContent = a.join(", ") || "—";
      els.groupB.textContent = b.join(", ") || "—";
    }

    function toCanvasCoords(event) {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * W;
      const y = ((event.clientY - rect.top) / rect.height) * W;
      return { x: Math.round(x), y: Math.round(y) };
    }

    function playerAt(x, y) {
      let best = null;
      let bestDist = HIT_RADIUS;
      for (const p of sim.state.players) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d <= bestDist) {
          best = p;
          bestDist = d;
        }
      }
      return best;
    }

    let dragPlayer = null;

    function setOverride(playerId, x, y) {
      if (!posOverrides[currentRound]) posOverrides[currentRound] = {};
      posOverrides[currentRound][playerId] = { x, y };
    }

    canvas.addEventListener("pointerdown", (event) => {
      const { x, y } = toCanvasCoords(event);
      const hit = playerAt(x, y);
      if (hit) {
        dragPlayer = hit;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!dragPlayer) return;
      const { x, y } = toCanvasCoords(event);
      dragPlayer.x = x;
      dragPlayer.y = y;
    });

    canvas.addEventListener("pointerup", (event) => {
      if (!dragPlayer) return;
      const { x, y } = toCanvasCoords(event);
      dragPlayer.x = x;
      dragPlayer.y = y;
      setOverride(dragPlayer.id, x, y);
      saveLayoutToStorage();
      dragPlayer = null;
    });

    canvas.addEventListener("pointercancel", () => { dragPlayer = null; });

    function postDump() {
      const round = currentRound;
      const payload = {
        action: "layout",
        round,
        strategy: STRATEGY,
        spread: SPREAD,
        players: sim.state.players.map((p) => ({
          id: p.id,
          group: p.group,
          category: p.role.category,
          mark: p.marks?.[round] || null,
          x: Math.round(p.x),
          y: Math.round(p.y),
        })),
      };
      fetch("/__dev/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }

    document.querySelector('[data-action="reroll"]').addEventListener("click", () => {
      localStorage.removeItem(LS_KEY);
      for (const k of Object.keys(posOverrides)) delete posOverrides[k];
      buildState();
    });
    document.querySelector('[data-action="reset-round"]').addEventListener("click", () => {
      delete posOverrides[currentRound];
      syncPlayersToRound();
      saveLayoutToStorage();
    });
    document.querySelector('[data-action="reset-all"]').addEventListener("click", () => {
      for (const k of Object.keys(posOverrides)) delete posOverrides[k];
      syncPlayersToRound();
      saveLayoutToStorage();
    });
    document.querySelector('[data-action="snap"]').addEventListener("click", () => {
      const round = currentRound;
      const activeGroup = activeGroupFor(round);
      for (const p of sim.state.players) {
        const pos = p.group === activeGroup
          ? sim.assignmentFor(p, round)
          : sim.supportPosition(p, round);
        if (pos) {
          p.x = pos.x;
          p.y = pos.y;
          setOverride(p.id, pos.x, pos.y);
        }
      }
      saveLayoutToStorage();
    });
    document.querySelector('[data-action="dump"]').addEventListener("click", postDump);

    buildPager();
    buildState();

    function drawArenaBackground() {
      const { ARENA, BOSS } = sim;
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
      ctx.restore();
    }

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

    function drawTowers(analysis) {
      const sim = analysis.simulating;
      for (const { tower, members, ok } of analysis.towerOccupancy) {
        const warn = sim && !ok;
        ctx.fillStyle = warn ? "rgba(239, 80, 60, 0.20)" : "rgba(53,111,218,0.15)";
        ctx.strokeStyle = warn ? "#ff5d6c" : "#5b91ff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = warn ? "#ffc7c7" : "#a7c7ff";
        ctx.font = "700 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tower.label, tower.x, tower.y + 6);
        if (sim) {
          ctx.font = "700 11px ui-monospace, monospace";
          ctx.fillStyle = warn ? "#ff5d6c" : "#a7c7ff";
          ctx.fillText(`${members.length}/2`, tower.x, tower.y + 22);
        }
      }
    }

    function drawBoss() {
      const { BOSS } = sim;
      const outerRadius = 98;
      const innerRadius = outerRadius * 0.862;
      ctx.save();
      ctx.translate(BOSS.x, BOSS.y);
      ctx.strokeStyle = "#ff3a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
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

    function isHitBySpell(player, effect) {
      const { SPELL_RADII, FAN_LENGTH, FAN_HALF_ANGLE } = sim;
      if (effect.type === "fan") {
        if (player.id === effect.sourceId) return false;
        if (effect.angle == null) return false;
        const r = Math.hypot(player.x - effect.x, player.y - effect.y);
        if (r > FAN_LENGTH) return false;
        const a = Math.atan2(player.y - effect.y, player.x - effect.x);
        const d = Math.atan2(Math.sin(a - effect.angle), Math.cos(a - effect.angle));
        return Math.abs(d) <= FAN_HALF_ANGLE;
      }
      return Math.hypot(player.x - effect.x, player.y - effect.y) <= SPELL_RADII[effect.type];
    }

    function computeAttackAnalysis() {
      const round = currentRound;
      const activeGroup = activeGroupFor(round);
      const PAST_FUTURE_RADIUS = sim.SPELL_RADII.circle * 1.1;

      const effects = [];
      for (const player of sim.state.players) {
        if (player.group !== activeGroup) continue;
        const mark = player.marks?.[round];
        if (!mark) continue;
        const effect = { type: mark, sourceId: player.id, x: player.x, y: player.y };
        if (mark === "fan") {
          const nearest = sim.state.players
            .filter((other) => other.id !== player.id)
            .sort((a, b) =>
              Math.hypot(a.x - player.x, a.y - player.y) -
              Math.hypot(b.x - player.x, b.y - player.y)
            )[0];
          if (nearest) effect.angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
        }
        effects.push(effect);
      }

      let pfTargets = [];
      if (round % 2 === 0) {
        const activeFans = sim.state.players.filter(
          (p) => p.group === activeGroup && p.marks?.[round] === "fan"
        );
        const inactive = sim.state.players.filter((p) => p.group !== activeGroup);
        const tank = inactive.find((p) => p.role.category === "tank");
        const melee = inactive.find((p) => p.role.category === "melee");
        pfTargets = [...activeFans, tank, melee].filter(Boolean);
      }

      const playerStatus = new Map();
      for (const player of sim.state.players) {
        const spellHits = effects.filter((e) => isHitBySpell(player, e));
        const insidePf = pfTargets.filter(
          (t) => Math.hypot(player.x - t.x, player.y - t.y) <= PAST_FUTURE_RADIUS
        );
        const reasons = [];
        if (spellHits.length > 1) {
          reasons.push(`AoE×${spellHits.length}`);
        }
        if (spellHits.some((e) => e.type === "fan") && insidePf.length > 0) {
          reasons.push("扇+過去/未来");
        }
        const othersPf = insidePf.filter((t) => t.id !== player.id);
        if (othersPf.length > 0) {
          reasons.push(`${othersPf.map((t) => t.id).join("/")}巻込`);
        }
        playerStatus.set(player.id, { dead: reasons.length > 0, reasons });
      }

      const shareWarnings = new Map();
      for (const effect of effects) {
        if (effect.type !== "share") continue;
        const count = sim.state.players.filter((p) => isHitBySpell(p, effect)).length;
        if (count !== 3) shareWarnings.set(effect.sourceId, count);
      }

      const towerOccupancy = sim.TOWERS.map((tower) => {
        const members = sim.state.players.filter(
          (p) => Math.hypot(p.x - tower.x, p.y - tower.y) <= tower.r
        );
        return { tower, members, ok: members.length === 2 };
      });

      const simulating = els.simulateAttacks.checked;
      return { effects, pfTargets, PAST_FUTURE_RADIUS, playerStatus, shareWarnings, towerOccupancy, round, activeGroup, simulating };
    }

    function drawAttackEffects(analysis) {
      if (!analysis.simulating) return;
      const { effects, pfTargets, PAST_FUTURE_RADIUS, shareWarnings } = analysis;
      const { SPELL_RADII, FAN_LENGTH, FAN_HALF_ANGLE } = sim;

      for (const effect of effects) {
        ctx.save();
        ctx.lineWidth = 3;
        if (effect.type === "share") {
          const bad = shareWarnings.has(effect.sourceId);
          ctx.fillStyle = bad ? "rgba(239, 80, 60, 0.30)" : "rgba(239, 177, 49, 0.30)";
          ctx.strokeStyle = bad ? "rgba(255, 130, 110, 0.95)" : "rgba(255, 220, 125, 0.95)";
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, SPELL_RADII.share, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (effect.type === "circle") {
          ctx.fillStyle = "rgba(218, 66, 168, 0.30)";
          ctx.strokeStyle = "rgba(255, 115, 207, 0.95)";
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, SPELL_RADII.circle, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (effect.type === "fan" && effect.angle != null) {
          ctx.fillStyle = "rgba(111, 78, 239, 0.30)";
          ctx.strokeStyle = "rgba(160, 132, 255, 0.95)";
          ctx.beginPath();
          ctx.moveTo(effect.x, effect.y);
          ctx.arc(effect.x, effect.y, FAN_LENGTH, effect.angle - FAN_HALF_ANGLE, effect.angle + FAN_HALF_ANGLE);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const target of pfTargets) {
        ctx.save();
        ctx.fillStyle = "rgba(33,196,213,0.18)";
        ctx.strokeStyle = "#31d5e5";
        ctx.setLineDash([7, 6]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(target.x, target.y, PAST_FUTURE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    function drawMarkers() {
      if (!els.showMarkers.checked) return;
      const round = currentRound;
      const activeGroup = activeGroupFor(round);

      for (const player of sim.state.players) {
        const source = player.group === activeGroup ? "assignment" : "support";
        let pos = null;
        try {
          pos = source === "support"
            ? sim.supportPosition(player, round)
            : sim.assignmentFor(player, round);
        } catch {
          pos = null;
        }
        if (!pos) continue;
        const markUsed = source === "support"
          ? "wait"
          : (player.marks && player.marks[round]) || "?";
        drawMarkerRing(pos.x, pos.y, `${player.id}/${markUsed}`, player.role.color, pos.name);
      }
    }

    function drawMarkerRing(x, y, label, color, subtitle) {
      ctx.save();
      ctx.strokeStyle = color || "#52d7e7";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "700 11px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.95)";
      ctx.strokeText(label, x + 18, y - 5);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 18, y - 5);

      if (subtitle) {
        ctx.font = "10px ui-monospace, monospace";
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(subtitle, x + 18, y + 7);
        ctx.fillStyle = "rgba(220, 232, 251, 0.85)";
        ctx.fillText(subtitle, x + 18, y + 7);
      }
      ctx.restore();
    }

    function drawPlayers(analysis) {
      const round = analysis.round;
      const activeGroup = analysis.activeGroup;
      const simulating = analysis.simulating;
      for (const player of sim.state.players) {
        const status = simulating ? analysis.playerStatus.get(player.id) : null;
        const isActive = player.group === activeGroup;
        const mark = isActive ? (player.marks?.[round] || null) : null;
        ctx.save();
        ctx.translate(player.x, player.y);

        if (status?.dead) {
          ctx.strokeStyle = "#ff3a4a";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, PLAYER_RADIUS + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = player.role.color;
        ctx.strokeStyle = dragPlayer === player ? "#fff4a8" : "#07101b";
        ctx.lineWidth = 3;
        ctx.globalAlpha = isActive ? 1 : 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = "900 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(player.id, 0, 4);

        if (mark) {
          ctx.font = "700 10px ui-monospace, monospace";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.9)";
          ctx.strokeText(mark, 0, PLAYER_RADIUS + 12);
          ctx.fillStyle = markColor(mark);
          ctx.fillText(mark, 0, PLAYER_RADIUS + 12);
        }

        if (status?.dead && status.reasons.length) {
          const reason = status.reasons[0];
          ctx.font = "700 9px ui-monospace, monospace";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.95)";
          ctx.strokeText(reason, 0, PLAYER_RADIUS + (mark ? 24 : 12));
          ctx.fillStyle = "#ff5d6c";
          ctx.fillText(reason, 0, PLAYER_RADIUS + (mark ? 24 : 12));
        }

        ctx.restore();
      }
    }

    function markColor(mark) {
      if (mark === "share") return "#ffdb6e";
      if (mark === "fan") return "#a087ff";
      if (mark === "circle") return "#ff86d3";
      return "#9bb1cc";
    }

    function drawHeader() {
      const round = currentRound;
      const activeGroup = activeGroupFor(round);
      ctx.save();
      ctx.fillStyle = "rgba(241, 189, 79, 0.85)";
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`round ${round} / active ${activeGroup}`, 12, 12);
      ctx.restore();
    }

    function render() {
      const analysis = computeAttackAnalysis();
      drawArenaBackground();
      drawFieldMarkers();
      drawTowers(analysis);
      drawBoss();
      drawAttackEffects(analysis);
      drawMarkers();
      drawPlayers(analysis);
      drawHeader();
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    console.log("[sandbox] ready. click round buttons; drag players; Snap/Reset/Dump as needed");
  }

  waitForSim();
})();
