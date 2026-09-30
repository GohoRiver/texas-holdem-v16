window.PokerEval = (function(){
  function combos(arr, k){
    const res = [];
    (function h(s, c){
      if(c.length === k){ res.push(c.slice()); return; }
      for(let i = s; i < arr.length; i++){
        c.push(arr[i]); h(i + 1, c); c.pop();
      }
    })(0, []);
    return res;
  }

  function evalFive(cards){
    const cs = cards.slice().sort(function(a, b){ return b.value - a.value; });
    const values = cs.map(function(c){ return c.value; });
    const suits = cs.map(function(c){ return c.suit; });
    const flush = suits.every(function(s){ return s === suits[0]; });

    let isStraight = false, straightHigh = 0;
    const uniq = [...new Set(values)].sort(function(a, b){ return b - a; });
    if(uniq.length >= 5){
      for(let i = 0; i <= uniq.length - 5; i++){
        const seq = uniq.slice(i, i + 5);
        if(seq[0] - seq[4] === 4){ isStraight = true; straightHigh = seq[0]; break; }
      }
      if(!isStraight && uniq.indexOf(14) !== -1){
        const mapped = uniq.map(function(v){ return v === 14 ? 1 : v; })
          .sort(function(a, b){ return b - a; });
        for(let i = 0; i <= mapped.length - 5; i++){
          const seq = mapped.slice(i, i + 5);
          if(seq[0] - seq[4] === 4){
            isStraight = true;
            straightHigh = (seq[0] === 1 ? 5 : seq[0]);
            break;
          }
        }
      }
    }

    const counter = {};
    for(let i = 0; i < cs.length; i++){
      const v = cs[i].value;
      counter[v] = (counter[v] || 0) + 1;
    }
    const groups = Object.keys(counter).map(function(k){
      return [parseInt(k, 10), counter[k]];
    });
    groups.sort(function(a, b){
      return b[1] === a[1] ? b[0] - a[0] : b[1] - a[1];
    });

    let rank = 1, score = [];
    if(flush && isStraight){ rank = 9; score = [straightHigh]; }
    else if(groups[0][1] === 4){
      rank = 8; score = [groups[0][0]];
      score.push(values.filter(function(v){ return v !== groups[0][0]; })[0]);
    }
    else if(groups[0][1] === 3 && groups[1] && groups[1][1] >= 2){
      rank = 7; score = [groups[0][0], groups[1][0]];
    }
    else if(flush){ rank = 6; score = values.slice(0, 5); }
    else if(isStraight){ rank = 5; score = [straightHigh]; }
    else if(groups[0][1] === 3){
      rank = 4; score = [groups[0][0]];
      score.push.apply(score, values.filter(function(v){ return v !== groups[0][0]; }).slice(0, 2));
    }
    else if(groups[0][1] === 2 && groups[1] && groups[1][1] === 2){
      rank = 3; score = [groups[0][0], groups[1][0]];
      score.push(values.filter(function(v){
        return v !== groups[0][0] && v !== groups[1][0];
      })[0]);
    }
    else if(groups[0][1] === 2){
      rank = 2; score = [groups[0][0]];
      score.push.apply(score, values.filter(function(v){ return v !== groups[0][0]; }).slice(0, 3));
    }
    else { rank = 1; score = values.slice(0, 5); }
    return [rank].concat(score);
  }

  function compare(a, b){
    const n = Math.max(a.length, b.length);
    for(let i = 0; i < n; i++){
      const x = a[i] || 0, y = b[i] || 0;
      if(x > y) return 1;
      if(x < y) return -1;
    }
    return 0;
  }

  function bestHand(cards){
    if(cards.length < 5) return null;
    const cs = combos(cards, 5);
    let best = null, bestCombo = null;
    for(let i = 0; i < cs.length; i++){
      const s = evalFive(cs[i]);
      if(best === null || compare(s, best) > 0){ best = s; bestCombo = cs[i]; }
    }
    return { score: best, cards: bestCombo };
  }

  const NAME_KEYS = {
    1: "handHighCard", 2: "handPair", 3: "handTwoPair", 4: "handTrips",
    5: "handStraight", 6: "handFlush", 7: "handFullHouse", 8: "handQuads",
    9: "handStraightFlush"
  };
  function nameOf(score){
    if(!score) return "";
    const key = NAME_KEYS[score[0]] || "";
    return (window.PokerI18n) ? window.PokerI18n.t(key) : key;
  }

  function aiScore(score){
    if(!score) return 0;
    const base = {1:10, 2:26, 3:45, 4:60, 5:72, 6:78, 7:88, 8:95, 9:100};
    const kicker = score[1] || 0;
    return (base[score[0]] || 10) + (kicker / 14) * 4;
  }

  // ---------- 听牌识别 ----------
  // 返回 { flushDraw, straightDraw, combo, backdoorFlush, backdoorStraight }
  //   flushDraw: 有 4 张同花（缺一张）
  //   straightDraw: 0=无, 1=卡顺, 2=两头顺
  //   combo: 同花听牌 + 顺子听牌 同时存在
  //   backdoorFlush: 3 张同花（后门）
  //   backdoorStraight: 3 张连续（后门）
  function detectDraws(holeCards, community){
    const all = holeCards.concat(community);
    const res = {
      flushDraw: false, straightDraw: 0, combo: false,
      backdoorFlush: false, backdoorStraight: false
    };
    if(all.length < 4) return res;

    // 同花
    const suitCount = {};
    all.forEach(function(c){ suitCount[c.suit] = (suitCount[c.suit] || 0) + 1; });
    Object.keys(suitCount).forEach(function(s){
      const n = suitCount[s];
      if(n === 4) res.flushDraw = true;
      else if(n === 3) res.backdoorFlush = true;
    });

    // 顺子
    const vals = [...new Set(all.map(function(c){ return c.value; }))].sort(function(a,b){ return a-b; });
    if(vals.indexOf(14) !== -1) vals.unshift(1);
    // 去重后再排序
    const uniq = [...new Set(vals)].sort(function(a,b){ return a-b; });

    for(let i = 0; i <= uniq.length - 4; i++){
      const span = uniq[i + 3] - uniq[i];
      if(span === 3){
        // 4 张连续 → 两头顺
        res.straightDraw = 2;
      } else if(span === 4 && res.straightDraw < 1){
        // 4 张跨度 4 → 卡顺
        res.straightDraw = 1;
      }
    }
    // 后门顺子：3 张连续
    if(res.straightDraw === 0){
      for(let i = 0; i <= uniq.length - 3; i++){
        if(uniq[i + 2] - uniq[i] === 2){ res.backdoorStraight = true; break; }
      }
    }

    res.combo = res.flushDraw && res.straightDraw > 0;
    return res;
  }

  return {
    bestHand: bestHand,
    compare: compare,
    nameOf: nameOf,
    aiScore: aiScore,
    evalFive: evalFive,
    detectDraws: detectDraws
  };
})();