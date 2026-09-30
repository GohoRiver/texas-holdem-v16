// js/wallet-bind.js —— 独立钱包绑定，避开 game.js 内部错误
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function isEn(){
    return window.PokerI18n && PokerI18n.getLang() === 'en';
  }
  function t(k){
    return window.PokerI18n ? PokerI18n.t(k) : k;
  }

  async function doConnect(){
    console.log('[Wallet] 点击连接钱包');

    // 音效（可选）
    if(window.PokerAudio){
      try { PokerAudio.play('click'); } catch(e){}
    }

    // 模块检查
    if(typeof window.PokerWallet === 'undefined'){
      console.error('[Wallet] PokerWallet 未定义，wallet.js 没加载成功');
      alert(isEn()
        ? 'Wallet module not loaded. Please refresh the page.'
        : '钱包模块未加载，请刷新页面重试。');
      return;
    }
    if(typeof window.ethers === 'undefined'){
      console.error('[Wallet] ethers 未定义，ethers.umd.min.js 没加载成功');
      alert(isEn()
        ? 'ethers.js not loaded. Please check your network and refresh.'
        : 'ethers.js 未加载，请检查网络并刷新页面。');
      return;
    }

    // 检测钱包
    const eth = (window.binancew3w && window.binancew3w.ethereum)
             || window.ethereum
             || null;
    console.log('[Wallet] 检测钱包 provider:', !!eth);

    if(!eth){
      alert(isEn()
        ? 'No Web3 wallet detected.\nPlease install MetaMask or Binance Web3 Wallet,\nor open this page inside a wallet app browser.'
        : '未检测到 Web3 钱包。\n请安装 MetaMask 或币安 Web3 钱包，\n或用手机钱包 App 的内置浏览器打开。');
      return;
    }

    try {
      const res = await PokerWallet.connect();
      console.log('[Wallet] connect 返回:', res);
      if(res){
        const ov = $('walletOverlay');
        if(ov) ov.classList.add('hidden');
        // 通知 game.js 刷新余额（如果它绑定了监听）
        window.dispatchEvent(new Event('walletConnected'));
      }
    } catch(e){
      console.error('[Wallet] connect 出错:', e);
      alert((isEn() ? 'Connect failed: ' : '连接失败：') + (e && e.message ? e.message : e));
    }
  }

  function bind(){
    ['connectWalletBtn', 'realConnectBtn', 'walletConnectBtn'].forEach(function(id){
      const btn = document.getElementById(id);
      if(!btn) return;
      if(btn.__walletBound) return;
      btn.__walletBound = true;
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        doConnect();
      });
      console.log('[Wallet] 已绑定按钮:', id);
    });
  }

  // 首次绑定
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // 兜底再绑一次（防 game.js 里的 onclick 覆盖）
  setTimeout(bind, 300);
  setTimeout(bind, 1500);

  // 暴露出来方便手动调用
  window.__walletDoConnect = doConnect;
})();