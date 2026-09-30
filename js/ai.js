window.PokerAI = (function(){
  const STYLES = {
    TAG:     { name:"styleTAG",     tag:"TAG",     foldTh:58, raiseTh:70, bluff:0.14, callTh:42, aggr:0.75, drawBias:1.0 },
    LAG:     { name:"styleLAG",     tag:"LAG",     foldTh:42, raiseTh:55, bluff:0.30, callTh:28, aggr:0.90, drawBias:1.3 },
    Nit:     { name:"styleNit",     tag:"Nit",     foldTh:72, raiseTh:85, bluff:0.03, callTh:62, aggr:0.35, drawBias:0.7 },
    Station: { name:"styleStation", tag:"Station", foldTh:22, raiseTh:82, bluff:0.02, callTh:14, aggr:0.20, drawBias:1.1 },
    Maniac:  { name:"styleManiac",  tag:"Maniac",  foldTh:12, raiseTh:38, bluff:0.40, callTh:8,  aggr:0.95, drawBias:1.4 }
  };

  const HAND_TABLE = {
    "AA":100,"KK":95,"QQ":90,"JJ":84,"TT":78,"99":72,"88":66,"77":60,"66":55,"55":50,"44":45,"33":42,"22":40,
    "AKs":88,"AQs":84,"AJs":79,"ATs":75,"A9s":68,"A8s":66,"A7s":64,"A6s":62,"A5s":63,"A4s":62,"A3s":61,"A2s":60,
    "KQs":82,"KJs":78,"KTs":74,"K9s":68,"K8s":62,"K7s":58,"K6s":56,"K5s":54,"K4s":52,"K3s":50,"K2s":48,
    "QJs":76,"QTs":72,"Q9s":66,"Q8s":60,"Q7s":56,"Q6s":52,"Q5s":50,"Q4s":48,"Q3s":46,"Q2s":44,
    "JTs":74,"J9s":66,"J8s":60,"J7s":54,"J6s":50,"J5s":48,"J4s":46,"J3s":44,"J2s":42,
    "T9s":68,"T8s":60,"T7s":54,"T6s":48,"T5s":44,"T4s":42,
    "98s":60,"97s":54,"96s":48,"95s":44,"94s":40,
    "87s":56,"86s":50,"85s":45,"84s":40,
    "76s":52,"75s":47,"74s":40,
    "65s":50,"64s":44,"63s":40,
    "54s":48,"53s":42,"52s":38,
    "43s":42,"42s":36,"32s":34,
    "AKo":74,"AQo":70,"AJo":64,"ATo":60,"A9o":54,"A8o":50,"A7o":47,"A6o":45,"A5o":44,"A4o":43,"A3o":42,"A2o":40,
    "KQo":68,"KJo":62,"KTo":58,"K9o":52,"K8o":47,"K7o":44,"K6o":42,"K5o":40,"K4o":38,"K3o":37,"K2o":36,
    "QJo":62,"QTo":56,"Q9o":50,"Q8o":45,"Q7o":42,"Q6o":40,"Q5o":38,"Q4o":36,
    "JTo":58,"J9o":52,"J8o":45,"J7o":40,"J6o":38,
    "T9o":54,"T8o":46,"T7o":42,"T6o":38,
    "98o":46,"97o":42,"96o":38,
    "87o":44,"86o":40,"85o":36,
    "76o":42,"75o":38,
    "65o":40,"64o":36,
    "54o":38,"53o":34,
    "43o":34,"42o":30,"32o":28
  };

  const POSITION_BONUS = {
    "BTN": 15, "CO": 8, "HJ": 3, "UTG": -12, "UTG+1": -8,
    "MP": -4, "SB": 5, "BB": 10, "BTN/SB": 8
  };

  function handKey(c1, c2){
    const v1 = c1.value, v2 = c2.value;
    const hi = v1 >= v2 ? c1 : c2;
    const lo = v1 >= v2 ? c2 : c1;
    const suited = c1.suit === c2.suit;
    if(v1 === v2) return hi.rank + lo.rank;
    return hi.rank + lo.rank + (suited ? "s" : "o");
  }

  function startingHandScore(cards){
    const key = handKey(cards[0], cards[1]);
    if(HAND_TABLE[key] !== undefined) return HAND_TABLE[key];
    const c1 = cards[0], c2 = cards[1];
    const hi = Math.max(c1.value, c2.value);
    const lo = Math.min(c1.value, c2.value);
    const suited = c1.suit === c2.suit;
    let score = (hi - 2) * 2.8 + (lo - 2) * 1.5;
    if(suited) score += 6;
    const gap = hi - lo;
    if(gap === 1) score += 4;
    else if(gap >= 5) score -= 3;
    return Math.max(0, Math.min(100, score));
  }

  /* ---------- 鱿鱼桌风格调整 ----------
     没有鱿鱼的玩家 → 更激进（更少弃牌、更多加注、更多诈唬）
     有 3+ 鱿鱼的玩家 → 更保守（更容易弃牌）
     中间状态 → 略微激进 */
  function adjustStyleForSquid(style, player, G){
    if(!G.squid || !G.squid.enabled) return style;
    const n = (player.squids || []).length;
    const s = Object.assign({}, style);
    if(n === 0){
      // 无鱼玩家：拼命模式
      s.aggr = Math.min(1.0, (style.aggr || 0.5) * 1.55);
      s.bluff = Math.min(0.6, (style.bluff || 0) + 0.18);
      s.foldTh = Math.max(5, (style.foldTh || 50) - 20);
      s.callTh = Math.max(5, (style.callTh || 40) - 15);
    } else if(n >= 3){
      // 多条鱿鱼：保守模式
      s.aggr = (style.aggr || 0.5) * 0.78;
      s.bluff = Math.max(0, (style.bluff || 0) - 0.05);
      s.foldTh = Math.min(90, (style.foldTh || 50) + 10);
    } else {
      // 1-2 条：略微激进
      s.aggr = Math.min(1.0, (style.aggr || 0.5) * 1.1);
    }
    return s;
  }

  function preflop(player, G){
    const style = adjustStyleForSquid(STYLES[player.styleKey], player, G);
    let score = startingHandScore(player.holeCards);
    score += POSITION_BONUS[player.position] || 0;
    const toCall = Math.max(0, G.currentBet - player.currentBet);
    const potOdds = toCall > 0 ? toCall / (G.pot + toCall) : 0;
    if(player.chips < G.bigBlind * 3) score -= 8;

    if(toCall === 0){
      if(score >= style.raiseTh && Math.random() < style.aggr) return { type: "raise" };
      if(Math.random() < style.bluff * 0.5) return { type: "raise" };
      return { type: "check" };
    }
    if(score < style.foldTh){
      if(style.tag === "Station" || style.tag === "Maniac"){
        if(toCall <= player.chips * 0.1 && Math.random() < 0.7) return { type: "call" };
      }
      return { type: "fold" };
    }
    if(score >= style.raiseTh && Math.random() < style.aggr) return { type: "raise" };
    if(score >= style.callTh || potOdds < 0.25) return { type: "call" };
    return { type: "fold" };
  }

  function postflop(player, G){
    const style = adjustStyleForSquid(STYLES[player.styleKey], player, G);
    const all = player.holeCards.concat(G.community);
    const result = PokerEval.bestHand(all);
    let score = PokerEval.aiScore(result ? result.score : null);
    score += (POSITION_BONUS[player.position] || 0) * 0.4;

    const toCall = Math.max(0, G.currentBet - player.currentBet);
    const potOdds = toCall > 0 ? toCall / (G.pot + toCall) : 0;

    const draws = PokerEval.detectDraws(player.holeCards, G.community);
    let drawBonus = 0;
    if(draws.flushDraw) drawBonus += 12;
    if(draws.straightDraw === 2) drawBonus += 10;
    else if(draws.straightDraw === 1) drawBonus += 5;
    if(draws.combo) drawBonus += 8;
    if(draws.backdoorFlush) drawBonus += 2;
    if(draws.backdoorStraight) drawBonus += 1;
    drawBonus *= (style.drawBias || 1.0);

    let impliedBonus = 0;
    if(drawBonus >= 10 && potOdds < 0.35 && toCall > 0 && toCall <= player.chips * 0.3){
      impliedBonus = 8;
    }
    if(drawBonus > 0 && player.chips > G.pot * 2) impliedBonus += 4;

    const scoreForDecision = score + drawBonus + impliedBonus;

    if(toCall === 0){
      if(scoreForDecision >= 60 || Math.random() < style.bluff) return { type: "raise" };
      if(drawBonus >= 15 && Math.random() < 0.5) return { type: "raise" };
      return { type: "check" };
    }

    if(scoreForDecision < style.foldTh - 15){
      if(style.tag === "Station" && toCall <= player.chips * 0.15 && Math.random() < 0.75) return { type: "call" };
      if(style.tag === "Maniac" && Math.random() < 0.4) return { type: "call" };
      if(drawBonus >= 12 && potOdds < 0.3 && toCall <= player.chips * 0.2) return { type: "call" };
      return { type: "fold" };
    }

    if(scoreForDecision >= style.raiseTh && Math.random() < style.aggr) return { type: "raise" };
    if(drawBonus >= 15 && Math.random() < style.aggr * 0.6) return { type: "raise" };

    if(scoreForDecision >= style.callTh || potOdds < 0.25) return { type: "call" };
    return { type: "fold" };
  }

  function decide(player, G){
    if(G.stage === "preflop") return preflop(player, G);
    return postflop(player, G);
  }

  return {
    STYLES: STYLES,
    decide: decide,
    startingHandScore: startingHandScore,
    POSITION_BONUS: POSITION_BONUS,
    handKey: handKey
  };
})();