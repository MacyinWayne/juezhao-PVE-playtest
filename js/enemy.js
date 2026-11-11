/* ============================================================
 * 《抉招：江湖录》· 鲨鱼头挑战 —— 敌方 AI（Boss / 小怪）
 * ------------------------------------------------------------
 * 形态：经典脚本（非 ESM），挂到 JZ.ENEMY_AI
 * 职责（SPEC §四.b / §2.2）：
 *   ① 意图套组选择（按 weight 加权随机）
 *   ② 敌方行动：先按 intentSet.plan 顺序「尽量施展」，剩余标记贪心补齐
 *   ③ 敌方技能 op 执行（只认 SPEC §2.2 的 op 表；未知 op 记 error 日志，不静默）
 * 约束：纯逻辑；不抛异常（引擎已 try/catch）
 * ============================================================ */
(function (root) {
  'use strict';

  var JZ = (root.JZ = root.JZ || {});
  var AI = (JZ.ENEMY_AI = JZ.ENEMY_AI || {});

  var MAX_LOOPS = 40;

  // ------------------------------------------------------------
  // 小工具
  // ------------------------------------------------------------
  function skillCost(skill) {
    var c = (skill && skill.cost) || {};
    return ((c.jq || 0) + (c.bs || 0) + (c.lh || 0)) || 1;
  }
  function findSkill(skills, id) {
    for (var i = 0; i < skills.length; i++) if (skills[i].id === id) return skills[i];
    return null;
  }

  // ------------------------------------------------------------
  // 意图套组选择：基础 weight × 原型倍率（SPEC §10.9 R25）
  // ------------------------------------------------------------
  var MIN_MULT = 0.5;
  var MAX_MULT = 2.5;

  /** 意图套组的原型：burst（隐藏）/ offense（jq≥3）/ defense（bs≥3）/ utility（lh≥3）/ 兜底取最大项 */
  function archetypeOfSet(set) {
    if (!set) return 'offense';
    if (set.hidden) return 'burst';
    var m = set.marks || {};
    var jq = Number(m.jq) || 0;
    var bs = Number(m.bs) || 0;
    var lh = Number(m.lh) || 0;
    if (jq >= 3) return 'offense';
    if (bs >= 3) return 'defense';
    if (lh >= 3) return 'utility';
    if (jq >= bs && jq >= lh) return 'offense';
    if (bs >= lh) return 'defense';
    return 'utility';
  }

  /** 取学习倍率（无 ai.js / 异常 → 1；clamp 0.5~2.5） */
  function learnMultiplier(archetype) {
    try {
      var A = JZ.AILearning;
      if (A && typeof A.getMultiplier === 'function') {
        var m = Number(A.getMultiplier(archetype));
        if (isFinite(m)) return Math.max(MIN_MULT, Math.min(MAX_MULT, m));
      }
    } catch (e) { /* 静默降级 */ }
    return 1;
  }

  AI.chooseIntentSet = function (sets, rand) {
    if (!sets || !sets.length) return null;
    var weights = [];
    var total = 0;
    for (var i = 0; i < sets.length; i++) {
      var base = Math.max(0, Number(sets[i].weight) || 0) || 1;
      var mult = learnMultiplier(archetypeOfSet(sets[i]));
      var w = base * mult;
      weights.push(w);
      total += w;
    }
    if (!(total > 0)) return sets[0];
    var r = rand() * total;
    var acc = 0;
    for (var j = 0; j < sets.length; j++) {
      acc += weights[j];
      if (r < acc) return sets[j];
    }
    return sets[sets.length - 1];
  };

  AI.archetypeOfSet = archetypeOfSet;
  AI.learnMultiplier = learnMultiplier;

  // ------------------------------------------------------------
  // 技能价值（贪心补标记用）
  //   只看「这一招对当前局势大概值多少」，除以标记消耗得到密度
  // ------------------------------------------------------------
  function opValue(op) {
    var v = Number(op.v) || 0;
    switch (op.op) {
      case 'damage': return v;
      case 'multiDamage': return v * (Number(op.times) || 1);
      case 'block': return v * 0.7;
      case 'dodge': return v * 0.7;
      case 'hua': return v * 0.7;
      case 'healSelf': return v * 0.6;
      case 'healFake': return v * 0.6;
      case 'summon': return 2.4;
      case 'allyDamageBuff': return 2.0;
      case 'allyBlock': return v * 0.6;
      case 'allyDodge': return v * 0.6;
      case 'allyHeal': return v * 0.6;
      case 'playerPlayLimit': return 1.8;
      case 'playerRouteLock': return 1.3;
      case 'playerDamageDebuff': return v * 1.6;
      case 'retaliate': return 1.2;
      case 'selfDamageBuff': return v * 1.0; // 下回合才生效，价值略打折
      default: return 0.2;
    }
  }
  function skillValue(skill) {
    var total = 0;
    var effs = (skill && skill.effects) || [];
    for (var i = 0; i < effs.length; i++) total += opValue(effs[i]);
    return total;
  }
  function skillScore(skill) {
    return skillValue(skill) / skillCost(skill);
  }

  // ------------------------------------------------------------
  // 技能描述（给战斗日志用）
  // ------------------------------------------------------------
  function describeSkill(skill) {
    var parts = [];
    var effs = skill.effects || [];
    for (var i = 0; i < effs.length; i++) {
      var op = effs[i];
      var v = Number(op.v) || 0;
      switch (op.op) {
        case 'damage': parts.push(v + ' 点伤害'); break;
        case 'multiDamage': parts.push(v + ' 点伤害 ×' + (Number(op.times) || 1)); break;
        case 'block': parts.push('获得 ' + v + ' 点格挡'); break;
        case 'dodge': parts.push('获得 ' + v + ' 层闪避'); break;
        case 'hua': parts.push('获得 ' + v + ' 点化劲'); break;
        case 'healSelf': parts.push('回复 ' + v + ' HP'); break;
        case 'healFake': parts.push('假血 +' + v); break;
        case 'summon': parts.push('召唤 ' + (op.unit === 'crab' ? '蟹将' : op.unit === 'shrimp' ? '虾兵' : op.unit)); break;
        case 'allyDamageBuff': parts.push('友方本回合每次伤害 +' + v); break;
        case 'allyBlock': parts.push('友方获得 ' + v + ' 点格挡'); break;
        case 'allyDodge': parts.push('友方获得 ' + v + ' 层闪避'); break;
        case 'allyHeal': parts.push('友方回复 ' + v + ' HP'); break;
        case 'playerPlayLimit': parts.push('玩家下回合出牌上限 -' + v); break;
        case 'playerRouteLock': parts.push('玩家下回合前 ' + (op.count || 3) + ' 张路数视为「特」'); break;
        case 'playerDamageDebuff': parts.push('玩家下回合每段伤害 -' + v); break;
        case 'retaliate': parts.push('逆鳞反噬（本回合每次被命中追加 ' + (op.perHit || 0) + ' 点）'); break;
        case 'selfDamageBuff': parts.push('自身下回合首次攻击 +' + v + '（一次性）'); break;
        default: parts.push(op.op); break;
      }
    }
    return parts.join('，');
  }

  // ------------------------------------------------------------
  // 敌方技能 op 执行（SPEC §2.2）
  //   R22 逆鳞反噬：「造成 4 点伤害，再追加 2×玩家本回合命中 Boss 次数（同一段结算）」
  //   → 先扫出 retaliate 的追加值，合并进同一技能里的 damage 段（而不是另开一段）
  // ------------------------------------------------------------
  function executeOps(ctx, entity, skill) {
    var effs = skill.effects || [];
    var i, op, v;

    // 预扫 retaliate（取最后一个，数据里每技能最多一个）
    var retOp = null;
    for (i = 0; i < effs.length; i++) if (effs[i].op === 'retaliate') retOp = effs[i];
    var retBonus = 0;
    var retConsumed = false;
    if (retOp) {
      var hits = (ctx.player && ctx.player.hitOnBossThisTurn) || 0;
      retBonus = hits * (Number(retOp.perHit) || 0);
    }

    for (i = 0; i < effs.length; i++) {
      if (ctx.over()) break;
      op = effs[i];
      v = Number(op.v) || 0;
      switch (op.op) {
        case 'damage': {
          var bonus = retConsumed ? 0 : retBonus;
          if (bonus > 0) {
            ctx.log('intent', entity.name + ' 逆鳞反噬：追加 ' + bonus + ' 点（与本段合并结算）');
            retConsumed = true;
          }
          ctx.enemyHit(entity, v + bonus);
          break;
        }
        case 'multiDamage':
          ctx.enemyMultiHit(entity, v, Number(op.times) || 1);
          break;
        case 'block':
          ctx.addEnemyBlock(entity, v);
          break;
        case 'dodge':
          ctx.addEnemyDodge(entity, v);
          break;
        case 'hua':
          ctx.addEnemyHua(entity, v);
          break;
        case 'healSelf':
          ctx.healEntity(entity, v);
          break;
        case 'healFake':
          ctx.healFake(entity, v);
          break;
        case 'summon':
          ctx.summon(op.unit, Number(op.count) || 1);
          break;
        case 'allyDamageBuff':
          ctx.allyDamageBuff(entity, v, op.unit || null);
          break;
        case 'allyBlock':
          ctx.allyBlock(entity, v, !!op.includeSelf);
          break;
        case 'allyDodge':
          ctx.allyDodge(entity, v, !!op.includeSelf);
          break;
        case 'allyHeal':
          ctx.allyHeal(entity, v, !!op.includeSelf);
          break;
        case 'playerPlayLimit':
          ctx.playerPlayLimit(v);
          break;
        case 'playerRouteLock':
          ctx.playerRouteLock(Number(op.count) || 3, Number(op.turns) || 1);
          break;
        case 'playerDamageDebuff':
          ctx.playerDamageDebuff(v, Number(op.turns) || 1);
          break;
        case 'retaliate':
          // 已合并进 damage 段；若该技能没有 damage op，则按追加段单独结算（数据不会走到）
          if (!retConsumed) {
            if (retBonus > 0) {
              ctx.log('intent', entity.name + ' 逆鳞反噬：追加 ' + retBonus + ' 点');
              ctx.enemyHit(entity, retBonus);
            } else {
              ctx.log('intent', entity.name + ' 逆鳞反噬：本回合未被命中，无追加伤害');
            }
            retConsumed = true;
          }
          break;
        // SPEC §2.2：selfDamageBuff = 自身「下回合」首次攻击额外 +v（一次性）
        case 'selfDamageBuff':
          ctx.selfDamageBuff(entity, v);
          break;
        default:
          ctx.log('error', '未知的敌方技能 op：' + op.op + '（技能「' + skill.name + '」）');
          break;
      }
    }
  }

  // ------------------------------------------------------------
  // 单次技能施放：扣标记 → 记 skill-start 事件 → 记日志 → 执行 op
  //   事件流（SPEC §10.4）：UI 靠 skill-start 的 cost/remain 播放「消耗了哪些意图」
  // ------------------------------------------------------------
  function castSkill(ctx, entity, skill) {
    var cost = skill.cost || {};
    if (!ctx.afford(entity, cost)) return false;
    var paid = { jq: Number(cost.jq) || 0, bs: Number(cost.bs) || 0, lh: Number(cost.lh) || 0 };
    ctx.spend(entity, cost);
    var remain = {
      jq: entity.intents.jq || 0,
      bs: entity.intents.bs || 0,
      lh: entity.intents.lh || 0
    };
    if (typeof ctx.emit === 'function') {
      ctx.emit('skill-start', {
        enemyId: entity.id,
        enemyName: entity.name,
        skillId: skill.id,
        skillName: skill.name,
        cost: paid,
        remain: remain
      });
    }
    ctx.log('intent', entity.name + ' 使用 ' + skill.name +
      (describeSkill(skill) ? '：' + describeSkill(skill) : ''));
    executeOps(ctx, entity, skill);
    return true;
  }

  // ------------------------------------------------------------
  // 技能分类（SPEC §10.11.2 R27/R28）
  //   组合（cost 涉及 ≥2 类标记，或数据显式 skill.priority）→ 最先
  //   增益/灵活组（allyDamageBuff/allyBlock/allyDodge/allyHeal/selfDamageBuff/
  //     playerDamageDebuff/playerPlayLimit/playerRouteLock/summon/healSelf/healFake）
  //   → 保守/防御组（仅 block/dodge/hua）→ 最后进取/攻击组（damage/multiDamage）
  // ------------------------------------------------------------
  var BUFF_OPS = {
    allyDamageBuff: 1, allyBlock: 1, allyDodge: 1, allyHeal: 1, selfDamageBuff: 1,
    playerDamageDebuff: 1, playerPlayLimit: 1, playerRouteLock: 1,
    summon: 1, healSelf: 1, healFake: 1
  };
  var DEFENSE_OPS = { block: 1, dodge: 1, hua: 1 };
  var DAMAGE_OPS = { damage: 1, multiDamage: 1 };

  function costMarkTypes(skill) {
    var c = (skill && skill.cost) || {};
    var n = 0;
    if ((Number(c.jq) || 0) > 0) n++;
    if ((Number(c.bs) || 0) > 0) n++;
    if ((Number(c.lh) || 0) > 0) n++;
    return n;
  }
  /** 技能分组：priority(0) → combo(1) → buff(2) → defense(3) → attack(4) */
  function skillGroup(skill) {
    if (!skill) return { group: 'attack', rank: 4 };
    if (typeof skill.priority === 'number' && isFinite(skill.priority)) {
      return { group: 'priority', rank: 0, priority: Math.max(0, skill.priority) };
    }
    if (costMarkTypes(skill) >= 2) return { group: 'combo', rank: 1 };
    var effs = skill.effects || [];
    var hasBuff = false;
    var hasDamage = false;
    var allDefense = effs.length > 0;
    for (var i = 0; i < effs.length; i++) {
      var op = effs[i].op;
      if (BUFF_OPS[op]) hasBuff = true;
      if (DAMAGE_OPS[op]) hasDamage = true;
      if (!DEFENSE_OPS[op]) allDefense = false;
    }
    if (hasBuff) return { group: 'buff', rank: 2 };
    if (hasDamage) return { group: 'attack', rank: 4 };
    if (allDefense) return { group: 'defense', rank: 3 };
    return { group: 'attack', rank: 4 };
  }

  // ------------------------------------------------------------
  // 选招推演（SPEC §10.11.3 第 1 步 + §10.12 R30 策略感知）
  //   在自身剩余意图池内选出本回合技能序列；只推演、不执行；确定性
  //   logFn 可选：fallback 路径下用于记录「plan 引用未知技能」
  //   strategy：defensiveSpawner / aggressive / supportAggressive（缺省 aggressive）
  // ------------------------------------------------------------
  function canAffordMark(cost, marks) {
    cost = cost || {};
    return (Number(cost.jq) || 0) <= marks.jq &&
      (Number(cost.bs) || 0) <= marks.bs &&
      (Number(cost.lh) || 0) <= marks.lh;
  }
  function payMark(marks, cost) {
    cost = cost || {};
    marks.jq -= Number(cost.jq) || 0;
    marks.bs -= Number(cost.bs) || 0;
    marks.lh -= Number(cost.lh) || 0;
    return marks;
  }
  /** R30：按单位+阶段取策略（boss 用 p1/p2，小怪用 unitType；缺省 aggressive） */
  function strategyFor(S, entity) {
    var st = (S && S._strategy) || {};
    if (!entity) return 'aggressive';
    if (entity.kind === 'boss') return (entity.phase === 2 ? st.p2 : st.p1) || 'aggressive';
    return st[entity.unitType] || 'aggressive';
  }
  function isAttackSkill(skill) {
    return skillGroup(skill).group === 'attack';
  }
  /** R30：策略化技能价值（一阶段 Boss 的 damage 技能价值调低/置后） */
  function strategyScore(skill, strategy) {
    var base = skillScore(skill);
    if (strategy === 'defensiveSpawner') {
      var g = skillGroup(skill).group;
      if (g === 'attack') return base * 0.15;
      if (g === 'defense') return base * 1.3;
      return base * 1.6;
    }
    if (strategy === 'supportAggressive') {
      var effs = skill.effects || [];
      for (var i = 0; i < effs.length; i++) {
        if (effs[i].op === 'allyDamageBuff' || effs[i].op === 'selfDamageBuff') return base * 1.5;
      }
      return base;
    }
    return base;
  }
  function hasAffordableNonAttack(skills, marks) {
    for (var i = 0; i < skills.length; i++) {
      if (!isAttackSkill(skills[i]) && canAffordMark(skills[i].cost, marks)) return true;
    }
    return false;
  }
  function selectSequence(entity, logFn, strategy) {
    strategy = strategy || 'aggressive';
    var skills = (entity && entity._skills) || [];
    var plan = (entity && entity._plan) || [];
    var marks = {
      jq: Number(entity && entity.intents && entity.intents.jq) || 0,
      bs: Number(entity && entity.intents && entity.intents.bs) || 0,
      lh: Number(entity && entity.intents && entity.intents.lh) || 0
    };
    var out = [];
    var i;
    // ① plan：按顺序「尽量施展」
    var planSkills = [];
    for (i = 0; i < plan.length; i++) {
      var sk = findSkill(skills, plan[i]);
      if (!sk) {
        if (typeof logFn === 'function') logFn('error', '意图套组 plan 引用了未知技能：' + plan[i] + '（' + entity.name + '）');
        continue;
      }
      planSkills.push(sk);
    }
    // R30 一阶段 Boss：plan 内部也先 召唤/治疗/增益/防御 → 攻击
    if (strategy === 'defensiveSpawner') {
      var nonAtkPlan = [];
      var atkPlan = [];
      for (i = 0; i < planSkills.length; i++) {
        if (isAttackSkill(planSkills[i])) atkPlan.push(planSkills[i]);
        else nonAtkPlan.push(planSkills[i]);
      }
      planSkills = nonAtkPlan.concat(atkPlan);
    }
    for (i = 0; i < planSkills.length; i++) {
      var ps = planSkills[i];
      if (!canAffordMark(ps.cost, marks)) continue;
      // R30：一阶段 Boss 的攻击只在没有其他可支付技能时补
      if (strategy === 'defensiveSpawner' && isAttackSkill(ps) && hasAffordableNonAttack(skills, marks)) continue;
      payMark(marks, ps.cost);
      out.push(ps);
    }
    // ② 剩余标记：贪心补齐（策略化价值 / 消耗最高，平手按数据顺序）
    var guard = 0;
    while (guard++ < MAX_LOOPS) {
      var usable = [];
      for (i = 0; i < skills.length; i++) {
        if (canAffordMark(skills[i].cost, marks)) usable.push(skills[i]);
      }
      if (!usable.length) break;
      if (strategy === 'defensiveSpawner') {
        var nonAtk = [];
        for (i = 0; i < usable.length; i++) if (!isAttackSkill(usable[i])) nonAtk.push(usable[i]);
        if (nonAtk.length) usable = nonAtk; // 攻击仅在无其他可支付技能时补
      }
      var best = usable[0];
      var bestScore = strategyScore(usable[0], strategy);
      for (i = 1; i < usable.length; i++) {
        var sc = strategyScore(usable[i], strategy);
        if (sc > bestScore + 1e-9) { best = usable[i]; bestScore = sc; }
      }
      payMark(marks, best.cost);
      out.push(best);
    }
    return out;
  }

  // ------------------------------------------------------------
  // 攻击段估算（针对玩家当前防御状态：闪避逐层、格挡池、化劲一次性）
  // ------------------------------------------------------------
  function clonePlayerDef(p) {
    return {
      dodge: Math.max(0, Number(p && p.dodge) || 0),
      block: Math.max(0, Number(p && p.block) || 0),
      hua: Math.max(0, Number(p && p.hua) || 0),
      hp: Math.max(0, Number(p && p.hp) || 0)
    };
  }
  /** 单段对玩家结算（与引擎 resolveDamage 同规则），返回实际伤害 */
  function applySegmentToDef(st, amount) {
    if (st.hp <= 0) return 0;
    var remain = Math.max(0, Number(amount) || 0);
    if (remain <= 0) return 0;
    if (st.dodge > 0) { st.dodge -= 1; return 0; }
    if (st.block > 0) {
      var b = Math.min(st.block, remain);
      st.block -= b;
      remain -= b;
    }
    if (st.hua > 0 && remain > 0) {
      var h = Math.min(st.hua, remain);
      st.hua = 0;
      remain -= h;
    }
    var dealt = Math.min(remain, st.hp);
    st.hp -= dealt;
    return dealt;
  }
  function attackSegments(skill, dmgBonus) {
    var segs = [];
    var effs = (skill && skill.effects) || [];
    var bonus = Number(dmgBonus) || 0;
    for (var i = 0; i < effs.length; i++) {
      var op = effs[i];
      var v = Math.max(0, (Number(op.v) || 0) + bonus);
      if (op.op === 'damage') segs.push(v);
      else if (op.op === 'multiDamage') {
        var times = Math.max(1, Number(op.times) || 1);
        for (var t = 0; t < times; t++) segs.push(v);
      }
    }
    return segs;
  }
  function evalOrder(entries, player) {
    var st = clonePlayerDef(player);
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      var segs = entries[i].segments || [];
      for (var j = 0; j < segs.length; j++) {
        total += applySegmentToDef(st, segs[j]);
        if (st.hp <= 0) return total;
      }
    }
    return total;
  }
  /** 攻击组排序：贪心选边际伤害最大 + 相邻交换局部搜索（确定性） */
  function orderAttacks(entries, player) {
    if (entries.length <= 1) return entries.slice();
    var remaining = entries.slice();
    var ordered = [];
    var st = clonePlayerDef(player);
    while (remaining.length) {
      var bestIdx = 0;
      var bestGain = -1;
      var bestFirstSeg = Infinity;
      for (var i = 0; i < remaining.length; i++) {
        var st2 = clonePlayerDef(st);
        var gain = 0;
        var segs = remaining[i].segments || [];
        for (var j = 0; j < segs.length; j++) {
          gain += applySegmentToDef(st2, segs[j]);
          if (st2.hp <= 0) break;
        }
        var firstSeg = segs.length ? segs[0] : 0;
        // 边际伤害相同（如闪避把各攻击都挡成 0）时：优先「首段更小」的招式先吃闪避/化劲，
        // 这是让总伤害最大的关键 tie-break；仍平手则保持数据顺序（确定性）
        if (gain > bestGain + 1e-9 ||
          (Math.abs(gain - bestGain) <= 1e-9 && firstSeg < bestFirstSeg - 1e-9)) {
          bestGain = gain;
          bestFirstSeg = firstSeg;
          bestIdx = i;
        }
      }
      var chosen = remaining.splice(bestIdx, 1)[0];
      ordered.push(chosen);
      var chosenSegs = chosen.segments || [];
      for (var k = 0; k < chosenSegs.length; k++) applySegmentToDef(st, chosenSegs[k]);
    }
    // 相邻交换局部搜索（只接受严格变好，保证确定性）
    var improved = true;
    var passes = 0;
    while (improved && passes++ < 30) {
      improved = false;
      for (var m = 0; m + 1 < ordered.length; m++) {
        var before = evalOrder(ordered, player);
        var tmp = ordered[m];
        ordered[m] = ordered[m + 1];
        ordered[m + 1] = tmp;
        var after = evalOrder(ordered, player);
        if (after > before + 1e-9) {
          improved = true;
        } else {
          var tmp2 = ordered[m];
          ordered[m] = ordered[m + 1];
          ordered[m + 1] = tmp2;
        }
      }
    }
    return ordered;
  }

  // ------------------------------------------------------------
  // 回合调度（SPEC §10.11.3 R29 + §10.12 R30）：AI.planTurn(S) → 本回合施展顺序
  //   策略：defensiveSpawner（一阶段 Boss）自保+招怪，攻击延后且不局部最优；
  //         aggressive 攻击组局部最优；supportAggressive 蟹将 buff 先手。
  //   返回 [{enemyId, skillId, group}]，确定性、无随机
  // ------------------------------------------------------------
  function planTurn(S) {
    if (!S || !S.enemies) return [];
    var entries = [];
    var ei, e;
    // ① 各敌人推算技能序列（按策略调价值/顺序）
    for (ei = 0; ei < S.enemies.length; ei++) {
      e = S.enemies[ei];
      if (!e || !e.alive || (Number(e.hp) || 0) <= 0) continue;
      if (e.kind === 'minion' && (Number(e.mcTurns) || 0) > 0) continue;
      var marks = (e.intents && ((Number(e.intents.jq) || 0) + (Number(e.intents.bs) || 0) + (Number(e.intents.lh) || 0))) || 0;
      if (marks <= 0) continue;
      var strat = strategyFor(S, e);
      var seq = selectSequence(e, null, strat);
      for (var si = 0; si < seq.length; si++) {
        entries.push({
          enemyId: e.id,
          skillId: seq[si].id,
          skill: seq[si],
          entity: e,
          entityIndex: ei,
          seqIndex: si,
          strategy: strat,
          groupInfo: skillGroup(seq[si])
        });
      }
    }
    // ② 估算「攻击组之前」的增益效果（组合/增益组的 allyDamageBuff 会影响后续攻击段）
    var bonus = {};
    for (ei = 0; ei < S.enemies.length; ei++) {
      e = S.enemies[ei];
      if (e) bonus[e.id] = Number(e.dmgBonus) || 0;
    }
    for (var bi = 0; bi < entries.length; bi++) {
      var en = entries[bi];
      if (en.groupInfo.group === 'attack') continue;
      var effs = en.skill.effects || [];
      for (var oi = 0; oi < effs.length; oi++) {
        var op = effs[oi];
        if (op.op !== 'allyDamageBuff') continue;
        var v = Number(op.v) || 0;
        for (var ti = 0; ti < S.enemies.length; ti++) {
          var t = S.enemies[ti];
          if (!t || !t.alive) continue;
          if (op.unit && t.unitType !== op.unit) continue;
          bonus[t.id] = (bonus[t.id] || 0) + v;
        }
      }
    }
    // ③ 分组：非攻击组按 rank/敌人顺序/技能顺序；
    //    攻击组：普通单位做局部最优；defensiveSpawner（一阶段 Boss）的攻击
    //    延后到所有其他单位攻击之后，且保持数据顺序（不做局部最优）。
    var nonAttack = [];
    var attacks = [];
    var deferredAttacks = [];
    for (var qi = 0; qi < entries.length; qi++) {
      var entry = entries[qi];
      if (entry.groupInfo.group === 'attack') {
        entry.segments = attackSegments(entry.skill, bonus[entry.enemyId] || 0);
        if (entry.strategy === 'defensiveSpawner') deferredAttacks.push(entry);
        else attacks.push(entry);
      } else {
        nonAttack.push(entry);
      }
    }
    nonAttack.sort(function (a, b) {
      if (a.groupInfo.rank !== b.groupInfo.rank) return a.groupInfo.rank - b.groupInfo.rank;
      if (a.groupInfo.group === 'priority' && b.groupInfo.group === 'priority' &&
        a.groupInfo.priority !== b.groupInfo.priority) {
        return a.groupInfo.priority - b.groupInfo.priority;
      }
      if (a.entityIndex !== b.entityIndex) return a.entityIndex - b.entityIndex;
      return a.seqIndex - b.seqIndex;
    });
    var orderedAttacks = orderAttacks(attacks, S.player || {});
    deferredAttacks.sort(function (a, b) {
      if (a.entityIndex !== b.entityIndex) return a.entityIndex - b.entityIndex;
      return a.seqIndex - b.seqIndex;
    });
    var finalList = nonAttack.concat(orderedAttacks, deferredAttacks);
    var out = [];
    for (var fi = 0; fi < finalList.length; fi++) {
      out.push({
        enemyId: finalList[fi].enemyId,
        skillId: finalList[fi].skillId,
        group: finalList[fi].groupInfo.group
      });
    }
    return out;
  }

  // ------------------------------------------------------------
  // 旧路径：单个敌人用完自己的行动（引擎在无 planTurn/异常时回退用）
  // ------------------------------------------------------------
  function runAction(ctx, entity) {
    var strat = (typeof ctx.strategyOf === 'function') ? ctx.strategyOf(entity) : 'aggressive';
    var seq = selectSequence(entity, ctx.log, strat);
    var cast = 0;
    for (var i = 0; i < seq.length; i++) {
      if (ctx.over()) return;
      if (castSkill(ctx, entity, seq[i])) cast++;
    }
    if (cast === 0) {
      ctx.log('system', entity.name + ' 剩余标记不足以施展任何技能，意图作废');
    }
  }

  AI.runAction = runAction;
  AI.castSkill = castSkill;
  AI.executeOps = executeOps;
  AI.skillScore = skillScore;
  AI.skillValue = skillValue;
  AI.describeSkill = describeSkill;
  AI.skillCost = skillCost;
  AI.skillGroup = skillGroup;
  AI.selectSequence = selectSequence;
  AI.attackSegments = attackSegments;
  AI.applySegmentToDef = applySegmentToDef;
  AI.strategyFor = strategyFor;
  AI.strategyScore = strategyScore;
  AI.planTurn = planTurn;
})(typeof window !== 'undefined' ? window : globalThis);
