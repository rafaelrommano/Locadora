// ============ SFX SYSTEM (Web Audio API Synthesized + Retro Samples) ============

const sfx = {
  ctx: null,
  enabled: localStorage.getItem('vhs_sfx') !== 'off',

  // Lazy init — só cria o AudioContext quando o usuário interagir (regra do browser)
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { this.enabled = false; }
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('vhs_sfx', this.enabled ? 'on' : 'off');
    if (this.enabled) this.click();
    const btn = document.getElementById('sfx-toggle');
    if (btn) btn.textContent = this.enabled ? '🔊' : '🔇';
  },

  // Click mecânico de botão VHS (Sintetizado) — clique seco e curto
  click() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.06);
  },

  // Estática de TV — ruído branco curto, pra trocar de aba
  static(dur = 0.18) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // Filtro pra simular TV velha
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 1500;
    src.connect(filt).connect(gain).connect(this.ctx.destination);
    src.start(t);
  },

  // Rebobinar — bobina acelerada (frequência pitch alta crescente + ruído)
  rewind() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 1.4;
    // Whine modulado (motor da fita)
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1600, t + 0.5);
    osc.frequency.linearRampToValueAtTime(2200, t + 1.0);
    osc.frequency.linearRampToValueAtTime(400, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.setValueAtTime(0.06, t + dur - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // Tremolo (vibração mecânica)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 25;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
    lfo.start(t); lfo.stop(t + dur);
    // Ruído de fricção
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const nfilt = this.ctx.createBiquadFilter();
    nfilt.type = 'bandpass';
    nfilt.frequency.value = 3000;
    const ngain = this.ctx.createGain();
    ngain.gain.setValueAtTime(0.04, t);
    ngain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(nfilt).connect(ngain).connect(this.ctx.destination);
    noise.start(t);
  },

  // "Clunk" mecânico — botão chunky de videocassete
  clunk() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + 0.16);
  },

  // Glitch da fita mastigada — ruído distorcido com ataque
  glitch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.8;
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      // Burst de ruído com picos
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.8 ? 1 : 0.3);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(2, t);
    src.playbackRate.linearRampToValueAtTime(0.5, t + dur);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(800, t);
    filt.frequency.linearRampToValueAtTime(200, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(gain).connect(this.ctx.destination);
    src.start(t);
  },

  // "Sino" de pontos ganhos
  chime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const start = t + i * 0.05;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(start); osc.stop(start + 0.5);
    });
  },

  // Zumbido senoidal de 1000Hz + ruído analógico de fita + estalos
  beep(dur = 1.4) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // 1. Zumbido de teste senoidal clássico de 1000Hz
    const osc = this.ctx.createOscillator();
    const gainOsc = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, t);
    
    gainOsc.gain.setValueAtTime(0, t);
    gainOsc.gain.linearRampToValueAtTime(0.06, t + 0.05); // volume ligeiramente menor para dar espaço para o ruído
    gainOsc.gain.setValueAtTime(0.06, t + dur - 0.1);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    osc.connect(gainOsc).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);

    // 2. Ruído de estática magnética de fundo (chiado "shhhh" analógico)
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015; // Bem suave de fundo
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(2500, t); // Filtro abafador de fita VHS
    
    const gainNoise = this.ctx.createGain();
    gainNoise.gain.setValueAtTime(0, t);
    gainNoise.gain.linearRampToValueAtTime(0.05, t + 0.1);
    gainNoise.gain.setValueAtTime(0.05, t + dur - 0.1);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    noise.connect(lpFilter).connect(gainNoise).connect(this.ctx.destination);
    noise.start(t);

    // 3. Estalos magnéticos (pops) pseudo-aleatórios
    const numPops = Math.floor(dur * 6); // Aprox. 6 pops por segundo
    for (let i = 0; i < numPops; i++) {
      const popTime = t + 0.1 + Math.random() * (dur - 0.2);
      
      const oscPop = this.ctx.createOscillator();
      oscPop.type = 'triangle';
      oscPop.frequency.setValueAtTime(120 + Math.random() * 500, popTime);
      
      const gainPop = this.ctx.createGain();
      gainPop.gain.setValueAtTime(0.08, popTime);
      gainPop.gain.exponentialRampToValueAtTime(0.001, popTime + 0.012); // estalo curto
      
      oscPop.connect(gainPop).connect(this.ctx.destination);
      oscPop.start(popTime);
      oscPop.stop(popTime + 0.02);
    }
  },

  // Inserção de fita VHS: som de deslize mecânico seguido de dois cliques pesados (engate)
  insertTape() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // 1. Som de deslizamento mecânico (ruído branco filtrado com passa-banda)
    const durDeslize = 0.45;
    const bufferSize = this.ctx.sampleRate * durDeslize;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + durDeslize);
    filter.Q.value = 3;
    
    const gainNoise = this.ctx.createGain();
    gainNoise.gain.setValueAtTime(0, t);
    gainNoise.gain.linearRampToValueAtTime(0.08, t + 0.05);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, t + durDeslize);
    
    noise.connect(filter).connect(gainNoise).connect(this.ctx.destination);
    noise.start(t);
    
    // 2. Som de motor/engrenagem engolindo a fita (baixo tom modulado)
    const oscMotor = this.ctx.createOscillator();
    oscMotor.type = 'sawtooth';
    oscMotor.frequency.setValueAtTime(80, t);
    oscMotor.frequency.linearRampToValueAtTime(120, t + durDeslize);
    
    const gainMotor = this.ctx.createGain();
    gainMotor.gain.setValueAtTime(0, t);
    gainMotor.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gainMotor.gain.linearRampToValueAtTime(0.05, t + durDeslize - 0.05);
    gainMotor.gain.exponentialRampToValueAtTime(0.001, t + durDeslize);
    
    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 300;
    
    oscMotor.connect(lpFilter).connect(gainMotor).connect(this.ctx.destination);
    oscMotor.start(t);
    oscMotor.stop(t + durDeslize);
    
    // 3. Cliques mecânicos chunky de encaixe (clunk duplo no final)
    const tClunk1 = t + durDeslize - 0.08;
    const oscClunk1 = this.ctx.createOscillator();
    oscClunk1.type = 'triangle';
    oscClunk1.frequency.setValueAtTime(110, tClunk1);
    oscClunk1.frequency.exponentialRampToValueAtTime(45, tClunk1 + 0.08);
    
    const gainClunk1 = this.ctx.createGain();
    gainClunk1.gain.setValueAtTime(0.25, tClunk1);
    gainClunk1.gain.exponentialRampToValueAtTime(0.001, tClunk1 + 0.1);
    
    oscClunk1.connect(gainClunk1).connect(this.ctx.destination);
    oscClunk1.start(tClunk1);
    oscClunk1.stop(tClunk1 + 0.12);
    
    const tClunk2 = t + durDeslize + 0.02;
    const oscClunk2 = this.ctx.createOscillator();
    oscClunk2.type = 'sine';
    oscClunk2.frequency.setValueAtTime(90, tClunk2);
    oscClunk2.frequency.exponentialRampToValueAtTime(30, tClunk2 + 0.1);
    
    const gainClunk2 = this.ctx.createGain();
    gainClunk2.gain.setValueAtTime(0.3, tClunk2);
    gainClunk2.gain.exponentialRampToValueAtTime(0.001, tClunk2 + 0.12);
    
    oscClunk2.connect(gainClunk2).connect(this.ctx.destination);
    oscClunk2.start(tClunk2);
    oscClunk2.stop(tClunk2 + 0.15);
  },

  // Vincula a nova função de som de clique de plástico importada do Mixkit
  playVhsSound() {
    if (!this.enabled) return;
    playVhsSound();
  }
};

// Exemplo de como disparar um som nostálgico de clique de plástico (domínio público)
function playVhsSound() {
  if (sfx && !sfx.enabled) return;
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav'); 
  audio.volume = 0.2;
  audio.play().catch(() => {}); // catch previne bloqueio de autoplay do navegador
}
