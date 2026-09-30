window.PokerAudio = (function(){
  let ctx = null;
  let enabled = true;
  let volume = 0.7;

  function init(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when){
    if(!enabled) return;
    const c = init();
    if(!c) return;
    type = type || 'sine';
    vol = (vol == null ? 0.1 : vol) * volume;
    if(vol <= 0.0001) return;
    when = when || 0;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, when, cutoff){
    if(!enabled) return;
    const c = init();
    if(!c) return;
    vol = (vol == null ? 0.05 : vol) * volume;
    if(vol <= 0.0001) return;
    when = when || 0;
    cutoff = cutoff || 1500;
    const t = c.currentTime + when;
    const size = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, size, c.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i = 0; i < size; i++){
      data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
  }

  const sounds = {
    deal: function(){
      noise(0.05, 0.06, 0, 2200);
      tone(1400, 0.03, 'square', 0.025, 0.01);
    },
    call: function(){
      tone(520, 0.07, 'triangle', 0.09, 0);
      tone(390, 0.09, 'sine', 0.06, 0.04);
      noise(0.03, 0.03, 0, 1800);
    },
    check: function(){
      tone(720, 0.05, 'sine', 0.06, 0);
    },
    raise: function(){
      tone(523, 0.06, 'triangle', 0.09, 0);
      tone(659, 0.07, 'triangle', 0.09, 0.05);
      tone(880, 0.12, 'triangle', 0.1, 0.11);
      noise(0.04, 0.04, 0.02, 2400);
    },
    fold: function(){
      noise(0.12, 0.05, 0, 900);
      tone(220, 0.14, 'sawtooth', 0.045, 0.02);
    },
    win: function(){
      [523, 659, 784, 1046].forEach(function(f, i){
        tone(f, 0.16, 'triangle', 0.09, i * 0.09);
      });
    },
    showdown: function(){
      tone(392, 0.18, 'sine', 0.09, 0);
      tone(523, 0.18, 'sine', 0.09, 0.14);
      tone(659, 0.28, 'sine', 0.1, 0.28);
    },
    turn: function(){
      tone(880, 0.07, 'sine', 0.07, 0);
      tone(1320, 0.09, 'sine', 0.055, 0.06);
    },
    chip: function(){
      noise(0.03, 0.035, 0, 2600);
      tone(2200, 0.02, 'square', 0.02, 0);
    },
    lose: function(){
      tone(330, 0.15, 'sine', 0.07, 0);
      tone(247, 0.2, 'sine', 0.07, 0.12);
    },
    /* ★ 新增 */
    click: function(){
      tone(1100, 0.025, 'sine', 0.05, 0);
      tone(1600, 0.015, 'square', 0.02, 0.008);
    },
    tick: function(){
      tone(1500, 0.035, 'sine', 0.06, 0);
    },
    bet: function(){
      tone(620, 0.06, 'triangle', 0.08, 0);
      tone(940, 0.09, 'triangle', 0.08, 0.05);
      noise(0.04, 0.03, 0.03, 2200);
    },
    allin: function(){
      [523, 659, 784, 1046, 1318].forEach(function(f, i){
        tone(f, 0.11, 'triangle', 0.1, i * 0.055);
      });
      noise(0.18, 0.05, 0, 900);
    }
  };

  return {
    init: init,
    setEnabled: function(v){ enabled = !!v; if(v) init(); },
    isEnabled: function(){ return enabled; },
    setVolume: function(v){ volume = Math.max(0, Math.min(1, v)); },
    getVolume: function(){ return volume; },
    play: function(name){ if(sounds[name]) sounds[name](); }
  };
})();