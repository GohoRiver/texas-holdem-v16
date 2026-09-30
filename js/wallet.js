window.PokerWallet = (function(){
/* 平台收款地址 */
const PLATFORM_ADDRESS = '0x1219c18adc187c918d0216eb7b983f5068eeb19a';

/* BEM 代币合约地址 */
const BEM_ADDRESS = '0x5ce033b2bfca3af30b3e8c8457deaf776a8b695a';

/* 德州扑克合约地址 */
const CONTRACT_ADDRESS = '0x19fab85122f24586218c101366ef081ca91cc2c3';
  const FEE_RATE = 0.02;
  const BSC_CHAIN_ID = '0x38';
  const CHIP_TO_BEM = 0.0001;
  const FEE_NUM = 2n;      /* 2% 手续费，用整数计算 */
  const FEE_DEN = 100n;

  const BEM_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];

  const CONTRACT_ABI = [
    { "inputs": [{ "internalType": "address", "name": "_bem", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" },
    { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "Deposited", "type": "event" },
    { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "Withdrawn", "type": "event" },
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "balances", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "bemToken", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "deposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_player", "type": "address" }], "name": "getBalance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
  ];

  let provider = null;
  let signer = null;
  let userAddress = null;
  let bemBalance = 0;
  let contractBalance = 0;
  let decimals = 18;

  function getEth(){
    return window.binancew3w?.ethereum || window.ethereum || null;
  }

  /* 把错误对象转成可读字符串 */
  function errMsg(e){
    if(!e) return 'unknown';
    return e.reason || e.shortMessage || e.info?.error?.message || e.message || String(e);
  }

  async function connect(){
    const eth = getEth();
    if(!eth){
      alert('请安装币安 Web3 钱包或 MetaMask');
      return null;
    }
    try{
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if(!accounts || !accounts.length) return null;
      userAddress = accounts[0];

      try{
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BSC_CHAIN_ID }]
        });
      }catch(sw){
        if(sw.code === 4902){
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BSC_CHAIN_ID,
              chainName: 'BNB Smart Chain',
              nativeCurrency: { name:'BNB', symbol:'BNB', decimals:18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com/']
            }]
          });
        } else {
          throw sw;
        }
      }

      provider = new ethers.BrowserProvider(eth);
      signer = await provider.getSigner();

      await refreshBemBalance();
      await refreshContractBalance();
      updateUI();

      eth.on && eth.on('accountsChanged', function(accs){
        if(accs && accs.length){
          userAddress = accs[0];
          refreshBemBalance()
            .then(refreshContractBalance)
            .then(updateUI);
        } else {
          userAddress = null;
          bemBalance = 0;
          contractBalance = 0;
          updateUI();
        }
      });

      return { address: userAddress, signer, bemBalance };
    }catch(err){
      console.error('connect error', err);
      return null;
    }
  }

  async function refreshBemBalance(){
    if(!provider || !userAddress) return 0;
    try{
      const contract = new ethers.Contract(BEM_ADDRESS, BEM_ABI, provider);
      const raw = await contract.balanceOf(userAddress);
      try{
        decimals = Number(await contract.decimals());
      }catch(e){ decimals = 18; }
      bemBalance = parseFloat(ethers.formatUnits(raw, decimals));
    }catch(e){
      console.warn('read BEM failed', e);
      bemBalance = 0;
    }
    return bemBalance;
  }

  async function refreshContractBalance(){
    if(!provider || !userAddress) return 0;
    try{
      const game = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const raw = await game.getBalance(userAddress);
      contractBalance = parseFloat(ethers.formatUnits(raw, decimals));
    }catch(e){
      console.warn('read contract balance failed', e);
      contractBalance = 0;
    }
    return contractBalance;
  }

  function updateUI(){
    const btn = document.getElementById('connectWalletBtn');
    const btn2 = document.getElementById('realConnectBtn');
    const label = userAddress
      ? (userAddress.slice(0,6) + '...' + userAddress.slice(-4))
      : null;

    if(btn){
      if(label){ btn.textContent = label; btn.classList.add('connected'); }
      else { btn.textContent = window.PokerI18n.t('connectWallet'); btn.classList.remove('connected'); }
    }
    if(btn2){
      if(label){ btn2.textContent = label; btn2.classList.add('connected'); }
      else { btn2.textContent = window.PokerI18n.t('connectWallet'); btn2.classList.remove('connected'); }
    }

    const bem = document.getElementById('walletBemBalance');
    if(bem) bem.textContent = bemBalance.toFixed(4);

    const addr = document.getElementById('walletAddress');
    if(addr){
      addr.textContent = userAddress
        ? (userAddress.slice(0,6) + '...' + userAddress.slice(-4))
        : window.PokerI18n.t('notConnected');
    }

    const pill = document.getElementById('statusPill');
    if(pill && userAddress){
      pill.innerHTML = '<span class="dot" style="background:#22c55e;box-shadow:0 0 6px #22c55e;"></span>' + bemBalance.toFixed(2) + ' BEM';
    }
  }

  /* =========================================================
     充值：用户 approve 合约 → 转手续费到平台 → 调用合约 deposit
     全程用 BigInt 精确计算，避免浮点误差
     ========================================================= */
  async function depositBem(amountBem){
    if(!signer || !userAddress){
      throw new Error('钱包未连接');
    }
    const amount = Number(amountBem);
    if(!amount || amount < 0.001){
      throw new Error('最低充值 0.001 BEM');
    }
    if(amount > bemBalance){
      throw new Error('钱包 BEM 不足：当前 ' + bemBalance.toFixed(4) + '，需要 ' + amount);
    }

    /* ★ 用 BigInt 精确拆分：先把用户输入截断到 6 位小数，再转 wei */
    const amountStr = amount.toFixed(6);
    const amountWei = ethers.parseUnits(amountStr, decimals);
    const feeWei = (amountWei * FEE_NUM) / FEE_DEN;
    const netWei = amountWei - feeWei;

    /* netChips：用 BigInt 除法（netWei / (0.0001 * 10^decimals)） */
    const chipWeiPerChip = ethers.parseUnits(CHIP_TO_BEM.toString(), decimals);
    const netChipsBig = netWei / chipWeiPerChip;
    const netChips = Number(netChipsBig);

    console.log('[deposit] 输入:', amount, 'decimals:', decimals);
    console.log('[deposit] amountWei =', amountWei.toString());
    console.log('[deposit] feeWei    =', feeWei.toString());
    console.log('[deposit] netWei    =', netWei.toString());
    console.log('[deposit] netChips  =', netChips);

    if(netChips <= 0){
      throw new Error('扣手续费后不足 1 筹码，请提高金额');
    }

    const bemContract = new ethers.Contract(BEM_ADDRESS, BEM_ABI, signer);
    const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    /* 第 1 步：approve */
    let approveTx;
    try {
      console.log('[deposit] step1 approve...');
      approveTx = await bemContract.approve(CONTRACT_ADDRESS, netWei);
      await approveTx.wait();
      console.log('[deposit] approve ok:', approveTx.hash);
    } catch(e){
      console.error('[deposit] approve failed', e);
      throw new Error('第1步 approve 失败：' + errMsg(e));
    }

    /* 第 2 步：手续费转给平台 */
    if(feeWei > 0n){
      try {
        console.log('[deposit] step2 fee transfer...');
        const feeTx = await bemContract.transfer(PLATFORM_ADDRESS, feeWei);
        await feeTx.wait();
        console.log('[deposit] fee ok:', feeTx.hash);
      } catch(e){
        console.error('[deposit] fee transfer failed', e);
        throw new Error('第2步 手续费转账失败：' + errMsg(e));
      }
    }

    /* 第 3 步：deposit */
    let depositTx;
    try {
      console.log('[deposit] step3 contract.deposit...');
      depositTx = await gameContract.deposit(netWei);
      await depositTx.wait();
      console.log('[deposit] deposit ok:', depositTx.hash);
    } catch(e){
      console.error('[deposit] contract deposit failed', e);
      throw new Error('第3步 deposit 合约调用失败：' + errMsg(e));
    }

    await refreshBemBalance();
    await refreshContractBalance();
    updateUI();

    return {
      netChips: netChips,
      netBem: Number(ethers.formatUnits(netWei, decimals)),
      feeBem: Number(ethers.formatUnits(feeWei, decimals)),
      txHash: depositTx.hash
    };
  }

  /* =========================================================
     提现：调用合约的 withdraw
     ========================================================= */
  async function withdrawBem(amountBem){
    if(!signer || !userAddress){
      throw new Error('钱包未连接');
    }
    const amount = Number(amountBem);
    if(!amount || amount <= 0){
      throw new Error('请输入提现金额');
    }

    const amountStr = amount.toFixed(6);
    const amountWei = ethers.parseUnits(amountStr, decimals);

    console.log('[withdraw] 输入:', amount, 'amountWei =', amountWei.toString());

    const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    let tx;
    try {
      tx = await gameContract.withdraw(amountWei);
      await tx.wait();
      console.log('[withdraw] ok:', tx.hash);
    } catch(e){
      console.error('[withdraw] failed', e);
      throw new Error('提现失败：' + errMsg(e));
    }

    await refreshBemBalance();
    await refreshContractBalance();
    updateUI();

    return { txHash: tx.hash, amount: amount };
  }

  function getBemBalance(){ return bemBalance; }
  function getContractBalance(){ return contractBalance; }
  function getAddress(){ return userAddress; }
  function isConnected(){ return !!userAddress; }
  function getPlatformAddress(){ return PLATFORM_ADDRESS; }
  function getContractAddress(){ return CONTRACT_ADDRESS; }
  function getFeeRate(){ return FEE_RATE; }

  return {
    connect,
    depositBem,
    withdrawBem,
    refreshBemBalance,
    refreshContractBalance,
    updateUI,
    getBemBalance,
    getContractBalance,
    getAddress,
    isConnected,
    getPlatformAddress,
    getContractAddress,
    getFeeRate
  };
})();