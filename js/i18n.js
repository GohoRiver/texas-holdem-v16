window.PokerI18n = (function(){
  const T = {
    zh: {
      navLobby:"大厅", navRules:"规则", navMyNumbers:"我的数据",
      noTables:"0 桌开放", connectWallet:"连接钱包", backToLobby:"大厅",
      tabAi:"AI 练习场", tabPoints:"积分场 · 真人", tabReal:"链上场 · BEM",

      aiBadge:"单机练习 · 无限筹码",
      aiTitle:"无限筹码<br>随便练手",
      aiDesc:"和 AI 对手打牌，不花钱、不注册、不需要钱包。适合熟悉规则、练习 GTO 打法。",
      quickSeat:"⚡ 快速入座", howToPlay:"怎么玩？", youLabel:"你",
      miniPot:"底池 12,400", justNow:"刚刚",
      ticker1:"玩家9021 在 AI 练习场赢下 +5,834", ticker2:"玩家7745 完成 100 手练习",
      ticker3:"玩家0092 在 AI 练习场赢下 +3,566", ticker4:"玩家2210 在 AI 练习场赢下 +500",
      chooseLevel:"选择盲注等级", tableSeats:"桌人数", seatsUnit:"人",
      practiceStats:"练习统计", statHands:"手数", statWinRate:"胜率", statNet:"净盈亏",
      modeInfo:"模式说明", aiInfo:"无限筹码，和 AI 对手打。没有钱包、没有充值，纯练习。",
      myAiChips:"我的 AI 场筹码", aiWinTotal:"累计赢得", rebuy:"补码",
      aiRebuyNote:"筹码跨局累积；赢的每一分都算进总额",

      pointsBadge:"积分场 · 真人 · 不花钱也能玩",
      pointsTitle:"真人同桌<br>不花钱也能玩",
      pointsDesc:"和真人同桌打。创建一个房间，把房间号发给朋友即可同桌。",
      claimPoints:"🎁 领取今天的 100,000 积分", myPoints:"我的积分", streak:"连续签到",
      pointsNote:"积分只用来玩，不能充值、提现，也不能换成 BEM",
      pointsStorageWarning:"⚠️ 积分保存在本浏览器，换设备或清除数据后会丢失。想跨设备保留请连接钱包。",
      pointsTables:"积分牌桌（真人对战 · 2-7 人）",

      realBadge:"全链上 · BEM 结算 · 真人",
      realTitle:"真金白银<br>链上公平",
      realDesc:"连接币安 Web3 钱包，充 BEM 换筹码，和真人同桌打。P2P 直连 + 链上结算。",
      walletBem:"钱包 BEM 余额", realBalance:"对战场筹码", walletAddr:"钱包地址",
      deposit:"充值", depositNote:"最低 0.001 BEM；充值收 2% 手续费",
      withdraw:"提现", withdrawNote:"最低 0.0001 BEM（= 1 筹码）",
      realTables:"链上牌桌（真人对战 · 2-7 人）",

      createRoom:"创建房间",
      joinRoom:"加入房间",
      joinRoomTitle:"加入房间",
      joinRoomDesc:"输入朋友分享的房间号：",
      join:"加入",
      roomsCount:"{n} 桌",
      noRooms:"暂无房间",

      footer1:"1 筹码 = 0.0001 BEM。抽水只在看到翻牌的牌局中收取：底池的 1%，上限 1 个大盲。",
      footer2:"发牌使用平台随机数系统，链上仅负责 BEM 充提；每手牌局可事后复盘。",

      rulesTitle:"发牌：任何人都能看到每手牌的最终结果",
      rulesDesc:"牌局由平台随机数系统发牌；链上仅负责 BEM 的充值和提现，不参与每一手牌。",
      rule1Title:"发牌", rule1Body:"平台使用系统随机数生成器（加密随机源）洗牌、发牌。每手结束后，全部玩家的底牌与公共牌都会记录，供复盘。",
      rule2Title:"复盘", rule2Body:"每手结束后，本地保存本手记录（底牌、公共牌、最终成牌、输赢）。在「我的数据」页面可查看最近 50 手牌局记录。",
      rule3Title:"筹码与抽水", rule3Body:"1 筹码 = 0.0001 BEM。链上场充值把 BEM 换成平台筹码，提现把筹码换回 BEM。抽水只在看到翻牌的牌局中收取：底池的 1%，上限 1 个大盲。",
      rule4Title:"三种模式", rule4Body:"AI 练习场：单机，和 4-7 个 AI 对手打，无限筹码。积分场：P2P 真人联机，2-7 人开桌，每天领 100,000 积分。链上场：P2P 真人联机 + 平台内筹码，充提走 BEM。",
      rule5Title:"充值 / 提现", rule5Body:"充值：最低 0.001 BEM，调用合约 deposit 存入（2% 手续费），平台换算为对战场筹码。提现：最低 0.0001 BEM，按 1 筹码 = 0.0001 BEM 比例，调用合约 withdraw 把 BEM 提回钱包。",
      rule6Title:"断线不能赖账", rule6Body:"轮到你下注 30 秒无回应，按弃牌处理。刷新页面不会丢座：45 秒内回来，页面会从本地快照接上。",
      rule7Title:"你在信任什么", rule7Body:"牌：由平台随机数系统发牌，无法证明给第三方。钱：链上只做充提，合约托管 BEM，只有你本人能提。筹码：局内筹码由平台记账。",
      rule8Title:"和其他线上德州扑克不一样的地方", rule8Body:"充值/提现走链上，钱不会被平台单方面拿走。发牌虽在平台内，但每手记录可复盘、可查看。三种模式共用一个账号，切换无成本。",

      faqTitle:"你可能会问的问题",
      faq1Q:"运营方能不能看牌、出千？", faq1A:"发牌由平台随机数系统完成，运营方无法预先知道结果。链上只能证明 BEM 的充提，不能证明发牌公平。",
      faq2Q:"为什么不用链上洗牌？", faq2A:"链上每手都要生成密钥、加密、置换、广播，gas 成本极高。我们把链上部分收敛为「充值和提现」，其余在平台内完成，成本大幅降低。",
      faq3Q:"能不能有人串通？", faq3A:"能，和任何线上牌桌一样。平台无法判断几个人是否联手下注，但每手记录都会保留，事后可复盘查看。",
      faq4Q:"桌上会不会有机器人？", faq4A:"AI 练习场有 AI 对手，这是设计的一部分。积分场和链上场是真人 P2P 联机。",
      faq5Q:"网络不好会不会吃亏？", faq5A:"轮到你下注 30 秒没回应，按弃牌并在这手后离桌。刷新页面 45 秒内回来可以接着打。",
      faq6Q:"钱放在哪，运营方跑路怎么办？", faq6A:"链上场的 BEM 托管在你部署的合约里（地址 0x19fA…c2c3），只有 deposit 和 withdraw 两个函数。运营方消失也不影响你随时提回 BEM。",
      faq7Q:"要付什么费用？", faq7A:"链上场充值时收 2% 手续费；提现只付 BSC 网络 gas。AI 场和积分场完全免费。",
      faq8Q:"抽水去了哪里？", faq8A:"链上牌桌的抽水按 1% 计算，封顶 1 个大盲，从主池扣除，进入合约公示的抽水收款地址。",
      faq9Q:"合约审计过吗？", faq9A:"没有经过独立审计。请按“未审计的合约”来看待它：先小金额试。",
      faq10Q:"我的隐私呢？", faq10A:"你的钱包地址和充提记录是公开的。牌局记录保存在本浏览器，不公开。",
      faq11Q:"积分场和链上场是真人吗？", faq11A:"都是真人。积分场用 P2P 直连，链上场在 P2P 基础上加了 BEM 充提。",
      faq12Q:"手机怎么玩？", faq12A:"用 Chrome 或 Safari 打开这个地址，点“连接钱包”会弹出 WalletConnect。牌桌是横屏布局，建议把手机横过来玩，点击右上角 ⛶ 可以进入全屏。",
      faq13Q:"这合法吗？", faq13A:"各地法规不同，请先确认你所在地允许，再决定是否参与。",

      myNumbersTitle:"我的数据", myNumbersSub:"0 桌 · 钱包 未连接",
      statTotalPnl:"总盈亏（筹码）", statTables:"打过的桌", statWinRate2:"赢下底池的比例",
      statBiggest:"最大底池", statTotalBuyIn:"累计买入", statTotalCashout:"累计取回",
      curveHint:"打过两桌以上会画出累计曲线", sessionsHeading:"桌次",
      colTable:"桌", colBlinds:"盲注", colBuyIn:"买入", colCashout:"取回",
      colPnl:"盈亏", colHands:"手数", colWon:"赢下", colStatus:"状态",
      resetNumbers:"清空战绩",
      handHistoryHeading:"最近牌局（复盘）", clearHistory:"清空",

      logTitle:"牌局记录", handInfoTitle:"本手信息", dealer:"荷官",
      potLabel:"底池", sidePotLabel:"边池", yourHand:"你的手牌", nextHand:"下一手",
      preset2x:"2×", preset3x:"3×", preset4x:"4×",
      presetQuarter:"1/4 池", presetThird:"1/3 池",
      presetHalf:"1/2 池", presetTwoThird:"2/3 池",
      presetThreeQuarter:"3/4 池", presetPot:"底池", presetAllin:"全下",
      cancel:"取消", confirm:"确认", rebuyTitle:"筹码耗尽", rebuyContinue:"补码继续", leaveTable:"离桌",
      rebuyMsg:"你的筹码用完了。补码继续，或离桌返回大厅。", gameOverTitle:"对局结束",
      walletTitle:"连接钱包", walletDesc:"请用币安 Web3 钱包或 MetaMask 连接 BNB Chain。",

      actionFold:"弃牌", actionCheck:"过牌", actionCall:"跟注",
      actionBet:"下注", actionRaiseTo:"加注到", actionRaise:"加注…", actionBetMenu:"下注…",
      stagePreflop:"翻牌前", stageFlop:"翻牌", stageTurn:"转牌", stageRiver:"河牌", stageShowdown:"摊牌",
      handNum:"第 {n} 手", dealerIs:"庄家 {name}", blindsAre:"盲注 {sb} / {bb}",
      handShortLabel:"第 {n} 手",
      sbBet:"小盲 {name} 下注 {amt}，大盲 {name2} 下注 {amt2}",
      playerFolds:"{name} 弃牌", playerChecks:"{name} 过牌",
      playerCalls:"{name} 跟注 {amt}", playerBets:"{name} 下注 {amt}",
      playerRaises:"{name} 加注到 {amt}",
      flopIs:"翻牌：{cards}", turnIs:"转牌：{card}", riverIs:"河牌：{card}",
      showdownHeader:"--- 摊牌 ---", reveals:"{name} 亮牌：{cards}",
      handResult:"{name}：{cards} → {hand}",
      winsPot:"{name} 赢得 {pot}（其他玩家全部弃牌）",
      winsPotSide:"{name} 赢得 {potLabel} {amt}（{hand}）",
      pot:"底池", mainPot:"主池", sidePot:"边池", chips:"筹码", hand:"手",
      infoHand:"手数", infoStage:"阶段", infoPot:"底池",
      infoYourBet:"你的下注", infoToCall:"需跟注",
      orderPreflopShort:"翻前", orderPostflopShort:"翻后",
      timeoutFold:"{name} 思考超时，自动弃牌",
      handHighCard:"高牌", handPair:"一对", handTwoPair:"两对",
      handTrips:"三条", handStraight:"顺子", handFlush:"同花",
      handFullHouse:"葫芦", handQuads:"四条", handStraightFlush:"同花顺",
      styleTAG:"紧凶", styleLAG:"松凶", styleNit:"紧弱",
      styleStation:"跟注站", styleManiac:"疯狂型",
      posBTNSB:"BTN/SB", posBTN:"BTN", posSB:"SB", posBB:"BB",
      posUTG:"UTG", posUTG1:"UTG+1", posHJ:"HJ", posCO:"CO", posMP:"MP",
      handShort:"手牌",

      /* ★ 聊天 & 对局记录 */
      chatTitle:"聊天",
      chatPlaceholder:"说点什么...",
      chatSend:"发送",
      ingameHistoryTitle:"对局记录",
      quickNice:"好牌",
      quickThanks:"谢谢",
      quickBluff:"偷鸡吗?",
      quickAngry:"!!!!!😡",

      waitingRoomTitle:"联机等待室", roomCode:"房间号", copy:"复制",
      playersOnline:"在线人数", ready:"准备好了", waitingHint:"至少需要 2 人才能开始",
      roomFull:"房间已满（最多 7 人）",
      waitingForPlayers:"等待玩家加入...",
      playerJoined:"玩家加入：", playerLeft:"玩家离开：",
      notReady:"未准备", isReady:"已准备"
    },
    en: {
      navLobby:"Lobby", navRules:"Rules", navMyNumbers:"My numbers",
      noTables:"0 tables open", connectWallet:"Connect wallet", backToLobby:"Lobby",
      tabAi:"AI Practice", tabPoints:"Points · Real", tabReal:"On-chain · BEM",

      aiBadge:"Solo practice · Unlimited chips",
      aiTitle:"Unlimited chips<br>Practice freely",
      aiDesc:"Play against AI. No money, no sign-up, no wallet needed. Perfect for learning rules and GTO.",
      quickSeat:"⚡ Quick seat", howToPlay:"How to play?", youLabel:"You",
      miniPot:"Pot 12,400", justNow:"Just now",
      ticker1:"Player9021 won +5,834 at AI practice", ticker2:"Player7745 played 100 hands",
      ticker3:"Player0092 won +3,566 at AI practice", ticker4:"Player2210 won +500 at AI practice",
      chooseLevel:"Choose blinds level", tableSeats:"Seats", seatsUnit:"seats",
      practiceStats:"Practice stats", statHands:"Hands", statWinRate:"Win rate", statNet:"Net",
      modeInfo:"Mode info", aiInfo:"Unlimited chips, AI opponents. No wallet, no deposit, pure practice.",
      myAiChips:"My AI chips", aiWinTotal:"Total won", rebuy:"Rebuy",
      aiRebuyNote:"Chips carry over between sessions; every win counts",

      pointsBadge:"Points · Real · No money needed",
      pointsTitle:"Real players<br>No money needed",
      pointsDesc:"Play with real people via P2P. Create a room and share the code to sit together.",
      claimPoints:"🎁 Claim today's 100,000 points", myPoints:"My points", streak:"Streak",
      pointsNote:"Points are for play only, no deposit, no withdraw, no BEM exchange",
      pointsStorageWarning:"⚠️ Points are stored in this browser only. Switching devices or clearing data will lose them.",
      pointsTables:"Points tables (Real · 2-7 players)",

      realBadge:"Full on-chain · BEM · Real players",
      realTitle:"Real money<br>Fair on-chain",
      realDesc:"Connect Binance Web3 Wallet, deposit BEM for chips, play with real people. P2P + on-chain settlement.",
      walletBem:"Wallet BEM balance", realBalance:"On-chain chips", walletAddr:"Wallet address",
      deposit:"Deposit", depositNote:"Min 0.001 BEM; 2% deposit fee",
      withdraw:"Withdraw", withdrawNote:"Min 0.0001 BEM (= 1 chip)",
      realTables:"On-chain tables (Real · 2-7 players)",

      createRoom:"Create room",
      joinRoom:"Join room",
      joinRoomTitle:"Join a Room",
      joinRoomDesc:"Enter the room code shared by your friend:",
      join:"Join",
      roomsCount:"{n} tables",
      noRooms:"No tables yet",

      footer1:"1 chip = 0.0001 BEM. Rake only on flops: 1% of pot, capped at 1 big blind.",
      footer2:"Dealing uses the platform RNG; the chain only handles BEM deposit/withdraw; every hand can be replayed.",

      rulesTitle:"Dealing: every hand is verifiable afterwards",
      rulesDesc:"Hands are dealt by the platform RNG; the chain only handles BEM deposit and withdrawal.",
      rule1Title:"Dealing", rule1Body:"The platform shuffles and deals using a cryptographically secure RNG. After each hand, all hole cards and community cards are recorded for replay.",
      rule2Title:"Replay", rule2Body:"After each hand, a local record is saved (hole cards, community, final hand, win/loss). The My Numbers page shows the last 50 hands.",
      rule3Title:"Chips and rake", rule3Body:"1 chip = 0.0001 BEM. On-chain deposits convert BEM into platform chips; withdrawal converts back. Rake only on flops: 1% of pot, capped at 1 big blind.",
      rule4Title:"Three modes", rule4Body:"AI Practice: solo, 4-7 AI, unlimited chips. Points: P2P real players, 2-7 seats. On-chain: P2P + platform chips with BEM deposit/withdraw.",
      rule5Title:"Deposit / Withdraw", rule5Body:"Deposit: min 0.001 BEM, contract deposit stores it (2% fee); platform converts to chips. Withdraw: min 0.0001 BEM, 1 chip = 0.0001 BEM, contract withdraw returns BEM to your wallet.",
      rule6Title:"Disconnecting does not pay", rule6Body:"30 seconds with no response on your turn = fold. Reload within 45 seconds to keep your seat.",
      rule7Title:"What you are trusting", rule7Body:"Cards: platform RNG, not provable to third parties. Money: chain only handles deposit/withdraw; contract holds BEM, only you can withdraw. In-game chips are platform bookkeeping.",
      rule8Title:"What is different from other online poker", rule8Body:"Deposit/withdraw on-chain so the platform can't take your money unilaterally. Dealing is on-platform but every hand is replayable. One account across all three modes.",

      faqTitle:"Questions you might have",
      faq1Q:"Can the operator see cards or cheat?", faq1A:"Dealing uses the platform RNG; the operator cannot know the result in advance. The chain only proves deposit/withdraw, not fair dealing.",
      faq2Q:"Why not shuffle on-chain?", faq2A:"Every hand would need keygen, encryption, permutation, broadcast — extremely high gas. We keep only deposit/withdraw on-chain to reduce cost.",
      faq3Q:"Can players collude?", faq3A:"Yes, as at any online table. The platform can't tell whether several people bet as a team, but every hand is recorded for later review.",
      faq4Q:"Will there be bots?", faq4A:"AI Practice has AI opponents by design. Points and On-chain are real P2P games.",
      faq5Q:"Does a bad connection cost me?", faq5A:"30 seconds with no response on your turn = fold. Reload within 45 seconds to keep playing.",
      faq6Q:"Where is the money, and what if the operator disappears?", faq6A:"On-chain BEM is held by the contract you deployed (0x19fA…c2c3). Only deposit and withdraw. You can call withdraw any time.",
      faq7Q:"What does it cost?", faq7A:"Deposits take 2%; withdrawal only costs BSC gas. AI and Points are free.",
      faq8Q:"Where does the rake go?", faq8A:"On-chain rake is 1% of pot, capped at 1 big blind, out of the main pot, sent to the rake address published in the contract.",
      faq9Q:"Are the contracts audited?", faq9A:"No independent audit. Treat them as unaudited contracts: start small.",
      faq10Q:"What about my privacy?", faq10A:"Your wallet and deposit/withdraw history are public. Hand history is stored in your browser only.",
      faq11Q:"Are Points and On-chain real players?", faq11A:"Yes. Points uses P2P; On-chain adds BEM deposit/withdraw on top.",
      faq12Q:"How do I play on a phone?", faq12A:"Open in Chrome or Safari; Connect wallet opens WalletConnect. The table is landscape-oriented — turn your phone sideways.",
      faq13Q:"Is this legal where I am?", faq13A:"Laws differ from place to place; check that it is allowed where you are before you play.",

      myNumbersTitle:"My numbers", myNumbersSub:"0 tables · wallet not connected",
      statTotalPnl:"Total P&L (chips)", statTables:"Tables played", statWinRate2:"Pot win rate",
      statBiggest:"Biggest pot", statTotalBuyIn:"Total buy-in", statTotalCashout:"Total cashout",
      curveHint:"Play 2+ tables to see the cumulative curve", sessionsHeading:"Sessions",
      colTable:"Table", colBlinds:"Blinds", colBuyIn:"Buy-in", colCashout:"Cashout",
      colPnl:"P&L", colHands:"Hands", colWon:"Won", colStatus:"Status",
      resetNumbers:"Reset numbers",
      handHistoryHeading:"Recent hands (replay)", clearHistory:"Clear",

      logTitle:"Action Log", handInfoTitle:"Hand Info", dealer:"Dealer",
      potLabel:"Pot", sidePotLabel:"Side pot", yourHand:"Your Hand", nextHand:"Next hand",
      preset2x:"2×", preset3x:"3×", preset4x:"4×",
      presetQuarter:"1/4 Pot", presetThird:"1/3 Pot",
      presetHalf:"1/2 Pot", presetTwoThird:"2/3 Pot",
      presetThreeQuarter:"3/4 Pot", presetPot:"Pot", presetAllin:"All-in",
      cancel:"Cancel", confirm:"Confirm", rebuyTitle:"Out of Chips", rebuyContinue:"Rebuy & Continue", leaveTable:"Leave",
      rebuyMsg:"Out of chips. Rebuy to keep playing, or leave.", gameOverTitle:"Game Over",
      walletTitle:"Connect Wallet", walletDesc:"Please connect Binance Web3 Wallet or MetaMask to BNB Chain.",

      actionFold:"Fold", actionCheck:"Check", actionCall:"Call",
      actionBet:"Bet", actionRaiseTo:"Raise to", actionRaise:"Raise…", actionBetMenu:"Bet…",
      stagePreflop:"Pre-flop", stageFlop:"Flop", stageTurn:"Turn", stageRiver:"River", stageShowdown:"Showdown",
      handNum:"Hand #{n}", dealerIs:"Dealer {name}", blindsAre:"Blinds {sb} / {bb}",
      handShortLabel:"Hand #{n}",
      sbBet:"SB {name} posts {amt}, BB {name2} posts {amt2}",
      playerFolds:"{name} folds", playerChecks:"{name} checks",
      playerCalls:"{name} calls {amt}", playerBets:"{name} bets {amt}",
      playerRaises:"{name} raises to {amt}",
      flopIs:"Flop: {cards}", turnIs:"Turn: {card}", riverIs:"River: {card}",
      showdownHeader:"--- Showdown ---", reveals:"{name} reveals: {cards}",
      handResult:"{name}: {cards} → {hand}",
      winsPot:"{name} wins pot {pot} (all others folded)",
      winsPotSide:"{name} wins {potLabel} {amt} ({hand})",
      pot:"Pot", mainPot:"Main Pot", sidePot:"Side Pot", chips:"chips", hand:"hand",
      infoHand:"Hand", infoStage:"Stage", infoPot:"Pot",
      infoYourBet:"Your bet", infoToCall:"To call",
      orderPreflopShort:"Pre", orderPostflopShort:"Post",
      timeoutFold:"{name} timed out, auto-fold",
      handHighCard:"High Card", handPair:"One Pair", handTwoPair:"Two Pair",
      handTrips:"Three of a Kind", handStraight:"Straight", handFlush:"Flush",
      handFullHouse:"Full House", handQuads:"Four of a Kind", handStraightFlush:"Straight Flush",
      styleTAG:"TAG", styleLAG:"LAG", styleNit:"Nit",
      styleStation:"Station", styleManiac:"Maniac",
      posBTNSB:"BTN/SB", posBTN:"BTN", posSB:"SB", posBB:"BB",
      posUTG:"UTG", posUTG1:"UTG+1", posHJ:"HJ", posCO:"CO", posMP:"MP",
      handShort:"Hand",

      /* ★ Chat & Hand History */
      chatTitle:"Chat",
      chatPlaceholder:"Type a message...",
      chatSend:"Send",
      ingameHistoryTitle:"Hand History",
      quickNice:"Nice hand",
      quickThanks:"Thanks",
      quickBluff:"Bluffing?",
      quickAngry:"!!!!!😡",

      waitingRoomTitle:"Online Lobby", roomCode:"Room code", copy:"Copy",
      playersOnline:"Players online", ready:"Ready", waitingHint:"At least 2 players to start",
      roomFull:"Room is full (max 7)",
      waitingForPlayers:"Waiting for players...",
      playerJoined:"Player joined: ", playerLeft:"Player left: ",
      notReady:"Not ready", isReady:"Ready"
    }
  };

  let current = 'zh';
  function t(key, vars){
    const lang = T[current] || T.zh;
    let s = lang[key];
    if(s === undefined) s = T.zh[key];
    if(s === undefined) s = key;
    if(vars){
      s = s.replace(/\{(\w+)\}/g, function(m, k){
        return vars[k] !== undefined ? String(vars[k]) : m;
      });
    }
    return s;
  }
  function setLang(l){ if(T[l]) current = l; }
  function getLang(){ return current; }
  function apply(root){
    root = root || document;
    /* 处理 data-i18n 文本内容 */
    root.querySelectorAll('[data-i18n]').forEach(function(el){
      const key = el.getAttribute('data-i18n');
      const v = t(key);
      if(v.indexOf('<br>') !== -1 || v.indexOf('<') !== -1){
        el.innerHTML = v;
      } else {
        el.textContent = v;
      }
    });
    /* ★ 处理 data-i18n-ph 输入框 placeholder */
    root.querySelectorAll('[data-i18n-ph]').forEach(function(el){
      const key = el.getAttribute('data-i18n-ph');
      el.placeholder = t(key);
    });
    /* ★ 处理 data-i18n-title（鼠标悬停提示） */
    root.querySelectorAll('[data-i18n-title]').forEach(function(el){
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });
  }
  return { t: t, setLang: setLang, getLang: getLang, apply: apply };
})();