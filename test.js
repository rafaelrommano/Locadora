
  // ============ STATE ============
  const state = {
    apiKey: localStorage.getItem('tmdb_api_key') || '',
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    omdbKey: localStorage.getItem('omdb_api_key') || '',
    rawgKey: localStorage.getItem('rawg_api_key') || '',
    giphyKey: localStorage.getItem('giphy_api_key') || '',
    country: localStorage.getItem('tmdb_country') || 'BR-pt-BR',
    view: 'home',
    favorites: JSON.parse(localStorage.getItem('vhs_favorites') || '[]'),
    currentPage: 1,
    currentQuery: null,
    genres: [],
    trailerTitles: {},
    rewindTimer: null,
    points: parseInt(localStorage.getItem('vhs_points') || '0', 10),
    fines: parseInt(localStorage.getItem('vhs_fines') || '0', 10),
    tapePositions: JSON.parse(localStorage.getItem('vhs_tape_positions') || '{}'),
    ytPlayer: null,
    currentTrailerId: null,
    currentTrailerKey: null,
    currentTrailerTime: 0,
    // Filters state — all combined with AND logic
    filters: {
      keywords: [],     // [{id, name}]
      genres: [],       // [id, ...] — combined with AND
      people: [],       // [{id, name}] — actors/directors
      yearFrom: null,
      yearTo: null,
      ratingMin: null,
      sortBy: 'popularity.desc'
    }
  };

  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
  const IMG_LARGE = 'https://image.tmdb.org/t/p/w500';

  function isV4Token(k) { return k && k.length > 40; }

  async function tmdbFetch(path, params = {}) {
    const parts = state.country.split('-');
    const region = parts[0];
    const language = parts.slice(1).join('-');

    const queryParams = new URLSearchParams({ language, region, ...params });
    const headers = { 'Content-Type': 'application/json' };
    let url;

    if (isV4Token(state.apiKey)) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
      url = `${TMDB_BASE}${path}?${queryParams}`;
    } else {
      queryParams.set('api_key', state.apiKey);
      url = `${TMDB_BASE}${path}?${queryParams}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status}: ${txt}`);
    }
    return res.json();
  }

  // ============ AI ORACLE (Gemini) ============
  const GEMINI_MODEL = 'gemini-2.5-flash-lite';
  const GEMINI_FALLBACK = 'gemini-2.5-flash';
  const GEMINI_ENDPOINT = (model, key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  function toggleGeminiConfig() {
    const el = document.getElementById('witch-gemini-config');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
      document.getElementById('gemini-key-input').value = state.geminiKey || '';
      document.getElementById('gemini-key-input').focus();
    }
  }

  function openWitch() {
    sfx.click();
    document.getElementById('witch-overlay').classList.add('show');
    // Auto-show config if no key yet
    if (!state.geminiKey) {
      document.getElementById('witch-gemini-config').classList.remove('hidden');
    }
    setTimeout(() => {
      const el = state.geminiKey ? document.getElementById('ai-query') : document.getElementById('gemini-key-input');
      if (el) el.focus();
    }, 100);
  }

  function closeWitch() {
    document.getElementById('witch-overlay').classList.remove('show');
  }

  function saveGeminiKey() {
    const key = document.getElementById('gemini-key-input').value.trim();
    if (!key) { alert('Cola uma chave válida.'); return; }
    state.geminiKey = key;
    localStorage.setItem('gemini_api_key', key);
    document.getElementById('witch-gemini-config').classList.add('hidden');
    setCrystalContent(`<div class="crystal-divining">A bruxa olha para você...<div class="visions">"agora pergunte, querido(a)"</div></div>`);
    document.getElementById('ai-query').focus();
  }

  function askOracleWith(text) {
    document.getElementById('ai-query').value = text;
    askOracle();
  }

  // "Tô com preguiça, escolhe um pra mim" — atendente preguiçoso mode
  function askOracleLazy() {
    sfx.click();
    const prompts = [
      'tô com preguiça, me indica qualquer filme bom que ninguém aluga',
      'me surpreenda com um filme cult/B-movie esquecido',
      'recomenda umas joias estranhas que tão pegando poeira na prateleira',
      'um filme pra desligar o cérebro depois do trabalho',
      'qualquer coisa que valha a pena mas que eu nunca ouvi falar'
    ];
    const query = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById('ai-query').value = query;
    askOracle('lazy');
  }

  // Pool of "witch speaking" phrases shown in the crystal ball while loading
  const WITCH_PHRASES = [
    'Hmm... vejo algo entre as névoas...',
    'As fitas se movem na escuridão...',
    'O passado e o cinema sussurram...',
    'Sinto um filme... talvez vários...',
    'Os créditos rolam nos meus olhos...',
    'Espere... a bobina está girando...'
  ];

  function setCrystalContent(html) {
    document.getElementById('crystal-content').innerHTML = html;
  }

  function setCrystalDivining(isDivining) {
    document.getElementById('crystal-ball').classList.toggle('divining', isDivining);
  }

  async function askOracle(mode = 'normal') {
    const query = document.getElementById('ai-query').value.trim();
    if (!query) return;

    if (!state.geminiKey) {
      document.getElementById('witch-gemini-config').classList.remove('hidden');
      setCrystalContent(`<div class="crystal-divining" style="color:var(--neon-pink)">Preciso da chave do Gemini primeiro, querido(a)...</div>`);
      return;
    }

    const btn = document.getElementById('ai-ask-btn');
    btn.disabled = true;
    btn.textContent = '◈ DIVINANDO...';
    setCrystalDivining(true);
    showAIResults('');

    // Cycle witch phrases while we wait
    const phrase = mode === 'lazy'
      ? '*suspira* ... deixa eu ver o que tem aqui...'
      : WITCH_PHRASES[Math.floor(Math.random() * WITCH_PHRASES.length)];
    setCrystalContent(`
      <div class="crystal-divining">
        ${escapeHtml(phrase)}
        <div class="visions">${mode === 'lazy' ? 'remexendo nas prateleiras...' : 'consultando os ventos do cinema...'}</div>
      </div>
    `);

    try {
      const suggestion = await callGemini(query, mode);
      setCrystalDivining(false);
      setCrystalContent(`
        <div class="crystal-divining" style="color:var(--neon-yellow)">
          ◈ ${(suggestion.movies || []).length} visões reveladas ◈
          <div class="visions" style="color:white">role abaixo para ver</div>
        </div>
      `);
      await displaySuggestions(suggestion, query);
      awardPoints(2, 'consultou a Madame');
    } catch (err) {
      setCrystalDivining(false);
      setCrystalContent(`<div class="crystal-divining" style="color:var(--neon-pink)">A bola escureceu...<div class="visions">${escapeHtml(err.message)}</div></div>`);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ CONSULTAR A BOLA';
    }
  }

  function showAIResults(html) {
    document.getElementById('ai-results').innerHTML = html;
  }

  async function callGemini(userQuery, mode = 'normal') {
    const baseRules = `REGRAS IMPORTANTES:
1. Responda APENAS com JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois.
2. Use SEMPRE o título original em inglês (ou no idioma original do filme) — isso ajuda na busca da TMDB. Ex: "Pulp Fiction" não "Tempo de Violência".
3. Se a descrição for vaga, ofereça variedade (não só blockbusters).
4. Inclua uma breve razão (1 frase curta) explicando POR QUE cada filme bate com o que o cliente pediu.
5. No campo "reasoning" inicial, faça um comentário curto (1-2 frases) como se fosse o atendente conversando, explicando sua linha de raciocínio.
6. Se o filme for dos anos 80 ou 90, ocasionalmente solte uma fofoca, curiosidade ou "lenda urbana" da época sobre o filme/elenco/produção no campo "reason" — coisas que um atendente fofoqueiro contaria balcão a balcão. Ex: "dizem que o ator quase morreu naquela cena", "esse foi o último filme que passou no cinema de bairro antes de fechar", "a produção gastou metade do orçamento só nos efeitos". Não invente fatos falsos — use curiosidades reais conhecidas, mas com tom de fofoca.

Formato EXATO da resposta:
{
  "reasoning": "Hmm, pelo que você descreveu, parece que está procurando...",
  "movies": [
    {"title": "Original Title", "year": 1999, "reason": "Razão curta em português."},
    ...
  ]
}`;

    let systemPrompt;
    if (mode === 'lazy') {
      systemPrompt = `Você é o atendente entediado e levemente preguiçoso de uma locadora de bairro dos anos 90. É fim de turno, você queria estar em casa, e o cliente apareceu pedindo "qualquer coisa". Você vai indicar 3 a 5 filmes que talvez tenham sobrado na prateleira (pense em filmes menos óbvios, cult, B-movies esquecidos, joias escondidas que ninguém aluga), e seu comentário ("reasoning") tem que SOAR como um atendente que está com preguiça mas conhece muito de cinema. Use frases tipo:
- "Olha, 'O Predador' tá alugado, mas tem esse aqui que ninguém nunca leva..."
- "Já viu esse? Não? Pois é, todo mundo passa direto e perde."
- "Se você gosta dessas coisas estranhas, leva esse aqui que tá pegando poeira."
- "Não é Spielberg, mas dá pra desligar o cérebro depois do trabalho."

Mostre personalidade — seja resmungão mas afetuoso, como um cinéfilo cansado.

${baseRules}`;
    } else {
      systemPrompt = `Você é o atendente de uma locadora de filmes dos anos 90, com conhecimento enciclopédico de cinema mundial. O cliente vai descrever um filme com suas próprias palavras (pode ser vago, com detalhes parciais, ou pedindo recomendações por tema/clima). Sua missão é sugerir entre 4 e 8 filmes que melhor casem com a descrição.

${baseRules}`;
    }

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userQuery }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json'
      }
    };

    let data;
    try {
      data = await geminiRequest(GEMINI_MODEL, body);
    } catch (err) {
      // Fallback to bigger model if lite fails (e.g. region restriction)
      console.warn('Lite model failed, trying fallback:', err.message);
      data = await geminiRequest(GEMINI_FALLBACK, body);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini não retornou resposta');

    // Parse JSON (Gemini sometimes wraps in ```json despite instructions)
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error('Resposta do Gemini não veio em JSON válido. Tente reformular a pergunta.');
    }
  }

  async function geminiRequest(model, body) {
    const res = await fetch(GEMINI_ENDPOINT(model, state.geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = `Gemini ${res.status}`;
      try {
        const err = await res.json();
        msg = err?.error?.message || msg;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function displaySuggestions(suggestion, originalQuery) {
    const movies = suggestion.movies || [];
    if (!movies.length) {
      showAIResults('<div class="ai-thinking">O oráculo não achou nada. Tenta descrever de outro jeito.</div>');
      return;
    }

    // Show reasoning + skeleton cards while we look up each on TMDB
    const skeletonHtml = movies.map((m, i) => `
      <div class="ai-suggestion" id="ai-sug-${i}">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="year">${m.year || '????'}</div>
        <div class="reason">${escapeHtml(m.reason || '')}</div>
        <div class="status">◈ procurando na TMDB...</div>
      </div>
    `).join('');

    showAIResults(`
      ${suggestion.reasoning ? `<div class="ai-reasoning">${escapeHtml(suggestion.reasoning)}</div>` : ''}
      <div class="ai-suggestions">${skeletonHtml}</div>
    `);

    // Look up each movie on TMDB in parallel
    const lookups = movies.map((m, i) => lookupTmdb(m).then(tmdbMovie => ({ i, m, tmdbMovie })));
    const results = await Promise.all(lookups);

    // Replace skeleton cards with real cards
    results.forEach(({ i, m, tmdbMovie }) => {
      const card = document.getElementById(`ai-sug-${i}`);
      if (!card) return;
      if (tmdbMovie) {
        card.onclick = () => openMovie(tmdbMovie.id);
        card.style.cursor = 'pointer';
        const realYear = tmdbMovie.release_date ? tmdbMovie.release_date.slice(0, 4) : (m.year || '????');
        const poster = tmdbMovie.poster_path
          ? `<img src="${IMG_BASE}${tmdbMovie.poster_path}" style="width:100%; aspect-ratio:2/3; object-fit:cover; margin-bottom:8px; image-rendering:pixelated; border:1px solid var(--neon-cyan)">`
          : '';
        card.innerHTML = `
          ${poster}
          <div class="title">${escapeHtml(tmdbMovie.title || m.title)}</div>
          <div class="year">${realYear}</div>
          <div class="reason">${escapeHtml(m.reason || '')}</div>
          <div class="status">▶ clique para abrir</div>
        `;
      } else {
        card.classList.add('unmatched');
        card.querySelector('.status').classList.add('not-found');
        card.querySelector('.status').textContent = '✕ não encontrado na TMDB';
      }
    });
  }

  async function lookupTmdb(geminiMovie) {
    try {
      const params = { query: geminiMovie.title };
      if (geminiMovie.year) params.year = geminiMovie.year;
      const data = await tmdbFetch('/search/movie', params);
      let results = data.results || [];
      if (!results.length && geminiMovie.year) {
        // Retry without year — Gemini's year guess might be off by one
        const r2 = await tmdbFetch('/search/movie', { query: geminiMovie.title });
        results = r2.results || [];
      }
      if (!results.length) return null;
      // Prefer match with matching year if available
      if (geminiMovie.year) {
        const yearMatch = results.find(r => r.release_date && r.release_date.startsWith(String(geminiMovie.year)));
        if (yearMatch) return yearMatch;
      }
      return results[0];
    } catch {
      return null;
    }
  }




  // ============ POINTS & FINES + LEVEL SYSTEM (gamification) ============
  const LEVELS = [
    { id: 'common',   name: 'CLIENTE COMUM',  threshold: 0,    color: '#888888', sub: 'novato no balcão' },
    { id: 'bronze',   name: 'CLIENTE BRONZE', threshold: 25,   color: '#cd7f32', sub: 'já conhecido na vizinhança' },
    { id: 'silver',   name: 'CLIENTE PRATA',  threshold: 75,   color: '#c0c0c0', sub: 'frequentador assíduo' },
    { id: 'gold',     name: 'CLIENTE OURO',   threshold: 150,  color: '#ffd700', sub: 'isento de multa em fitas atrasadas até 1 dia' },
    { id: 'director', name: 'DIRETORIA',      threshold: 300,  color: '#ff2e9a', sub: 'acesso aos lançamentos antes de todo mundo' },
    { id: 'vip',      name: 'SÓCIO VIP',      threshold: 600,  color: '#b026ff', sub: 'reservas vitalícias e respeito eterno' }
  ];

  function getCurrentLevel() {
    let current = LEVELS[0];
    for (const lvl of LEVELS) {
      if (state.points >= lvl.threshold) current = lvl;
      else break;
    }
    return current;
  }
  function getNextLevel() {
    const idx = LEVELS.indexOf(getCurrentLevel());
    return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  }
  function awardPoints(amount, reason) {
    const before = getCurrentLevel();
    state.points += amount;
    localStorage.setItem('vhs_points', String(state.points));
    sfx.chime();
    showToast(`+${amount} pontos — ${reason}`, 'win');
    const after = getCurrentLevel();
    if (after.id !== before.id) {
      setTimeout(() => showLevelUp(after), 700);
    }
    updateLoyaltyDisplay();
  }
  function addFine(amount, reason) {
    state.fines += amount;
    localStorage.setItem('vhs_fines', String(state.fines));
    showToast(`-R$ ${amount.toFixed(2)} — ${reason}`, 'fine');
    updateLoyaltyDisplay();
  }
  function showToast(msg, kind = 'info') {
    const t = document.createElement('div');
    t.className = `vhs-toast ${kind}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2400);
  }
  function showLevelUp(level) {
    sfx.chime();
    setTimeout(() => sfx.chime(), 180);
    setTimeout(() => sfx.chime(), 360);
    const div = document.createElement('div');
    div.className = 'level-up-overlay';
    div.innerHTML = `
      <div class="level-up-card" style="--level-color: ${level.color}">
        <div class="level-up-stars">★ ★ ★ ★ ★</div>
        <div class="level-up-rank">PARABÉNS!</div>
        <div class="level-up-title">VOCÊ AGORA É</div>
        <div class="level-up-name" style="color:${level.color}">${level.name}</div>
        <div class="level-up-sub">${level.sub}</div>
        <button onclick="this.parentElement.parentElement.remove(); sfx.click();">▶ CONTINUAR</button>
      </div>
    `;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => {
      if (div.parentElement) {
        div.classList.remove('show');
        setTimeout(() => div.remove(), 500);
      }
    }, 7000);
    document.body.dataset.level = level.id;
  }
  function updateLoyaltyDisplay() {
    const el = document.getElementById('loyalty-badge');
    if (!el) return;
    const lvl = getCurrentLevel();
    el.style.color = lvl.color;
    el.style.borderColor = lvl.color;
    el.textContent = `★ ${state.points} pts`;
    document.body.dataset.level = lvl.id;
  }

  // 🚪 EASTER EGG: Cinê Privê — secret door in the footer
  // Opens a black plastic curtain and loads exploitation/cult films from the 70s/80s
  function enterCinePrive() {
    sfx.clunk();
    if (!state.cinePrive) {
      state.cinePrive = true;
      showCurtain(() => {
        // Apply hidden filter: cult/exploitation films from 70s/80s
        state.filters = {
          keywords: [
            { id: 9937, name: 'cult film' },
            { id: 9663, name: 'b movie' }
          ],
          genres: [27, 53], // Horror, Thriller
          people: [],
          yearFrom: 1970,
          yearTo: 1989,
          ratingMin: null,
          sortBy: 'popularity.desc'
        };
        state.currentPage = 1;
        switchView('filters');
        setTimeout(() => {
          applyFilters();
          showToast('◢ BEM-VINDO À SALA DOS FUNDOS ◣', 'win');
          awardPoints(10, 'descobriu o cinê privê');
        }, 100);
      });
    } else {
      // Already discovered — quick re-entry
      state.filters = {
        keywords: [{ id: 9937, name: 'cult film' }, { id: 9663, name: 'b movie' }],
        genres: [27, 53],
        people: [],
        yearFrom: 1970, yearTo: 1989,
        ratingMin: null,
        sortBy: 'popularity.desc'
      };
      state.currentPage = 1;
      switchView('filters');
      setTimeout(() => applyFilters(), 100);
    }
  }

  function showCurtain(onComplete) {
    const curtain = document.createElement('div');
    curtain.className = 'cine-curtain';
    curtain.innerHTML = `
      <div class="curtain-half curtain-left"></div>
      <div class="curtain-half curtain-right"></div>
      <div class="curtain-sign">⚠ SOMENTE MAIORES ⚠<br><span class="curtain-sub">cinê privê</span></div>
    `;
    document.body.appendChild(curtain);
    sfx.static(0.4);
    setTimeout(() => curtain.classList.add('opening'), 50);
    setTimeout(() => {
      onComplete();
      setTimeout(() => {
        curtain.classList.add('closing');
        setTimeout(() => curtain.remove(), 600);
      }, 800);
    }, 1400);
  }

  // ============ SFX (Web Audio - sintetizado, sem arquivos) ============
  const sfx = {
    ctx: null,
    enabled: localStorage.getItem('vhs_sfx') !== 'off',

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
    // Clique mecânico curto
    click() {
      if (!this.enabled) return; this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.06);
    },
    // Estática de TV
    static(dur = 0.18) {
      if (!this.enabled) return; this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const bufSize = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'highpass'; filt.frequency.value = 1500;
      src.connect(filt).connect(gain).connect(this.ctx.destination);
      src.start(t);
    },
    // Rebobinar: usa áudio real (rewind.mp3) com fallback sintetizado
    rewind() {
      if (!this.enabled) return;
      if (!this.rewindAudio && !this.rewindAudioFailed) {
        try {
          this.rewindAudio = new Audio('rewind.mp3');
          this.rewindAudio.preload = 'auto';
          this.rewindAudio.volume = 0.6;
          this.rewindAudio.addEventListener('error', () => {
            this.rewindAudioFailed = true;
            this.rewindAudio = null;
          }, { once: true });
        } catch {
          this.rewindAudioFailed = true;
        }
      }
      if (this.rewindAudio && !this.rewindAudioFailed) {
        this.rewindAudio.currentTime = 0;
        const p = this.rewindAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => this.rewindSynth());
        }
        return;
      }
      this.rewindSynth();
    },
    // Fallback sintetizado pro rebobinar (motor + ruído)
    rewindSynth() {
      this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime; const dur = 1.4;
      const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.linearRampToValueAtTime(1600, t + 0.5);
      osc.frequency.linearRampToValueAtTime(2200, t + 1.0);
      osc.frequency.linearRampToValueAtTime(400, t + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.setValueAtTime(0.06, t + dur - 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 25;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + dur);
      lfo.start(t); lfo.stop(t + dur);
      const bufSize = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      const noise = this.ctx.createBufferSource(); noise.buffer = buf;
      const nfilt = this.ctx.createBiquadFilter();
      nfilt.type = 'bandpass'; nfilt.frequency.value = 3000;
      const ngain = this.ctx.createGain();
      ngain.gain.setValueAtTime(0.04, t);
      ngain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(nfilt).connect(ngain).connect(this.ctx.destination);
      noise.start(t);
    },
    // Clunk mecânico (botão chunky)
    clunk() {
      if (!this.enabled) return; this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.16);
    },
    // Glitch da fita mastigada
    glitch() {
      if (!this.enabled) return; this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime; const dur = 0.8;
      const bufSize = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.8 ? 1 : 0.3);
      }
      const src = this.ctx.createBufferSource(); src.buffer = buf;
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
    // Acorde de 3 notas (pontos ganhos)
    chime() {
      if (!this.enabled) return; this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = this.ctx.createOscillator(); osc.type = 'sine';
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
    // Inserir fita: usa áudio real (insert-tape.wav) com fallback sintetizado
    insertTape() {
      if (!this.enabled) return;
      // Lazy-load do elemento de áudio na primeira chamada
      if (!this.insertAudio && !this.insertAudioFailed) {
        try {
          this.insertAudio = new Audio('insert-tape.wav');
          this.insertAudio.preload = 'auto';
          this.insertAudio.volume = 0.7;
          // Se o arquivo não carregar, marca como falhou e usa fallback nas próximas
          this.insertAudio.addEventListener('error', () => {
            this.insertAudioFailed = true;
            this.insertAudio = null;
          }, { once: true });
        } catch {
          this.insertAudioFailed = true;
        }
      }
      if (this.insertAudio && !this.insertAudioFailed) {
        // Rewind e play (permite tocar de novo se o usuário spammar)
        this.insertAudio.currentTime = 0;
        const p = this.insertAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => this.insertTapeSynth());
        }
        return;
      }
      // Fallback sintetizado se o áudio não carregou
      this.insertTapeSynth();
    },
    // Fallback sintetizado (caso insert-tape.wav esteja ausente)
    insertTapeSynth() {
      this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // Clunk grave (encaixe)
      const osc = this.ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.24);
      // Chiado da fita arrastando (delay curto)
      const dur = 0.4;
      const bufSize = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const noise = this.ctx.createBufferSource(); noise.buffer = buf;
      const nfilt = this.ctx.createBiquadFilter();
      nfilt.type = 'bandpass'; nfilt.frequency.value = 2200;
      const ngain = this.ctx.createGain();
      ngain.gain.setValueAtTime(0, t + 0.05);
      ngain.gain.linearRampToValueAtTime(0.04, t + 0.1);
      ngain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(nfilt).connect(ngain).connect(this.ctx.destination);
      noise.start(t + 0.05);
    },
    // Beep curto (status / play indicator)
    beep(secs = 0.12) {
      if (!this.enabled) return; this.init(); if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = 880;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.setValueAtTime(0.08, t + secs - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + secs);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + secs);
    }
  };

  // ============ INIT ============
  function init() {
    if (state.apiKey) tryStartApp();
    // Configura o seletor de país inicial no trigger
    const initialOpt = document.querySelector(`.custom-option[data-value="${state.country}"]`);
    if (initialOpt) {
      const selectTrigger = document.getElementById('country-select-trigger');
      const triggerImg = selectTrigger.querySelector('img');
      const triggerSpan = selectTrigger.querySelector('span');
      const optImg = initialOpt.querySelector('img');
      const optSpan = initialOpt.querySelector('span');
      
      triggerImg.src = optImg.src;
      triggerImg.alt = optImg.alt;
      triggerSpan.textContent = optSpan.textContent;
    }

    // Lógica de toggle e seleção do dropdown de países
    const selectContainer = document.getElementById('country-select-container');
    const selectTrigger = document.getElementById('country-select-trigger');
    const optionsList = selectContainer.querySelectorAll('.custom-option');

    selectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      selectContainer.classList.toggle('open');
      sfx.click();
    });

    optionsList.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.getAttribute('data-value');
        state.country = val;
        localStorage.setItem('tmdb_country', val);
        
        // Atualiza o trigger
        const triggerImg = selectTrigger.querySelector('img');
        const triggerSpan = selectTrigger.querySelector('span');
        const optImg = opt.querySelector('img');
        const optSpan = opt.querySelector('span');
        
        triggerImg.src = optImg.src;
        triggerImg.alt = optImg.alt;
        triggerSpan.textContent = optSpan.textContent;
        
        selectContainer.classList.remove('open');
        sfx.clunk();
        renderView();
      });
    });

    document.addEventListener('click', () => {
      selectContainer.classList.remove('open');
    });
    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
    document.getElementById('ai-query').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') askOracle();
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => { sfx.static(); switchView(btn.dataset.view); });
    });
    // Set sfx button initial state
    const sfxBtn = document.getElementById('sfx-toggle');
    if (sfxBtn) sfxBtn.textContent = sfx.enabled ? '🔊' : '🔇';
    // Show current loyalty level badge
    updateLoyaltyDisplay();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('trailer-overlay').classList.contains('show')) {
          // Esc skips the rewind prompt
          if (document.getElementById('rewind-prompt')) closeTrailerFull();
          else closeTrailer();
        }
        else if (document.getElementById('witch-overlay').classList.contains('show')) closeWitch();
        else if (document.getElementById('settings-overlay').classList.contains('show')) closeSettingsModal();
        else closeModal();
      }
    });
  }

  // ============ SETTINGS MODAL ============
  function openSettingsModal() {
    sfx.click();
    document.getElementById('settings-overlay').classList.add('show');
    document.getElementById('omdb-key-input').value = state.omdbKey || '';
    document.getElementById('rawg-key-input').value = state.rawgKey || '';
    document.getElementById('giphy-key-input').value = state.giphyKey || '';
  }

  function closeSettingsModal() {
    document.getElementById('settings-overlay').classList.remove('show');
  }

  function saveSettingsKeys() {
    sfx.clunk();
    
    const omdb = document.getElementById('omdb-key-input').value.trim();
    const rawg = document.getElementById('rawg-key-input').value.trim();
    const giphy = document.getElementById('giphy-key-input').value.trim();
    
    state.omdbKey = omdb;
    state.rawgKey = rawg;
    state.giphyKey = giphy;
    
    localStorage.setItem('omdb_api_key', omdb);
    localStorage.setItem('rawg_api_key', rawg);
    localStorage.setItem('giphy_api_key', giphy);
    
    closeSettingsModal();
    showToast('Configurações salvas!', 'win');
  }

  async function saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) { alert('Por favor, cole uma chave válida.'); return; }
    state.apiKey = key;
    localStorage.setItem('tmdb_api_key', key);
    tryStartApp();
  }

  async function tryStartApp() {
    document.getElementById('api-setup').classList.add('hidden');
    
    // Giphy transition if key exists
    if (state.giphyKey) {
      playGiphyTransition();
    }
    
    document.getElementById('app').classList.remove('hidden');
    try {
      const data = await tmdbFetch('/genre/movie/list');
      state.genres = data.genres || [];
      renderView();
    } catch (err) {
      document.getElementById('main-content').innerHTML = `
        <div class="error-msg">
          ⚠ CHAVE INVÁLIDA OU SEM CONEXÃO ⚠<br><br>
          ${escapeHtml(err.message)}<br><br>
          <button onclick="resetApiKey()">VOLTAR E TENTAR DE NOVO</button>
        </div>`;
    }
  }

  // ============ GIPHY API (Transitions) ============
  async function playGiphyTransition() {
    sfx.static(1.5);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${state.giphyKey}&q=tv+static+glitch&limit=10&rating=g`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.data || !data.data.length) return;
      
      const gif = data.data[Math.floor(Math.random() * data.data.length)];
      const imgUrl = gif.images.original.url;
      
      let overlay = document.getElementById('tv-glitch-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tv-glitch-overlay';
        overlay.className = 'vhs-loading-overlay';
        overlay.style.zIndex = '9999';
        overlay.style.background = 'black';
        overlay.style.position = 'fixed';
        overlay.style.pointerEvents = 'none';
        
        const img = document.createElement('img');
        img.id = 'tv-glitch-img';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.opacity = '0.7';
        img.style.mixBlendMode = 'screen';
        overlay.appendChild(img);
        document.body.appendChild(overlay);
      }
      
      document.getElementById('tv-glitch-img').src = imgUrl;
      overlay.style.opacity = '1';
      overlay.style.display = 'flex';
      
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 500);
      }, 1500);
    } catch (e) {
      console.warn('Erro ao carregar Giphy transition:', e);
    }
  }

  function resetApiKey() {
    localStorage.removeItem('tmdb_api_key');
    state.apiKey = '';
    document.getElementById('api-setup').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('api-key-input').value = '';
  }

  // ============ VIEW SWITCHING ============
  function switchView(view) {
    state.view = view;
    state.currentPage = 1;
    state.currentQuery = null;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderView();
  }

  async function renderView() {
    const content = document.getElementById('main-content');
    content.innerHTML = '<div class="loading">Rebobinando fita...</div>';
    try {
      if (state.view === 'home') await renderHome();
      else if (state.view === 'filters') await renderFilters();
      else if (state.view === 'people') await renderPopularPeople();
      else if (state.view === 'favorites') renderFavorites();
      else if (state.view === 'card') renderLoyaltyCard();
    } catch (err) {
      content.innerHTML = `<div class="error-msg">⚠ ERRO: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ============ HOME ============
  async function renderHome() {
    const [popular, topRated, nowPlaying] = await Promise.all([
      tmdbFetch('/movie/popular', { page: 1 }),
      tmdbFetch('/movie/top_rated', { page: 1 }),
      tmdbFetch('/movie/now_playing', { page: 1 })
    ]);
    document.getElementById('main-content').innerHTML = `
      ${shelfSection('🔥 OS MAIS ALUGADOS', popular.results.slice(0, 12))}
      ${shelfSection('🆕 LANÇAMENTOS', nowPlaying.results.slice(0, 12))}
      ${shelfSection('⭐ ESTANTE PREMIUM', topRated.results.slice(0, 12))}
    `;
  }

  function shelfSection(title, movies) {
    return `
      <div class="section-title">${title}</div>
      ${shelfWall(movies)}
    `;
  }

  // Render a list of movies as a shelf with VHS cards in a grid
  function shelfWall(movies, opts = {}) {
    if (!movies || !movies.length) return '<div class="empty-state" style="padding:20px">prateleira vazia...</div>';
    return `
      <div class="shelf">
        <div class="vhs-grid">${movies.map(movieCard).join('')}</div>
      </div>
    `;
  }

  function movieCard(m) {
    const poster = m.poster_path
      ? `<img class="vhs-poster" src="${IMG_BASE}${m.poster_path}" alt="${escapeAttr(m.title)}" loading="lazy">`
      : `<div class="vhs-no-poster">${escapeHtml(m.title || 'SEM CAPA')}</div>`;
    const year = m.release_date ? m.release_date.slice(0, 4) : '????';
    const isFav = state.favorites.some(f => f.id === m.id);
    const title = m.title || m.name || '';
    return `
      <div class="vhs-tape" onclick="openMovie(${m.id})">
        ${isFav ? '<div class="vhs-fav-badge">★</div>' : ''}
        <div class="label">
          ${poster}
          <div class="vhs-title">${escapeHtml(title)}</div>
          <div class="vhs-year">${year}</div>
        </div>
      </div>`;
  }

  // ============ FILTERS VIEW ============
  async function renderFilters() {
    const f = state.filters;
    document.getElementById('main-content').innerHTML = `
      <div class="filter-panel">
        <h2>◢ FILTROS AVANÇADOS ◣</h2>
        <p style="color:#ddd; font-size:16px; margin-bottom:16px; line-height:1.4;">
          Combine quantos filtros quiser. O sistema soma tudo (E lógico):<br>
          <em style="color:var(--neon-yellow)">ex: terror + anos 80 + se passa em hospital</em>
        </p>

        <div class="filter-row">
          <div class="filter-label">TEMÁTICA</div>
          <div class="filter-input">
            <div class="kw-box">
              <input type="search" id="kw-search" placeholder="ex: las vegas, road trip, hospital, máfia..." autocomplete="off">
              <div class="kw-results" id="kw-results"></div>
            </div>
            <div class="chips" id="kw-chips">
              ${f.keywords.length === 0 ? '<span style="color:#666; font-size:14px; padding:0 8px;">nenhuma temática selecionada</span>' : ''}
              ${f.keywords.map(k => `<span class="chip kw-chip">${escapeHtml(k.name)}<span class="x" onclick="removeKeyword(${k.id})">✕</span></span>`).join('')}
            </div>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">GÊNEROS</div>
          <div class="genre-checks">
            ${state.genres.map(g => `
              <label class="genre-check ${f.genres.includes(g.id) ? 'active' : ''}">
                <input type="checkbox" value="${g.id}" ${f.genres.includes(g.id) ? 'checked' : ''} onchange="toggleGenre(${g.id})">
                ${escapeHtml(g.name)}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">PESSOA</div>
          <div class="filter-input">
            <div class="kw-box">
              <input type="search" id="person-search" placeholder="ator, atriz, diretor..." autocomplete="off">
              <div class="kw-results" id="person-results"></div>
            </div>
            <div class="chips" id="person-chips">
              ${f.people.length === 0 ? '<span style="color:#666; font-size:14px; padding:0 8px;">ninguém selecionado</span>' : ''}
              ${f.people.map(p => `<span class="chip person-chip">${escapeHtml(p.name)}<span class="x" onclick="removePerson(${p.id})">✕</span></span>`).join('')}
            </div>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">ANO</div>
          <div class="filter-input">
            <input type="number" id="year-from" placeholder="de" min="1900" max="2030" value="${f.yearFrom || ''}" style="max-width:120px">
            <span style="color:var(--neon-cyan)">até</span>
            <input type="number" id="year-to" placeholder="até" min="1900" max="2030" value="${f.yearTo || ''}" style="max-width:120px">
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">NOTA MIN</div>
          <div class="filter-input">
            <input type="number" id="rating-min" placeholder="0-10" min="0" max="10" step="0.5" value="${f.ratingMin || ''}" style="max-width:120px">
            <span style="color:#999; font-size:14px">★ (média do TMDB)</span>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">ORDENAR</div>
          <div class="filter-input">
            <select id="sort-by">
              <option value="popularity.desc" ${f.sortBy==='popularity.desc'?'selected':''}>Mais populares</option>
              <option value="vote_average.desc" ${f.sortBy==='vote_average.desc'?'selected':''}>Melhor avaliados</option>
              <option value="primary_release_date.desc" ${f.sortBy==='primary_release_date.desc'?'selected':''}>Mais recentes</option>
              <option value="primary_release_date.asc" ${f.sortBy==='primary_release_date.asc'?'selected':''}>Mais antigos</option>
              <option value="revenue.desc" ${f.sortBy==='revenue.desc'?'selected':''}>Maior bilheteria</option>
              <option value="title.asc" ${f.sortBy==='title.asc'?'selected':''}>Título A→Z</option>
            </select>
          </div>
        </div>

        <div class="preset-row">
          <strong>SUGESTÕES:</strong>
          <button class="preset-btn" onclick="applyPreset('roadVegas')">filme na estrada + Las Vegas + crime</button>
          <button class="preset-btn" onclick="applyPreset('horror80')">terror anos 80</button>
          <button class="preset-btn" onclick="applyPreset('noirNY')">noir em Nova York</button>
          <button class="preset-btn" onclick="applyPreset('heist')">filme de assalto</button>
          <button class="preset-btn" onclick="applyPreset('spaceTravel')">ficção no espaço</button>
          <button class="preset-btn" onclick="applyPreset('hospital')">hospital + suspense</button>
          <button class="preset-btn" onclick="applyPreset('timeloop')">loop temporal</button>
          <button class="preset-btn" onclick="applyPreset('serialKiller')">serial killer + thriller</button>
        </div>

        <div class="filter-actions">
          <button onclick="applyFilters()">▶ APLICAR FILTROS</button>
          <button class="secondary" onclick="clearFilters()">✕ LIMPAR TUDO</button>
        </div>
      </div>

      <div id="filter-results"></div>
    `;

    // Wire keyword autocomplete
    const kwInput = document.getElementById('kw-search');
    const kwResults = document.getElementById('kw-results');
    let kwTimer;
    kwInput.addEventListener('input', () => {
      clearTimeout(kwTimer);
      const q = kwInput.value.trim();
      if (!q) { kwResults.classList.remove('show'); return; }
      kwTimer = setTimeout(async () => {
        try {
          const data = await tmdbFetch('/search/keyword', { query: q });
          kwResults.innerHTML = (data.results || []).slice(0, 10)
            .map(k => `<div class="kw-item" onclick="addKeyword(${k.id}, '${escapeAttr(k.name)}')">${escapeHtml(k.name)}</div>`)
            .join('') || '<div class="kw-item" style="color:#666; cursor:default">nada encontrado</div>';
          kwResults.classList.add('show');
        } catch (e) { console.error(e); }
      }, 300);
    });
    kwInput.addEventListener('blur', () => setTimeout(() => kwResults.classList.remove('show'), 200));
    kwInput.addEventListener('focus', () => { if (kwInput.value.trim()) kwResults.classList.add('show'); });

    // Wire person autocomplete
    const personInput = document.getElementById('person-search');
    const personResults = document.getElementById('person-results');
    let personTimer;
    personInput.addEventListener('input', () => {
      clearTimeout(personTimer);
      const q = personInput.value.trim();
      if (!q) { personResults.classList.remove('show'); return; }
      personTimer = setTimeout(async () => {
        try {
          const data = await tmdbFetch('/search/person', { query: q });
          personResults.innerHTML = (data.results || []).slice(0, 10)
            .map(p => `<div class="kw-item" onclick="addPerson(${p.id}, '${escapeAttr(p.name)}')">${escapeHtml(p.name)} <span style="color:#666; font-size:13px">${escapeHtml(p.known_for_department || '')}</span></div>`)
            .join('') || '<div class="kw-item" style="color:#666; cursor:default">nada encontrado</div>';
          personResults.classList.add('show');
        } catch (e) { console.error(e); }
      }, 300);
    });
    personInput.addEventListener('blur', () => setTimeout(() => personResults.classList.remove('show'), 200));
    personInput.addEventListener('focus', () => { if (personInput.value.trim()) personResults.classList.add('show'); });

    // If filters already have values from a previous session, run them
    if (hasActiveFilters()) {
      await applyFilters();
    }
  }

  function hasActiveFilters() {
    const f = state.filters;
    return f.keywords.length || f.genres.length || f.people.length || f.yearFrom || f.yearTo || f.ratingMin;
  }

  // ============ FILTER MUTATIONS ============
  function addKeyword(id, name) {
    if (!state.filters.keywords.some(k => k.id === id)) {
      state.filters.keywords.push({ id, name });
    }
    document.getElementById('kw-search').value = '';
    document.getElementById('kw-results').classList.remove('show');
    refreshFilterUI();
  }
  function removeKeyword(id) {
    state.filters.keywords = state.filters.keywords.filter(k => k.id !== id);
    refreshFilterUI();
  }
  function addPerson(id, name) {
    if (!state.filters.people.some(p => p.id === id)) {
      state.filters.people.push({ id, name });
    }
    document.getElementById('person-search').value = '';
    document.getElementById('person-results').classList.remove('show');
    refreshFilterUI();
  }
  function removePerson(id) {
    state.filters.people = state.filters.people.filter(p => p.id !== id);
    refreshFilterUI();
  }
  function toggleGenre(id) {
    const idx = state.filters.genres.indexOf(id);
    if (idx >= 0) state.filters.genres.splice(idx, 1);
    else state.filters.genres.push(id);
    refreshFilterUI();
  }

  function refreshFilterUI() {
    const f = state.filters;
    // Chips for keywords
    const kwChips = document.getElementById('kw-chips');
    if (kwChips) {
      kwChips.innerHTML = f.keywords.length === 0
        ? '<span style="color:#666; font-size:14px; padding:0 8px;">nenhuma temática selecionada</span>'
        : f.keywords.map(k => `<span class="chip kw-chip">${escapeHtml(k.name)}<span class="x" onclick="removeKeyword(${k.id})">✕</span></span>`).join('');
    }
    // Chips for people
    const personChips = document.getElementById('person-chips');
    if (personChips) {
      personChips.innerHTML = f.people.length === 0
        ? '<span style="color:#666; font-size:14px; padding:0 8px;">ninguém selecionado</span>'
        : f.people.map(p => `<span class="chip person-chip">${escapeHtml(p.name)}<span class="x" onclick="removePerson(${p.id})">✕</span></span>`).join('');
    }
    // Genre checks
    document.querySelectorAll('.genre-check').forEach(label => {
      const cb = label.querySelector('input');
      const isActive = f.genres.includes(parseInt(cb.value));
      label.classList.toggle('active', isActive);
      cb.checked = isActive;
    });
  }

  function clearFilters() {
    state.filters = {
      keywords: [], genres: [], people: [],
      yearFrom: null, yearTo: null, ratingMin: null,
      sortBy: 'popularity.desc'
    };
    state.currentPage = 1;
    state.currentQuery = null;
    renderFilters();
  }

  // ============ PRESETS ============
  // Each preset = list of TMDB keyword IDs (real) + genre IDs
  // I verified these against TMDB's keyword/genre system
  const PRESETS = {
    roadVegas: {
      keywords: [{id:9663, name:'road trip'}, {id:6075, name:'las vegas, nevada'}],
      genres: [80] // Crime
    },
    horror80: {
      keywords: [],
      genres: [27], // Horror
      yearFrom: 1980, yearTo: 1989
    },
    noirNY: {
      keywords: [{id:212, name:'new york city'}, {id:9826, name:'film noir'}]
    },
    heist: {
      keywords: [{id:10051, name:'heist'}],
      genres: [80] // Crime
    },
    spaceTravel: {
      keywords: [{id:6078, name:'space travel'}, {id:9882, name:'space'}],
      genres: [878] // Sci-Fi
    },
    hospital: {
      keywords: [{id:1556, name:'hospital'}],
      genres: [53] // Thriller
    },
    timeloop: {
      keywords: [{id:189402, name:'time loop'}]
    },
    serialKiller: {
      keywords: [{id:10714, name:'serial killer'}],
      genres: [53] // Thriller
    }
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    state.filters.keywords = p.keywords ? [...p.keywords] : [];
    state.filters.genres = p.genres ? [...p.genres] : [];
    state.filters.people = [];
    state.filters.yearFrom = p.yearFrom || null;
    state.filters.yearTo = p.yearTo || null;
    state.filters.ratingMin = null;
    state.currentPage = 1;
    renderFilters();
  }

  // ============ APPLY FILTERS — runs the actual /discover query ============
  async function applyFilters() {
    // Read numeric inputs if present
    const yearFromEl = document.getElementById('year-from');
    const yearToEl = document.getElementById('year-to');
    const ratingEl = document.getElementById('rating-min');
    const sortEl = document.getElementById('sort-by');
    if (yearFromEl) state.filters.yearFrom = yearFromEl.value ? parseInt(yearFromEl.value) : null;
    if (yearToEl) state.filters.yearTo = yearToEl.value ? parseInt(yearToEl.value) : null;
    if (ratingEl) state.filters.ratingMin = ratingEl.value ? parseFloat(ratingEl.value) : null;
    if (sortEl) state.filters.sortBy = sortEl.value;

    state.currentQuery = { type: 'filter' };
    playThemeSfxAndGiphy();
    await loadFilteredResults();
  }

  async function playThemeSfxAndGiphy() {
    const f = state.filters;
    let themeName = null;
    if (f.genres && f.genres.length) {
      const names = f.genres.map(id => state.genres.find(g => g.id === id)?.name).filter(Boolean);
      if (names.length) themeName = names[0];
    } else if (f.keywords && f.keywords.length) {
      themeName = f.keywords[0].name;
    }

    if (!themeName) return;

    if (window.sfx && typeof sfx.chime === 'function') {
      sfx.chime();
    }

    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(themeName)}&limit=1`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const gifUrl = data.data[0].images.original.url;
        
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
        overlay.style.zIndex = '12000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.pointerEvents = 'none';
        overlay.style.transition = 'opacity 0.5s';

        const img = document.createElement('img');
        img.src = gifUrl;
        img.style.maxWidth = '80%';
        img.style.maxHeight = '70%';
        img.style.border = '4px solid var(--neon-pink)';
        img.style.boxShadow = '0 0 40px var(--neon-pink)';
        
        const text = document.createElement('div');
        text.innerText = `FILTRANDO: ${themeName.toUpperCase()}`;
        text.style.color = 'var(--neon-yellow)';
        text.style.fontFamily = "'Press Start 2P', monospace";
        text.style.fontSize = '24px';
        text.style.marginTop = '25px';
        text.style.textShadow = '4px 4px 0 var(--neon-purple)';
        text.style.animation = 'neon-pulse 1s infinite';

        overlay.appendChild(img);
        overlay.appendChild(text);
        document.body.appendChild(overlay);

        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 500);
        }, 2500);
      }
    } catch(e) {
      console.warn("Erro ao carregar Giphy:", e);
    }
  }

  async function loadFilteredResults() {
    const resultsContainer = document.getElementById('filter-results') || document.getElementById('main-content');
    resultsContainer.innerHTML = '<div class="loading">Buscando nas prateleiras...</div>';

    const f = state.filters;
    const params = { page: state.currentPage, sort_by: f.sortBy, include_adult: 'false' };

    if (f.keywords.length) params.with_keywords = f.keywords.map(k => k.id).join(',');
    if (f.genres.length) params.with_genres = f.genres.join(',');
    if (f.people.length) params.with_people = f.people.map(p => p.id).join(',');
    if (f.yearFrom) params['primary_release_date.gte'] = `${f.yearFrom}-01-01`;
    if (f.yearTo) params['primary_release_date.lte'] = `${f.yearTo}-12-31`;
    if (f.ratingMin) {
      params['vote_average.gte'] = f.ratingMin;
      params['vote_count.gte'] = 50; // avoid obscure 10/10 movies with 2 votes
    }

    try {
      const data = await tmdbFetch('/discover/movie', params);
      const totalPages = Math.min(data.total_pages, 500);
      const summary = buildFilterSummary();

      resultsContainer.innerHTML = `
        <div class="results-count">
          ${data.total_results.toLocaleString('pt-BR')} filmes encontrados ${summary ? '— ' + summary : ''}
        </div>
        ${data.results.length === 0 ? `
          <div class="empty-state">
            <div class="big">PRATELEIRA VAZIA</div>
            Nenhum filme bate com esses filtros. Tenta afrouxar um pouco!
          </div>
        ` : `
          ${shelfWall(data.results, { moviesPerRow: 14 })}
          ${paginationControls(data.page, totalPages)}
        `}
      `;
    } catch (err) {
      resultsContainer.innerHTML = `<div class="error-msg">⚠ ${escapeHtml(err.message)}</div>`;
    }
  }

  function buildFilterSummary() {
    const f = state.filters;
    const parts = [];
    if (f.keywords.length) parts.push(f.keywords.map(k => k.name).join(' + '));
    if (f.genres.length) {
      const names = f.genres.map(id => state.genres.find(g => g.id === id)?.name).filter(Boolean);
      if (names.length) parts.push(names.join(' + '));
    }
    if (f.people.length) parts.push('com ' + f.people.map(p => p.name).join(' + '));
    if (f.yearFrom || f.yearTo) {
      const from = f.yearFrom || '?';
      const to = f.yearTo || '?';
      parts.push(`${from}–${to}`);
    }
    if (f.ratingMin) parts.push(`nota ≥ ${f.ratingMin}`);
    return parts.join(', ');
  }

  function paginationControls(page, totalPages) {
    return `
      <div class="pagination">
        <button onclick="changePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>◀ ANTERIOR</button>
        <span class="page-info">PÁG ${page} / ${totalPages}</span>
        <button onclick="changePage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>PRÓXIMA ▶</button>
      </div>`;
  }

  function changePage(p) {
    state.currentPage = p;
    if (state.currentQuery?.type === 'filter') loadFilteredResults();
    else if (state.currentQuery?.type === 'search') doSearch();
    else if (state.currentQuery?.type === 'person') openPerson(state.currentQuery.id);
    else if (state.view === 'people') renderPopularPeople();
    window.scrollTo(0, 0);
  }

  // ============ POPULAR PEOPLE ============
  async function renderPopularPeople() {
    const data = await tmdbFetch('/person/popular', { page: state.currentPage });
    document.getElementById('main-content').innerHTML = `
      <div class="section-title">🎬 ATORES & DIRETORES</div>
      <div class="person-grid">${data.results.map(personCard).join('')}</div>
      ${paginationControls(data.page, Math.min(data.total_pages, 500))}
    `;
  }

  function personCard(p) {
    const img = p.profile_path
      ? `<img src="${IMG_BASE}${p.profile_path}" alt="${escapeAttr(p.name)}" loading="lazy">`
      : `<div class="vhs-no-poster">${escapeHtml(p.name)}</div>`;
    const known = (p.known_for_department || '')
      .replace('Acting','Atuação').replace('Directing','Direção').replace('Writing','Roteiro');
    return `
      <div class="person-card" onclick="openPerson(${p.id})">
        ${img}
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="known">${escapeHtml(known)}</div>
      </div>`;
  }

  async function openPerson(personId) {
    state.currentQuery = { type: 'person', id: personId };
    const content = document.getElementById('main-content');
    content.innerHTML = '<div class="loading">Buscando filmografia...</div>';
    try {
      const [person, credits] = await Promise.all([
        tmdbFetch(`/person/${personId}`),
        tmdbFetch(`/person/${personId}/movie_credits`)
      ]);
      const seen = new Set();
      const all = [];
      [...(credits.cast || []), ...(credits.crew || [])].forEach(c => {
        if (!seen.has(c.id) && c.release_date) {
          seen.add(c.id);
          all.push(c);
        }
      });
      all.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));

      content.innerHTML = `
        <div class="breadcrumb">
          <button class="back-btn" onclick="state.currentPage=1; switchView('people')">◀ VOLTAR</button>
          Filmografia: <strong>${escapeHtml(person.name)}</strong>
          ${person.known_for_department ? `<span style="color:#999"> — ${escapeHtml(person.known_for_department)}</span>` : ''}
          <button class="tiny" style="margin-left:10px" onclick="addPersonToFilters(${person.id}, '${escapeAttr(person.name)}')">+ ADD AOS FILTROS</button>
        </div>
        ${shelfWall(all, { moviesPerRow: 14 })}`;
    } catch (err) {
      content.innerHTML = `<div class="error-msg">⚠ ${escapeHtml(err.message)}</div>`;
    }
  }

  function addPersonToFilters(id, name) {
    if (!state.filters.people.some(p => p.id === id)) {
      state.filters.people.push({ id, name });
    }
    switchView('filters');
  }

  // ============ FREE SEARCH ============
  async function doSearch() {
    const q = document.getElementById('search-input').value.trim();
    if (!q) return;
    if (state.currentQuery?.type !== 'search' || state.currentQuery?.q !== q) {
      state.currentPage = 1;
    }
    state.currentQuery = { type: 'search', q };
    const content = document.getElementById('main-content');
    content.innerHTML = '<div class="loading">Procurando nas prateleiras...</div>';
    try {
      const data = await tmdbFetch('/search/multi', { query: q, page: state.currentPage });
      const movies = data.results.filter(r => r.media_type === 'movie');
      const people = data.results.filter(r => r.media_type === 'person');

      let html = `
        <div class="breadcrumb">
          <button class="back-btn" onclick="state.currentPage=1; switchView('home')">◀ INÍCIO</button>
          Resultados para: <strong>"${escapeHtml(q)}"</strong>
        </div>`;
      if (people.length) {
        html += `<div class="section-title">PESSOAS</div>
          <div class="person-grid">${people.slice(0, 6).map(personCard).join('')}</div>`;
      }
      if (movies.length) {
        html += `<div class="section-title">FILMES</div>
          ${shelfWall(movies, { moviesPerRow: 14 })}
          ${paginationControls(data.page, Math.min(data.total_pages, 500))}`;
      }
      if (!movies.length && !people.length) {
        html += `<div class="empty-state"><div class="big">SEM RESULTADOS</div>Nada na fita. Tenta outra busca!</div>`;
      }
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<div class="error-msg">⚠ ${escapeHtml(err.message)}</div>`;
    }
  }

  // ============ FAVORITES ============
  function renderFavorites() {
    const content = document.getElementById('main-content');
    if (!state.favorites.length) {
      content.innerHTML = `
        <div class="section-title">★ MINHA ESTANTE</div>
        <div class="empty-state">
          <div class="big">ESTANTE VAZIA</div>
          Adicione filmes à sua estante clicando em qualquer fita e depois em "ADICIONAR À ESTANTE".
        </div>`;
      return;
    }
    content.innerHTML = `
      <div class="section-title">★ MINHA ESTANTE (${state.favorites.length})</div>
      ${shelfWall(state.favorites, { moviesPerRow: 14 })}

      <div class="return-box" id="return-box"
           ondragover="handleReturnDragOver(event)"
           ondragleave="handleReturnDragLeave(event)"
           ondrop="handleReturnDrop(event)">
        <div class="return-box-label">▼ DEVOLUÇÃO 24h ▼</div>
        <div class="return-box-slot"></div>
        <div class="return-box-hint">
          arraste uma fita aqui pra <kbd>devolver</kbd>
        </div>
      </div>
    `;

    // Wire up drag handlers on each VHS card in favorites
    content.querySelectorAll('.vhs-tape').forEach(tape => {
      tape.setAttribute('draggable', 'true');
      tape.addEventListener('dragstart', handleTapeDragStart);
      tape.addEventListener('dragend', handleTapeDragEnd);
    });
  }

  // ============ RETURN BOX (drag-drop to remove from favorites) ============
  let draggedTapeId = null;

  function handleTapeDragStart(e) {
    const card = e.currentTarget;
    // The card has onclick="openMovie(123)" — extract the ID
    const onclickAttr = card.getAttribute('onclick') || '';
    const match = onclickAttr.match(/openMovie\((\d+)\)/);
    if (!match) return;
    draggedTapeId = parseInt(match[1], 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/plain', String(draggedTapeId));
    sfx.click();
  }

  function handleTapeDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
  }

  function handleReturnDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.getElementById('return-box').classList.add('drag-over');
  }

  function handleReturnDragLeave(e) {
    // Only remove highlight when leaving the box itself (not its children)
    if (e.currentTarget === e.target) {
      document.getElementById('return-box').classList.remove('drag-over');
    }
  }

  function handleReturnDrop(e) {
    e.preventDefault();
    const box = document.getElementById('return-box');
    box.classList.remove('drag-over');
    if (!draggedTapeId) return;
    const tapeId = draggedTapeId;
    draggedTapeId = null;

    // Find the card to animate "falling in"
    const card = document.querySelector(`.vhs-tape[onclick*="openMovie(${tapeId})"]`);
    if (card) {
      card.classList.add('falling-in-box');
      sfx.clunk();
    }
    setTimeout(() => {
      // Actually remove from favorites
      const idx = state.favorites.findIndex(f => f.id === tapeId);
      if (idx >= 0) {
        const movie = state.favorites[idx];
        state.favorites.splice(idx, 1);
        localStorage.setItem('vhs_favorites', JSON.stringify(state.favorites));
        showToast(`📼 "${movie.title}" devolvida`, 'info');
        renderFavorites();
      }
    }, 600);
  }

  // ============ LOYALTY CARD VIEW ============
  function renderLoyaltyCard() {
    const lvl = getCurrentLevel();
    const next = getNextLevel();
    const content = document.getElementById('main-content');
    const memberSince = localStorage.getItem('vhs_member_since') || (() => {
      const d = new Date().toISOString().slice(0, 10);
      localStorage.setItem('vhs_member_since', d);
      return d;
    })();
    const memberId = localStorage.getItem('vhs_member_id') || (() => {
      const id = String(Math.floor(Math.random() * 900000) + 100000);
      localStorage.setItem('vhs_member_id', id);
      return id;
    })();
    const progress = next ? Math.min(100, Math.round(((state.points - lvl.threshold) / (next.threshold - lvl.threshold)) * 100)) : 100;
    const pointsToNext = next ? (next.threshold - state.points) : 0;

    content.innerHTML = `
      <div class="section-title">★ MEU CARTÃO DE FIDELIDADE ★</div>

      <div class="loyalty-card-container">
        <div class="loyalty-card" data-level="${lvl.id}" style="--card-color: ${lvl.color}">
          <div class="loyalty-card-shine"></div>
          <div class="loyalty-card-header">
            <div class="loyalty-card-logo">
              <span class="logo-vhs">VHS</span> RENTAL
            </div>
            <div class="loyalty-card-chip"></div>
          </div>
          <div class="loyalty-card-rank">${lvl.name}</div>
          <div class="loyalty-card-sub">${lvl.sub}</div>
          <div class="loyalty-card-id">
            <div class="loyalty-card-field">
              <div class="field-label">SÓCIO Nº</div>
              <div class="field-value">${memberId}</div>
            </div>
            <div class="loyalty-card-field">
              <div class="field-label">DESDE</div>
              <div class="field-value">${memberSince}</div>
            </div>
          </div>
          <div class="loyalty-card-stripe"></div>
        </div>
      </div>

      <div class="loyalty-stats">
        <div class="loyalty-stat">
          <div class="stat-value" style="color:${lvl.color}">${state.points}</div>
          <div class="stat-label">PONTOS</div>
        </div>
        <div class="loyalty-stat">
          <div class="stat-value" style="color:var(--neon-pink)">R$ ${state.fines.toFixed(2)}</div>
          <div class="stat-label">MULTAS</div>
        </div>
        <div class="loyalty-stat">
          <div class="stat-value" style="color:var(--neon-cyan)">${state.favorites.length}</div>
          <div class="stat-label">NA ESTANTE</div>
        </div>
      </div>

      ${next ? `
        <div class="progress-section">
          <div class="progress-label">
            <span>Faltam <strong style="color:${next.color}">${pointsToNext} pontos</strong> para</span>
            <span style="color:${next.color}; font-family:'Press Start 2P', monospace; font-size:11px;">${next.name}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%; background:${next.color}"></div>
          </div>
        </div>
      ` : `
        <div class="progress-section" style="text-align:center; padding:18px;">
          <div style="font-family:'Press Start 2P', monospace; font-size:12px; color:var(--neon-yellow); animation: neon-pulse 1.5s infinite;">★ NÍVEL MÁXIMO ATINGIDO ★</div>
        </div>
      `}

      <div class="levels-list">
        <h3>★ TODOS OS NÍVEIS ★</h3>
        ${LEVELS.map(l => `
          <div class="level-row ${state.points >= l.threshold ? 'achieved' : ''} ${l.id === lvl.id ? 'current' : ''}" style="--row-color:${l.color}">
            <span class="level-row-icon">${state.points >= l.threshold ? '✓' : '◌'}</span>
            <span class="level-row-name">${l.name}</span>
            <span class="level-row-threshold">${l.threshold} pts</span>
            <span class="level-row-sub">${l.sub}</span>
          </div>
        `).join('')}
      </div>

      <div class="how-to-earn">
        <h3>★ COMO GANHAR PONTOS ★</h3>
        <div class="earn-grid">
          <div class="earn-item"><span class="earn-pts">+3</span> adicionar fita à estante</div>
          <div class="earn-item"><span class="earn-pts">+5</span> rebobinar a fita após o trailer</div>
          <div class="earn-item"><span class="earn-pts">+2</span> consultar a Madame VHS</div>
          <div class="earn-item"><span class="earn-pts">+2</span> limpar cabeçote de fita mastigada</div>
          <div class="earn-item"><span class="earn-pts">+10</span> descobrir easter eggs</div>
          <div class="earn-item fine-item"><span class="earn-pts">-R$1</span> não rebobinar (multa)</div>
        </div>
      </div>

      <div style="text-align:center; margin-top:24px;">
        <button class="secondary" onclick="resetLoyalty()" style="font-size:9px; padding:6px 10px;">⚠ ZERAR CADASTRO ⚠</button>
      </div>
    `;
  }

  function resetLoyalty() {
    if (!confirm('Tem certeza? Vai zerar pontos, multas e cadastro de fidelidade.')) return;
    state.points = 0;
    state.fines = 0;
    localStorage.removeItem('vhs_points');
    localStorage.removeItem('vhs_fines');
    localStorage.removeItem('vhs_member_since');
    localStorage.removeItem('vhs_member_id');
    delete document.body.dataset.level;
    updateLoyaltyDisplay();
    renderLoyaltyCard();
  }

  function toggleFavorite(movie) {
    const idx = state.favorites.findIndex(f => f.id === movie.id);
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
      sfx.click();
    } else {
      state.favorites.push({
        id: movie.id, title: movie.title,
        poster_path: movie.poster_path, release_date: movie.release_date
      });
      awardPoints(3, 'fita adicionada à estante');
    }
    localStorage.setItem('vhs_favorites', JSON.stringify(state.favorites));
    if (document.getElementById('modal-overlay').classList.contains('show')) openMovie(movie.id);
    if (state.view === 'favorites') renderFavorites();
  }

  // ============ TRAILERS ============
  // Try localized videos first; if empty, fall back to English
  async function fetchTrailers(movieId) {
    try {
      const localized = await tmdbFetch(`/movie/${movieId}/videos`);
      if (localized.results && localized.results.length) return localized.results;
      // Fallback to English — for non-English regions, many movies only have EN trailers
      const parts = state.country.split('-');
      const language = parts.slice(1).join('-');
      if (language !== 'en-US') {
        const en = await tmdbFetchRaw(`/movie/${movieId}/videos`, { language: 'en-US' });
        return en.results || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  // tmdbFetch but lets us override language without touching country state
  async function tmdbFetchRaw(path, overrideParams = {}) {
    const parts = state.country.split('-');
    const region = parts[0];
    const language = parts.slice(1).join('-');
    const params = new URLSearchParams({ language, region, ...overrideParams });
    const headers = { 'Content-Type': 'application/json' };
    let url;
    if (isV4Token(state.apiKey)) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
      url = `${TMDB_BASE}${path}?${params}`;
    } else {
      params.set('api_key', state.apiKey);
      url = `${TMDB_BASE}${path}?${params}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  // tmdbFetch for endpoints that don't accept language/region params (e.g. /watch/providers)
  async function tmdbFetchNoLang(path) {
    const headers = { 'Content-Type': 'application/json' };
    let url;
    if (isV4Token(state.apiKey)) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
      url = `${TMDB_BASE}${path}`;
    } else {
      url = `${TMDB_BASE}${path}?api_key=${encodeURIComponent(state.apiKey)}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  // Pick the best trailer from a list of videos
  function pickBestTrailer(videos) {
    if (!videos || !videos.length) return null;
    // Filter only YouTube videos (TMDB also has Vimeo but YT embeds are universal)
    const yt = videos.filter(v => v.site === 'YouTube' && v.key);
    if (!yt.length) return null;
    // Priority: official Trailer > Trailer > official Teaser > Teaser > anything official > first
    const scored = yt.map(v => {
      let score = 0;
      if (v.type === 'Trailer') score += 100;
      else if (v.type === 'Teaser') score += 50;
      else if (v.type === 'Clip') score += 10;
      if (v.official) score += 20;
      // Prefer recent (TMDB returns published_at)
      if (v.published_at) score += 1;
      return { v, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].v;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function saveTapePositions() {
    localStorage.setItem('vhs_tape_positions', JSON.stringify(state.tapePositions));
  }

  function initYouTubePlayer(youtubeKey, startSeconds) {
    if (window.YT && window.YT.Player) {
      state.ytPlayer = new YT.Player('yt-player-container', {
        videoId: youtubeKey,
        playerVars: {
          'autoplay': 1,
          'rel': 0,
          'start': Math.floor(startSeconds)
        }
      });
    } else {
      document.getElementById('yt-player-container').outerHTML = `
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0&start=${Math.floor(startSeconds)}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
      `;
    }
  }

  function playTrailer(youtubeKey, movieId) {
    sfx.insertTape();
    const overlay = document.getElementById('trailer-overlay');
    const playerContainer = document.getElementById('trailer-player');
    const title = state.trailerTitles[movieId] || 'Trailer';
    
    state.currentTrailerId = movieId;
    state.currentTrailerKey = youtubeKey;
    state.ytPlayer = null;
    state.currentTrailerTime = 0;
    
    let savedTime = state.tapePositions[movieId] || 0;
    
    if (savedTime > 0) {
      playerContainer.innerHTML = `
        <button class="trailer-close" onclick="closeTrailerFull()" aria-label="Fechar">×</button>
        <div class="trailer-title">▶ ${escapeHtml(title)}</div>
        <div class="unrewound-prompt">
          <div class="unrewound-marquee">⚠ ATENÇÃO: FITA NÃO REBOBINADA ⚠</div>
          <p>Esta fita parou em <span style="color:var(--neon-pink)">${formatTime(savedTime)}</span>.</p>
          <div class="unrewound-actions">
            <button class="rewind-btn" onclick="startTrailerRewound()">◀◀ REBOBINAR (00:00)</button>
            <button class="rewind-skip" onclick="startTrailerContinued()">▶ CONTINUAR</button>
          </div>
        </div>
      `;
      overlay.classList.add('show');
    } else {
      renderTrailerPlayer(youtubeKey, title, 0);
      overlay.classList.add('show');
    }
  }

  function renderTrailerPlayer(youtubeKey, title, startSeconds) {
    sfx.beep(1.5);
    const playerContainer = document.getElementById('trailer-player');
    const displayTime = `00:${formatTime(startSeconds || 0)}`;
    playerContainer.innerHTML = `
      <button class="trailer-close" onclick="closeTrailer()" aria-label="Fechar">×</button>
      <div class="trailer-title">▶ ${escapeHtml(title)}</div>
      <div class="trailer-frame-wrap">
        <div id="yt-player-container"></div>
        <div class="vhs-loading-overlay" id="vhs-loading-overlay">
          <img src="https://media.giphy.com/media/11v8gJRwB2fE3u/giphy.gif" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.6; mix-blend-mode: screen;">
          <div class="vhs-tracking-line"></div>
          <div class="vhs-play-indicator">PLAY ▶</div>
          <div class="vhs-time-counter">${displayTime}</div>
        </div>
      </div>
    `;
    initYouTubePlayer(youtubeKey, startSeconds);

    // Esconde a tela de transição de barras coloridas com fade out após 1.6 segundos
    setTimeout(() => {
      const overlay = document.getElementById('vhs-loading-overlay');
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
      }
    }, 1600);
  }

  function startTrailerRewound() {
    sfx.rewind();
    delete state.tapePositions[state.currentTrailerId];
    saveTapePositions();
    const title = state.trailerTitles[state.currentTrailerId] || 'Trailer';
    renderTrailerPlayer(state.currentTrailerKey, title, 0);
  }

  function startTrailerContinued() {
    sfx.clunk();
    const title = state.trailerTitles[state.currentTrailerId] || 'Trailer';
    const savedTime = state.tapePositions[state.currentTrailerId] || 0;
    renderTrailerPlayer(state.currentTrailerKey, title, savedTime);
  }

  function closeTrailer() {
    const overlay = document.getElementById('trailer-overlay');
    const player = document.getElementById('trailer-player');
    
    state.currentTrailerTime = 0;
    if (state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function') {
      try {
        state.currentTrailerTime = state.ytPlayer.getCurrentTime();
      } catch(e) {}
    }
    
    // Stop playback immediately
    player.innerHTML = `
      <div class="rewind-prompt" id="rewind-prompt">
        <div class="rewind-marquee">⚠ POR FAVOR, REBOBINE A FITA PARA O PRÓXIMO CLIENTE ⚠</div>
        <div class="rewind-cassette">
          <div class="cassette-reels">
            <div class="reel reel-left"></div>
            <div class="reel reel-right"></div>
          </div>
          <div class="cassette-label">VHS-${Math.floor(Math.random() * 9000 + 1000)}</div>
        </div>
        <div class="rewind-actions">
          <button class="rewind-btn" onclick="doRewind()">◀◀ REBOBINAR</button>
          <button class="rewind-skip" onclick="skipRewind()">deixar assim e pagar multa</button>
        </div>
        <div class="rewind-fineprint">multa: R$ 1,00 por fita não rebobinada</div>
      </div>
    `;
    // Auto-skip after 8 seconds if user just walks away
    state.rewindTimer = setTimeout(() => {
      if (document.getElementById('rewind-prompt')) skipRewind();
    }, 8000);
  }

  // The actual rewind animation + reward
  function doRewind() {
    if (state.rewindTimer) clearTimeout(state.rewindTimer);
    sfx.rewind();
    const prompt = document.getElementById('rewind-prompt');
    if (!prompt) { closeTrailerFull(); return; }
    prompt.classList.add('rewinding');
    
    if (state.currentTrailerId) {
      delete state.tapePositions[state.currentTrailerId];
      saveTapePositions();
    }
    
    // Award points
    awardPoints(5, 'rebobinou a fita');
    setTimeout(() => {
      closeTrailerFull();
    }, 1500);
  }

  function skipRewind() {
    if (state.rewindTimer) clearTimeout(state.rewindTimer);
    // Cliente Ouro+ é isento de multa por fita não rebobinada
    const lvl = getCurrentLevel();
    if (['gold', 'director', 'vip'].includes(lvl.id)) {
      showToast('★ Cliente ' + (lvl.id === 'gold' ? 'Ouro' : lvl.name) + ' — multa perdoada', 'win');
    } else {
      addFine(1, 'fita não rebobinada');
    }
    
    if (state.currentTrailerTime > 0 && state.currentTrailerId) {
      state.tapePositions[state.currentTrailerId] = state.currentTrailerTime;
      saveTapePositions();
    }
    
    closeTrailerFull();
  }

  function closeTrailerFull() {
    const overlay = document.getElementById('trailer-overlay');
    overlay.classList.remove('show');
    document.getElementById('trailer-player').innerHTML = '';
  }

  // ============ OMDB API (Rotten Tomatoes, Metacritic, Awards) ============
  async function loadOMDbExtras(movieId, title, year) {
    if (!state.omdbKey) return;
    try {
      const yParam = year && year !== '????' ? `&y=${year}` : '';
      const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}${yParam}&apikey=${state.omdbKey}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.Response === 'False') return;

      // 1. Injetar Marquee de Prêmios (Awards) se houver
      if (data.Awards && data.Awards !== 'N/A') {
        const awardsContainer = document.getElementById(`omdb-awards-${movieId}`);
        if (awardsContainer) {
          awardsContainer.innerHTML = `
            <div class="omdb-awards-marquee">
              <span>🏆 ${escapeHtml(data.Awards)} 🏆</span>
            </div>
          `;
        }
      }

      // 2. Injetar badges de notas (Rotten Tomatoes / Metacritic)
      const ratingsContainer = document.getElementById(`omdb-ratings-${movieId}`);
      if (ratingsContainer) {
        let ratingsHtml = '';
        if (data.Ratings) {
          const rt = data.Ratings.find(r => r.Source === 'Rotten Tomatoes');
          if (rt) ratingsHtml += `<span class="omdb-rating-badge rt">${escapeHtml(rt.Value)}</span>`;
        }
        if (data.Metascore && data.Metascore !== 'N/A') {
          ratingsHtml += `<span class="omdb-rating-badge mc">${escapeHtml(data.Metascore)}</span>`;
        }
        ratingsContainer.innerHTML = ratingsHtml;
      }
    } catch (e) {
      console.warn('Erro ao carregar OMDb extras:', e);
    }
  }

  // ============ RAWG API (Retro Games) ============
  async function loadRetroGame(movieId, title, releaseYearStr) {
    if (!state.rawgKey) return;
    const releaseYear = parseInt(releaseYearStr, 10);
    // Só procura jogos baseados no filme se o filme for até 2005
    if (isNaN(releaseYear) || releaseYear > 2005) return;

    try {
      const res = await fetch(`https://api.rawg.io/api/games?key=${state.rawgKey}&search=${encodeURIComponent(title)}&search_exact=true&page_size=5`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.results || data.results.length === 0) return;

      // Filtra o jogo que tem um nome bem parecido e foi lançado na mesma época do filme ou pouco depois
      const game = data.results.find(g => {
        if (!g.released) return false;
        const gYear = parseInt(g.released.split('-')[0], 10);
        return gYear <= 2005 && g.name.toLowerCase().includes(title.toLowerCase());
      });

      if (game) {
        const gameContainer = document.getElementById(`rawg-game-${movieId}`);
        if (gameContainer) {
          const platStr = game.platforms && game.platforms.length > 0 
            ? game.platforms[0].platform.name 
            : 'RETRO CONSOLE';
            
          gameContainer.innerHTML = `
            <div class="rawg-game-sticker" onclick="window.open('https://rawg.io/games/${game.slug}', '_blank')">
              <div class="rawg-game-header">★ DISPONÍVEL EM CARTUCHO ★</div>
              ${game.background_image ? `<img src="${game.background_image}" class="rawg-game-cover" alt="Game cover">` : ''}
              <div class="rawg-game-platform">${escapeHtml(platStr.toUpperCase())}</div>
            </div>
          `;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar RAWG retro game:', e);
    }
  }

  // ============ DEEZER SOUNDTRACK (via JSONP - sem chave, sem CORS) ============
  // A API da Deezer não tem CORS aberto, mas oferece JSONP oficial.
  // Injetamos <script> dinâmico com callback nomeado.
  let deezerCallbackCounter = 0;
  function fetchDeezerSoundtrack(movieTitle) {
    return new Promise((resolve) => {
      const cbName = `__deezerCb${++deezerCallbackCounter}`;
      const timeoutMs = 6000;
      // Busca: título + "soundtrack" pra puxar trilhas sonoras
      const q = `${movieTitle} soundtrack`;
      const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8&output=jsonp&callback=${cbName}`;
      const script = document.createElement('script');
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        try { delete window[cbName]; } catch { window[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      };
      const timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
      window[cbName] = (data) => {
        clearTimeout(timer);
        cleanup();
        resolve(data && data.data ? data.data : null);
      };
      script.onerror = () => { clearTimeout(timer); cleanup(); resolve(null); };
      script.src = url;
      document.head.appendChild(script);
    });
  }

  // Renderiza a seção de trilha sonora dentro do modal
  function renderSoundtrackSection(movieId) {
    return `
      <div class="soundtrack-section" id="soundtrack-${movieId}">
        <h3>🎵 TRILHA SONORA</h3>
        <div class="soundtrack-loading">vasculhando os discos da gravadora...</div>
      </div>
    `;
  }

  // Busca e popula assincronamente após o modal abrir
  async function loadSoundtrack(movieId, movieTitle) {
    const container = document.getElementById(`soundtrack-${movieId}`);
    if (!container) return;
    const tracks = await fetchDeezerSoundtrack(movieTitle);
    if (!tracks || !tracks.length) {
      container.innerHTML = `
        <h3>🎵 TRILHA SONORA</h3>
        <div class="soundtrack-empty">
          Não achei a trilha na gravadora.
          <a href="https://www.deezer.com/search/${encodeURIComponent(movieTitle + ' soundtrack')}"
             target="_blank" rel="noopener" class="soundtrack-search-link">
            ▶ Procurar manualmente no Deezer ↗
          </a>
        </div>
      `;
      return;
    }
    // Top 5 tracks com preview disponível
    const withPreview = tracks.filter(t => t.preview).slice(0, 5);
    const items = (withPreview.length ? withPreview : tracks.slice(0, 5));
    container.innerHTML = `
      <h3>🎵 TRILHA SONORA</h3>
      <div class="soundtrack-list">
        ${items.map((t, i) => `
          <div class="track-row" data-preview="${escapeAttr(t.preview || '')}" onclick="playPreview(this)">
            <div class="track-cover">
              ${t.album && t.album.cover_small
                ? `<img src="${t.album.cover_small}" alt="" loading="lazy">`
                : `<div class="track-cover-blank">♪</div>`}
              <div class="track-play-overlay">▶</div>
            </div>
            <div class="track-info">
              <div class="track-title">${escapeHtml(t.title || '')}</div>
              <div class="track-artist">${escapeHtml(t.artist?.name || '')}</div>
            </div>
            <div class="track-duration">${formatTrackTime(t.duration)}</div>
          </div>
        `).join('')}
      </div>
      <div class="soundtrack-foot">
        <span>preview de ~30s · </span>
        <a href="https://www.deezer.com/search/${encodeURIComponent(movieTitle + ' soundtrack')}"
           target="_blank" rel="noopener">trilha completa no Deezer ↗</a>
      </div>
    `;
  }

  function formatTrackTime(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // Audio único pra preview — pausa o anterior antes de tocar o próximo
  let currentPreview = null;
  function playPreview(rowEl) {
    const url = rowEl.dataset.preview;
    if (!url) {
      showToast('preview indisponível', 'fine');
      return;
    }
    // Para anterior
    if (currentPreview) {
      currentPreview.audio.pause();
      currentPreview.row.classList.remove('playing');
    }
    // Se clicou no mesmo, é toggle (já parou em cima)
    if (currentPreview && currentPreview.row === rowEl) {
      currentPreview = null;
      return;
    }
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.play().catch(() => showToast('navegador bloqueou o preview', 'fine'));
    rowEl.classList.add('playing');
    audio.addEventListener('ended', () => {
      rowEl.classList.remove('playing');
      if (currentPreview && currentPreview.row === rowEl) currentPreview = null;
    });
    currentPreview = { audio, row: rowEl };
  }

  function stopAnyPreview() {
    if (currentPreview) {
      currentPreview.audio.pause();
      currentPreview.row.classList.remove('playing');
      currentPreview = null;
    }
  }

  // ============ WATCH PROVIDERS (where to watch) ============
  // Friendly labels for each provider type
  const PROVIDER_LABELS = {
    flatrate: { label: 'STREAMING', color: 'var(--neon-green)' },
    free: { label: 'GRÁTIS', color: 'var(--neon-yellow)' },
    ads: { label: 'GRÁTIS C/ ANÚNCIOS', color: 'var(--neon-yellow)' },
    rent: { label: 'ALUGAR', color: 'var(--neon-cyan)' },
    buy: { label: 'COMPRAR', color: 'var(--neon-pink)' }
  };

  // ============ VHS ENCARTE HELPERS (specs, classificação, barcode) ============

  // Determina o "selo de classificação" antigo baseado no rating e no adult flag
  // Mapeia vote_average + adult flag pra um valor estimado já que TMDB não dá essa info direta
  function pickAgeSeal(movie) {
    if (movie.adult) return { age: '18', label: 'IMPRÓPRIO MENORES DE 18', cls: '18' };
    const genres = (movie.genres || []).map(g => g.id);
    const HORROR = 27, THRILLER = 53, WAR = 10752, CRIME = 80;
    const violentGenre = genres.some(id => [HORROR, THRILLER, WAR, CRIME].includes(id));
    // Heurística aproximada — TMDB não expõe a classificação BR sem outra chamada cara
    if (violentGenre && genres.includes(HORROR)) return { age: '16', label: 'NÃO RECOMENDADO MENORES DE 16', cls: '16' };
    if (violentGenre) return { age: '14', label: 'NÃO RECOMENDADO MENORES DE 14', cls: '14' };
    if (genres.includes(THRILLER) || genres.includes(CRIME)) return { age: '12', label: 'NÃO RECOMENDADO MENORES DE 12', cls: '12' };
    const ANIMATION = 16, FAMILY = 10751;
    if (genres.includes(ANIMATION) || genres.includes(FAMILY)) return { age: 'L', label: 'LIVRE PARA TODOS OS PÚBLICOS', cls: 'L' };
    if (genres.includes(10749 /* Romance */) || genres.includes(35 /* Comedy */)) return { age: '10', label: 'NÃO RECOMENDADO MENORES DE 10', cls: '10' };
    return { age: '12', label: 'NÃO RECOMENDADO MENORES DE 12', cls: '12' };
  }

  function renderAgeSeal(movie) {
    const s = pickAgeSeal(movie);
    return `
      <div class="age-seal-wrap">
        <div class="age-seal age-seal-${s.cls}" title="${s.label}">
          <div class="age-seal-num">${s.age}</div>
          <div class="age-seal-sub">${s.cls === 'L' ? 'LIVRE' : 'ANOS'}</div>
        </div>
      </div>
    `;
  }

  // VHS specs row (Hi-Fi, NTSC, Colorido, Dolby) — sempre os mesmos pra todo filme,
  // porque na época toda fita "boa" tinha esses selos
  function renderVhsSpecs(movie) {
    const isOld = movie.release_date && parseInt(movie.release_date.slice(0,4)) < 1965;
    return `
      <div class="vhs-specs">
        ${isOld ? '<span class="vhs-spec bw">B&amp;W</span>' : '<span class="vhs-spec color">COLORIDO</span>'}
        <span class="vhs-spec hifi">★ Hi-Fi STEREO</span>
        <span class="vhs-spec ntsc">NTSC</span>
        <span class="vhs-spec dolby">DOLBY SURROUND</span>
        <span class="vhs-spec sp">SP / 120 MIN</span>
      </div>
    `;
  }

  // Barcode at the bottom (purely visual — random widths for that 90s feel)
  function renderBarcode(movie) {
    // Deterministic "random" widths based on movie.id so it doesn't reflow on each render
    const seed = movie.id || 1;
    let bars = '';
    let s = seed;
    for (let i = 0; i < 50; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const w = 1 + (s % 4);
      bars += `<div class="bar" style="width:${w}px"></div>`;
    }
    const upc = String(seed).padStart(12, '0').slice(0, 12);
    return `
      <div class="vhs-barcode">
        <div class="barcode-lines">${bars}</div>
        <div class="barcode-text">
          <span class="small">VHS · ${movie.original_language ? movie.original_language.toUpperCase() : 'XX'} · NTSC</span>
          ${upc.slice(0,1)} ${upc.slice(1,7)} ${upc.slice(7,12)}
        </div>
      </div>
    `;
  }


  // Render the "where to watch" section for the current country
  function renderWatchProviders(providersData, movieTitle) {
    // Extract country code from state.country (e.g. "BR-pt-BR" → "BR")
    const countryCode = state.country.split('-')[0];
    const results = providersData?.results || {};
    const countryData = results[countryCode];

    if (!countryData) {
      // No providers for this country — show a friendly message + JustWatch search link
      const searchUrl = `https://www.justwatch.com/${countryCode.toLowerCase()}/busca?q=${encodeURIComponent(movieTitle)}`;
      return `
        <div class="watch-section">
          <h3>📺 ONDE ASSISTIR</h3>
          <div class="watch-empty">
            Não localizei provedores no seu país (${countryCode}).
            <a href="${searchUrl}" target="_blank" rel="noopener" class="watch-justwatch-link">
              ▶ Buscar no JustWatch ↗
            </a>
          </div>
          <div class="watch-attribution">dados via JustWatch</div>
        </div>
      `;
    }

    const tmdbLink = countryData.link;
    const sections = [];

    // Order matters: flatrate first (most useful), then free, ads, rent, buy
    ['flatrate', 'free', 'ads', 'rent', 'buy'].forEach(type => {
      const items = countryData[type];
      if (!items || !items.length) return;
      const cfg = PROVIDER_LABELS[type];
      sections.push(`
        <div class="watch-row">
          <span class="watch-label" style="color:${cfg.color}; border-color:${cfg.color}">${cfg.label}</span>
          <div class="watch-providers">
            ${items.map(p => `
              <a href="${tmdbLink || '#'}" target="_blank" rel="noopener" class="watch-provider" title="${escapeAttr(p.provider_name)}">
                ${p.logo_path
                  ? `<img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${escapeAttr(p.provider_name)}" loading="lazy">`
                  : `<div class="watch-provider-fallback">${escapeHtml(p.provider_name)}</div>`}
                <span class="watch-provider-name">${escapeHtml(p.provider_name)}</span>
              </a>
            `).join('')}
          </div>
        </div>
      `);
    });

    if (!sections.length) {
      const searchUrl = `https://www.justwatch.com/${countryCode.toLowerCase()}/busca?q=${encodeURIComponent(movieTitle)}`;
      return `
        <div class="watch-section">
          <h3>📺 ONDE ASSISTIR</h3>
          <div class="watch-empty">
            Nenhum provedor encontrado para este país.
            <a href="${searchUrl}" target="_blank" rel="noopener" class="watch-justwatch-link">
              ▶ Buscar no JustWatch ↗
            </a>
          </div>
          <div class="watch-attribution">dados via JustWatch</div>
        </div>
      `;
    }

    return `
      <div class="watch-section">
        <h3>📺 ONDE ASSISTIR ${countryCode ? `<span class="watch-country">[${countryCode}]</span>` : ''}</h3>
        ${sections.join('')}
        ${tmdbLink ? `<a href="${tmdbLink}" target="_blank" rel="noopener" class="watch-more">ver mais detalhes no JustWatch ↗</a>` : ''}
        <div class="watch-attribution">dados de streaming via JustWatch</div>
      </div>
    `;
  }

  // ============ MOVIE DETAIL MODAL ============
  // 🎲 EASTER EGG: chewed/jammed tape
  function showChewedTape(realMovieId) {
    sfx.glitch();
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    overlay.classList.add('show');
    content.innerHTML = `
      <button class="modal-close" onclick="closeModal()">×</button>
      <div class="chewed-tape">
        <div class="chewed-glitch-bars"></div>
        <div class="chewed-content">
          <div class="chewed-icon">📼</div>
          <div class="chewed-title">FITA MASTIGADA!</div>
          <div class="chewed-msg">
            Essa fita foi mastigada pelo videocassete<br>
            do cliente anterior.
          </div>
          <div class="chewed-tracking">═══ TRACKING ERROR ═══</div>
          <button class="chewed-fix-btn" onclick="cleanHeads(${realMovieId})">
            🧽 LIMPAR O CABEÇOTE
          </button>
        </div>
      </div>
    `;
  }

  function cleanHeads(realMovieId) {
    sfx.static(0.3);
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    // Flash effect
    overlay.classList.add('cleaning');
    awardPoints(2, 'limpou o cabeçote');
    setTimeout(() => {
      overlay.classList.remove('cleaning');
      // Now actually open the movie
      openMovieRaw(realMovieId);
    }, 700);
  }

  async function openMovie(movieId) {
    sfx.clunk();
    // 🎲 EASTER EGG: 2% chance of "chewed tape" glitch
    if (Math.random() < 0.02 && !state.chewedRecently) {
      state.chewedRecently = true;
      setTimeout(() => { state.chewedRecently = false; }, 60000); // cooldown
      return showChewedTape(movieId);
    }
    return openMovieRaw(movieId);
  }

  async function openMovieRaw(movieId) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    overlay.classList.add('show');
    content.innerHTML = '<div class="loading" style="padding:60px">Carregando fita...</div>';

    try {
      const [movie, credits, keywords, videos, recommendations, providers] = await Promise.all([
        tmdbFetch(`/movie/${movieId}`),
        tmdbFetch(`/movie/${movieId}/credits`),
        tmdbFetch(`/movie/${movieId}/keywords`),
        fetchTrailers(movieId),
        tmdbFetch(`/movie/${movieId}/recommendations`).catch(() => ({ results: [] })),
        tmdbFetchNoLang(`/movie/${movieId}/watch/providers`).catch(() => ({ results: {} }))
      ]);

      const poster = movie.poster_path
        ? `<img class="modal-poster" src="${IMG_LARGE}${movie.poster_path}" alt="">`
        : `<div class="vhs-no-poster" style="margin:0">SEM CAPA</div>`;
      const year = movie.release_date ? movie.release_date.slice(0, 4) : '????';
      const runtime = movie.runtime ? `${movie.runtime} MIN` : '';
      const rating = movie.vote_average ? `★ ${movie.vote_average.toFixed(1)}` : '';
      const director = (credits.crew || []).find(c => c.job === 'Director');
      const isFav = state.favorites.some(f => f.id === movie.id);
      const cast = (credits.cast || []).slice(0, 10);
      const kws = (keywords.keywords || []).slice(0, 12);
      const trailer = pickBestTrailer(videos);
      state.trailerTitles[movie.id] = movie.title;

      content.innerHTML = `
        <button class="modal-close" onclick="closeModal()">×</button>
        <div class="modal-content">
          <div>
            ${poster}
            <div id="rawg-game-${movie.id}"></div>
            <div class="modal-actions" style="margin-top:10px; flex-direction:column">
              ${trailer ? `
                <button class="trailer-btn" onclick="playTrailer('${trailer.key}', ${movie.id})">
                  ▶ VER TRAILER
                </button>
              ` : `
                <button class="trailer-btn" disabled style="opacity:0.4; cursor:not-allowed" title="Sem trailer disponível">
                  ✕ SEM TRAILER
                </button>
              `}
              <button onclick='toggleFavorite(${JSON.stringify({id:movie.id,title:movie.title,poster_path:movie.poster_path,release_date:movie.release_date}).replace(/'/g,"&apos;")})'>
                ${isFav ? '★ NA ESTANTE' : '☆ ADICIONAR À ESTANTE'}
              </button>
            </div>
          </div>
          <div>
            <div id="omdb-awards-${movie.id}"></div>
            <div class="modal-title-row">
              ${renderAgeSeal(movie)}
              <div class="modal-title-text">
                <div class="modal-title">${escapeHtml(movie.title)}</div>
                ${movie.original_title && movie.original_title !== movie.title ? `<div class="modal-original-title">"${escapeHtml(movie.original_title)}"</div>` : ''}
              </div>
            </div>
            <div class="modal-meta">
              <span>${year}</span>
              ${runtime ? `<span>${runtime}</span>` : ''}
              ${rating ? `<span class="rating">${rating}</span>` : ''}
              <span id="omdb-ratings-${movie.id}" style="display:inline-flex;"></span>
              ${movie.original_language ? `<span>${movie.original_language.toUpperCase()}</span>` : ''}
            </div>
            ${renderVhsSpecs(movie)}
            <div class="modal-genres">
              ${(movie.genres || []).map(g => `<span class="genre-tag" onclick="addGenreFromModal(${g.id})" title="filtrar por este gênero">${escapeHtml(g.name)}</span>`).join('')}
            </div>
            ${kws.length ? `
              <div class="modal-keywords">
                ${kws.map(k => `<span class="kw-tag" onclick="addKeywordFromModal(${k.id}, '${escapeAttr(k.name)}')" title="filtrar por esta temática">#${escapeHtml(k.name)}</span>`).join('')}
              </div>
            ` : ''}
            ${director ? `<div style="color:var(--neon-cyan); margin-bottom:10px;">Direção: <strong style="color:var(--neon-yellow); cursor:pointer" onclick="closeModal(); openPerson(${director.id})">${escapeHtml(director.name)}</strong></div>` : ''}
            <div class="modal-overview">${escapeHtml(movie.overview || 'Sinopse não disponível.')}</div>
            ${renderWatchProviders(providers, movie.title)}
            ${renderSoundtrackSection(movie.id)}
            ${cast.length ? `
              <div class="cast-section">
                <h3>★ ELENCO PRINCIPAL ★</h3>
                <div class="cast-grid">
                  ${cast.map(c => `
                    <div class="cast-member" onclick="closeModal(); openPerson(${c.id})">
                      ${c.profile_path
                        ? `<img src="${IMG_BASE}${c.profile_path}" alt="" loading="lazy">`
                        : `<div style="aspect-ratio:2/3; background:var(--neon-purple); display:flex; align-items:center; justify-content:center; color:white; font-size:24px; margin-bottom:5px">?</div>`}
                      <div class="name">${escapeHtml(c.name)}</div>
                      <div class="character">${escapeHtml(c.character || '')}</div>
                    </div>`).join('')}
                </div>
              </div>` : ''}
            ${(recommendations.results || []).length ? `
              <div class="recs-section">
                <h3>◢ FITAS SEMELHANTES ◣</h3>
                <div class="recs-grid">
                  ${recommendations.results.slice(0, 12).map(r => `
                    <div class="rec-card" onclick="openMovie(${r.id})">
                      ${r.poster_path
                        ? `<img src="${IMG_BASE}${r.poster_path}" alt="" loading="lazy">`
                        : `<div class="rec-no-poster">SEM CAPA</div>`}
                      <div class="rec-title">${escapeHtml(r.title)}</div>
                      <div class="rec-year">${r.release_date ? r.release_date.slice(0,4) : '????'}</div>
                    </div>`).join('')}
                </div>
              </div>` : ''}
            ${renderBarcode(movie)}
          </div>
        </div>`;
      // Fire async integrations
      loadSoundtrack(movie.id, movie.title);
      loadOMDbExtras(movie.id, movie.title, year);
      loadRetroGame(movie.id, movie.title, year);
    } catch (err) {
      content.innerHTML = `<button class="modal-close" onclick="closeModal()">×</button><div class="error-msg">⚠ ${escapeHtml(err.message)}</div>`;
    }
  }

  function addKeywordFromModal(id, name) {
    addKeyword(id, name);
    closeModal();
    switchView('filters');
  }

  function addGenreFromModal(id) {
    if (!state.filters.genres.includes(id)) state.filters.genres.push(id);
    closeModal();
    switchView('filters');
  }

  function closeModal() {
    stopAnyPreview();
    document.getElementById('modal-overlay').classList.remove('show');
  }

  // ============ UTILS ============
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "\\'"); }

  init();

