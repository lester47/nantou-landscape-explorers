// js/landscape.js - 景觀版專屬功能：素材路徑、分類圖例、時光機、終極任務、我的家鄉景觀、教師準心
(function () {
  // 圖片路徑：單檔獨立版會把圖片內嵌在 window.ASSET_DATA，其餘情況直接用相對路徑
  window.LAsset = function (path) {
    if (!path) return '';
    if (window.ASSET_DATA && window.ASSET_DATA[path]) return window.ASSET_DATA[path];
    return path;
  };

  let data = null;
  let sceneEra = null;
  let tmEra = null;
  let tmIndex = 0;
  let finalStep = 1;
  let finalChoices = {};
  let crosshairTimer = null;

  const $ = (id) => document.getElementById(id);

  window.Landscape = {
    init(erasData) {
      data = erasData;
      const assets = (data && data.assets) || {};

      // 1. 靜態圖片（首頁地圖、吉祥物）
      document.querySelectorAll('img[data-asset]').forEach((img) => {
        const key = img.getAttribute('data-asset');
        const src = assets[key];
        if (src) img.src = window.LAsset(src);
        else if (key === 'heroMap') img.classList.add('hidden');
      });

      // 2. 分類圖例
      ['home-legend', 'timeline-legend'].forEach((id) => {
        const el = $(id);
        if (el) el.innerHTML = this.legendHtml();
      });

      // 3. 比較表標題（舊表格樣式需要外層捲軸）
      this.bindTimemachine();
      this.bindFinalTask();
      this.bindMyLandscape();
    },

    legendHtml() {
      const cats = (data && data.categories) || {};
      return Object.keys(cats).map((k) => {
        const c = cats[k];
        return `<span class="legend-chip" style="--chip:${c.color}">${c.emoji} ${c.label}</span>`;
      }).join('');
    },

    categoryPill(era) {
      const cats = (data && data.categories) || {};
      const c = cats[era.category];
      if (!c) return '';
      let html = `<div class="era-cat-pill" style="background:${c.color}">${c.emoji} ${c.label}</div>`;
      if (era.change && era.category !== 'change' && cats.change) {
        html += `<div class="era-cat-pill era-cat-pill-2" style="background:${cats.change.color}">${cats.change.emoji} 有變遷故事</div>`;
      }
      return html;
    },

    // ---------- 360 場景 ----------
    onSceneOpen(era) {
      sceneEra = era;
      const tmBtn = $('timemachine-btn');
      if (tmBtn) tmBtn.classList.toggle('hidden', !era.timemachine);
      const ribbon = $('placeholder-ribbon');
      if (ribbon) ribbon.classList.toggle('hidden', !era.placeholder);
      this.startCrosshair();
    },

    onQuizRender(era) {
      const btn = $('quiz-timemachine-btn');
      if (!btn) return;
      btn.classList.toggle('hidden', !(era && era.timemachine));
      btn.onclick = () => {
        window.AudioManager.playClick();
        this.openTimemachine(era);
      };
    },

    // ---------- 時光機 ----------
    bindTimemachine() {
      const open = $('timemachine-btn');
      if (open) {
        open.onclick = () => {
          window.AudioManager.playClick();
          if (sceneEra) this.openTimemachine(sceneEra);
        };
      }
      const close = $('tm-close');
      if (close) {
        close.onclick = () => {
          window.AudioManager.playClick();
          window.AudioManager.stopSpeaking();
          $('timemachine-modal').classList.add('hidden');
        };
      }
      const prev = $('tm-prev');
      const next = $('tm-next');
      if (prev) prev.onclick = () => this.showFrame(tmIndex - 1);
      if (next) next.onclick = () => this.showFrame(tmIndex + 1);
      const speak = $('tm-speak');
      if (speak) {
        speak.onclick = () => {
          const fr = tmEra && tmEra.timemachine.frames[tmIndex];
          if (fr) window.AudioManager.speak(`${fr.label}。${fr.caption}`);
        };
      }
    },

    openTimemachine(era) {
      if (!era || !era.timemachine) return;
      tmEra = era;
      $('tm-title').textContent = era.timemachine.title || '⏳ 時光機';
      const steps = $('tm-steps');
      steps.innerHTML = '';
      era.timemachine.frames.forEach((fr, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tm-step';
        b.innerHTML = `<span class="tm-step-no">${i + 1}</span>${fr.label}`;
        b.onclick = () => this.showFrame(i);
        steps.appendChild(b);
        if (i < era.timemachine.frames.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'tm-arrow';
          arrow.textContent = '➜';
          steps.appendChild(arrow);
        }
      });
      $('timemachine-modal').classList.remove('hidden');
      this.showFrame(0);
    },

    showFrame(i) {
      if (!tmEra) return;
      const frames = tmEra.timemachine.frames;
      tmIndex = Math.max(0, Math.min(frames.length - 1, i));
      const fr = frames[tmIndex];
      const img = $('tm-img');
      img.src = window.LAsset(fr.img);
      img.alt = fr.label;
      $('tm-caption').textContent = fr.caption;
      $('tm-ph').classList.toggle('hidden', !fr.placeholder);
      document.querySelectorAll('#tm-steps .tm-step').forEach((b, k) => b.classList.toggle('active', k === tmIndex));
      $('tm-prev').disabled = tmIndex === 0;
      $('tm-next').disabled = tmIndex === frames.length - 1;
      window.AudioManager.playTone(440 + tmIndex * 120, 'sine', 0.12);
    },

    // ---------- 終極任務 ----------
    bindFinalTask() {
      const back = $('final-back-btn');
      if (back) {
        back.onclick = () => {
          window.AudioManager.playClick();
          window.App.showScreen('timeline-screen');
          window.App.refreshTimeline();
        };
      }
      const check = $('final-check-btn');
      if (check) check.onclick = () => this.checkFinal();
    },

    startFinalTask() {
      if (!data || !data.finalTask) return;
      finalStep = 1;
      $('final-title').textContent = data.finalTask.title;
      window.App.showScreen('final-task-screen');
      this.renderFinalStep();
    },

    renderFinalStep() {
      const ft = data.finalTask;
      const step = finalStep === 1 ? ft.step1 : ft.step2;
      const options = finalStep === 1
        ? [['nature', '🌿 自然景觀'], ['culture', '🏛️ 人文景觀']]
        : [['disaster', '🌋 天然災害'], ['human', '🏗️ 人為建設與發展']];
      finalChoices = {};
      $('final-step-pill').textContent = `第 ${finalStep} / 2 關`;
      $('final-prompt').textContent = step.prompt;
      $('final-feedback').classList.add('hidden');
      $('final-next-btn').classList.add('hidden');
      $('final-check-btn').classList.remove('hidden');

      const wrap = $('final-cards');
      wrap.innerHTML = '';
      wrap.classList.toggle('final-cards-4', finalStep === 2);
      Object.keys(step.answers).forEach((sid) => {
        const era = data.eras.find((e) => e.id === sid);
        if (!era) return;
        const card = document.createElement('div');
        card.className = 'final-card';
        card.dataset.sid = sid;
        card.innerHTML = `
          <img src="${window.LAsset(era.thumb)}" alt="${era.name}">
          <div class="final-card-body">
            <div class="final-card-name">${era.badgeEmoji} ${era.name}</div>
            <div class="final-card-sub">${era.subtitle}</div>
            <div class="final-choice-row"></div>
          </div>`;
        const row = card.querySelector('.final-choice-row');
        options.forEach(([val, label]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'final-choice';
          b.dataset.val = val;
          b.textContent = label;
          b.onclick = () => {
            window.AudioManager.playClick();
            finalChoices[sid] = val;
            card.classList.remove('wrong', 'right');
            row.querySelectorAll('.final-choice').forEach((x) => x.classList.toggle('selected', x === b));
          };
          row.appendChild(b);
        });
        wrap.appendChild(card);
      });
    },

    checkFinal() {
      const ft = data.finalTask;
      const step = finalStep === 1 ? ft.step1 : ft.step2;
      const ids = Object.keys(step.answers);
      const fb = $('final-feedback');
      const fbText = $('final-feedback-text');
      const missing = ids.filter((id) => !finalChoices[id]);
      if (missing.length) {
        window.AudioManager.playWrong();
        fb.className = 'quiz-feedback-box hint-box';
        fbText.innerHTML = `<div class="feedback-badge-tag hint">✋ 還沒選完</div><p>還有 ${missing.length} 張卡片沒有選答案喔！</p>`;
        return;
      }
      let wrong = 0;
      document.querySelectorAll('#final-cards .final-card').forEach((card) => {
        const ok = finalChoices[card.dataset.sid] === step.answers[card.dataset.sid];
        card.classList.toggle('right', ok);
        card.classList.toggle('wrong', !ok);
        if (!ok) wrong++;
      });
      if (wrong) {
        window.AudioManager.playWrong();
        fb.className = 'quiz-feedback-box hint-box';
        fbText.innerHTML = `<div class="feedback-badge-tag hint">💡 提示一下</div><p>有 ${wrong} 張卡片（紅色框）答錯了。${step.hint}</p>`;
        return;
      }
      window.AudioManager.playCorrect();
      $('final-check-btn').classList.add('hidden');
      const next = $('final-next-btn');
      next.classList.remove('hidden');
      fb.className = 'quiz-feedback-box success-box';
      if (finalStep === 1) {
        fbText.innerHTML = '<div class="feedback-badge-tag">🎉 第 1 關過關！</div><p>你分得很正確！接下來看看哪些景觀「變了樣」，又是為什麼改變的。</p>';
        next.textContent = '前往第 2 關 ➔';
        next.onclick = () => {
          window.AudioManager.playClick();
          finalStep = 2;
          this.renderFinalStep();
          window.scrollTo(0, 0);
        };
      } else {
        fbText.innerHTML = `<div class="feedback-badge-tag">🏆 終極任務完成！</div><p>${ft.explain}</p>`;
        next.textContent = '🏆 領取家鄉景觀小導覽員證書';
        next.onclick = () => {
          window.GameStorage.setFinalBossCompleted();
          window.AudioManager.playWin();
          window.App.showScreen('certificate-screen');
          this.prepareCertificate();
          window.CertificateManager.render();
        };
      }
    },

    // ---------- 我的家鄉景觀 ----------
    bindMyLandscape() {
      const input = $('my-landscape-input');
      const apply = $('my-landscape-apply');
      if (!input || !apply) return;
      const save = () => {
        window.GameStorage.setMyLandscape(input.value);
        window.AudioManager.playClick();
        window.CertificateManager.render();
      };
      apply.onclick = save;
      input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
      // 從其他路徑進入證書頁時也帶入已存的內容
      const certBtns = ['view-final-cert-btn', 'victory-next-btn'];
      certBtns.forEach((id) => {
        const b = $(id);
        if (b) b.addEventListener('click', () => this.prepareCertificate());
      });
    },

    prepareCertificate() {
      const input = $('my-landscape-input');
      if (input) input.value = window.GameStorage.get().myLandscape || '';
    },

    // ---------- 教師校準準心（網址加 ?teacher） ----------
    startCrosshair() {
      const box = $('teacher-crosshair');
      if (!box || !window.isTeacherMode) return;
      box.classList.remove('hidden');
      const label = box.querySelector('span');
      if (crosshairTimer) clearInterval(crosshairTimer);
      crosshairTimer = setInterval(() => {
        const v = window.ViewerManager.getViewer && window.ViewerManager.getViewer();
        if (!v || document.getElementById('viewer-screen').classList.contains('hidden')) return;
        try {
          let yaw = v.getYaw();
          while (yaw < -180) yaw += 360;
          while (yaw > 180) yaw -= 360;
          const x = ((yaw + 180) / 3.6).toFixed(1);
          const y = ((90 - v.getPitch()) / 1.8).toFixed(1);
          label.textContent = `x ${x}%　y ${y}%`;
        } catch (e) { /* viewer 尚未就緒 */ }
      }, 200);
    }
  };
})();
