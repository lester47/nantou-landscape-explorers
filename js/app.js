// js/app.js - 主要流程控制與畫面切換
(function () {
  let erasData = null;
  let activeEraId = null;

  window.App = {
    async init() {
      // 1. 檢查是否有教師模式
      const urlParams = new URLSearchParams(window.location.search);
      window.isTeacherMode = urlParams.has('teacher') || urlParams.get('mode') === 'teacher';

      // 2. 載入資料 (優先讀取 window.ERAS_DATA 避免 file:/// CORS 限制，若無則 fetch eras.json)
      if (window.ERAS_DATA) {
        erasData = window.ERAS_DATA;
      } else {
        try {
          const resp = await fetch('data/eras.json');
          erasData = await resp.json();
          window.ERAS_DATA = erasData;
        } catch (e) {
          console.error('Failed to load eras.json', e);
        }
      }

      // 3. 初始化音效按鈕狀態
      this.updateSoundButtonUI();

      // 4. 動態套用教師設定之所有標題與文案
      this.applyAppTexts();

      // 4b. 景觀版：圖片素材、圖例、時光機、終極任務、教師準心
      if (window.Landscape) window.Landscape.init(erasData);

      // 5. 綁定按鈕事件
      this.bindEvents();

      // 6. 根據進度顯示首頁
      this.showScreen('home-screen');
      this.refreshHomeScreen();
    },

    applyAppTexts() {
      if (!erasData) return;
      if (erasData.appTitle) {
        document.title = `${erasData.appTitle}：${erasData.appSubtitle || '360° 闖關任務'}｜數位 360° 教材`;
        const brandTitle = document.querySelector('.brand-title');
        if (brandTitle) brandTitle.textContent = erasData.appTitle;
      }
      if (erasData.brandTag) {
        const brandTag = document.querySelector('.brand-tag');
        if (brandTag) brandTag.textContent = erasData.brandTag;
      }
      if (erasData.homeBadge) {
        const homeBadge = document.querySelector('.home-badge-tag');
        if (homeBadge) homeBadge.textContent = erasData.homeBadge;
      }
      if (erasData.appTitle || erasData.appSubtitle) {
        const homeTitle = document.querySelector('.home-title');
        if (homeTitle) {
          homeTitle.innerHTML = `${erasData.appTitle || '360° 探險'}<br>${erasData.appSubtitle || '闖關任務'}`;
        }
      }
      if (erasData.homeDesc) {
        const homeDesc = document.querySelector('.home-desc');
        if (homeDesc) homeDesc.textContent = erasData.homeDesc;
      }
      if (erasData.startButtonText) {
        const startBtn = document.getElementById('start-adventure-btn');
        if (startBtn) startBtn.textContent = erasData.startButtonText;
      }
      if (erasData.timelineTitle) {
        const timelineH2 = document.querySelector('.timeline-header h2');
        if (timelineH2) timelineH2.textContent = erasData.timelineTitle;
      }
      if (erasData.certBannerTitle) {
        const bannerH3 = document.querySelector('.cert-banner-text h3');
        if (bannerH3) bannerH3.textContent = erasData.certBannerTitle;
      }
      if (erasData.certBannerDesc) {
        const bannerP = document.querySelector('.cert-banner-text p');
        if (bannerP) bannerP.textContent = erasData.certBannerDesc;
      }
      this.renderComparisonTable();
    },

    ensureMascotImages() {
      if (window.CERT_ASSETS && window.CERT_ASSETS.mascot) {
        document.querySelectorAll('.hero-mascot-img, .captain-avatar-img').forEach(img => {
          const src = img.getAttribute('src') || '';
          if (!src || src === 'img/mascot.png' || src.endsWith('/img/mascot.png')) {
            img.src = window.CERT_ASSETS.mascot;
          }
          img.addEventListener('error', () => {
            img.src = window.CERT_ASSETS.mascot;
          });
        });
      }
    },

    renderComparisonTable() {
      const container = document.getElementById('comparison-modal');
      if (!container || !erasData || !erasData.comparisonTable) return;
      const tableData = erasData.comparisonTable;
      const card = container.querySelector('.comparison-card');
      if (!card) return;

      const h2 = card.querySelector('h2');
      if (h2 && tableData.title) h2.textContent = tableData.title;

      // 若有 Markdown 內容且載入了 MarkdownLite 解析器，優先進行完整 Markdown 渲染
      if (tableData.markdown && window.MarkdownLite) {
        let contentWrap = card.querySelector('.comparison-dynamic-content');
        if (!contentWrap) {
          const oldTable = card.querySelector('.comparison-table');
          contentWrap = document.createElement('div');
          contentWrap.className = 'comparison-dynamic-content';
          if (oldTable) {
            oldTable.parentNode.replaceChild(contentWrap, oldTable);
          } else {
            const closeBtnWrap = card.querySelector('div[style*="text-align: center"]');
            if (closeBtnWrap) card.insertBefore(contentWrap, closeBtnWrap);
            else card.appendChild(contentWrap);
          }
        }
        contentWrap.innerHTML = window.MarkdownLite.parse(tableData.markdown);
        return;
      }

      // 回退相容：以原始 tableData.headers 與 rows 渲染
      const table = card.querySelector('.comparison-table') || card.querySelector('table');
      if (table && tableData.headers && tableData.rows) {
        let theadHtml = '<thead><tr>';
        tableData.headers.forEach(h => { theadHtml += `<th>${h}</th>`; });
        theadHtml += '</tr></thead>';

        let tbodyHtml = '<tbody>';
        tableData.rows.forEach(row => {
          tbodyHtml += '<tr>';
          if (row.length === 2 && row[1].startsWith('💡')) {
            tbodyHtml += `<td><strong>${row[0]}</strong></td><td colspan="${tableData.headers.length - 1}" style="text-align: center; color: var(--color-primary); font-weight: bold; background: #fff8e1;">${row[1]}</td>`;
          } else {
            row.forEach((cell, idx) => {
              if (idx === 0) tbodyHtml += `<td><strong>${cell}</strong></td>`;
              else tbodyHtml += `<td>${cell}</td>`;
            });
          }
          tbodyHtml += '</tr>';
        });
        tbodyHtml += '</tbody>';
        table.innerHTML = theadHtml + tbodyHtml;
      }
    },

    bindEvents() {
      // 首頁：啟動時光機
      const startBtn = document.getElementById('start-adventure-btn');
      const nameInput = document.getElementById('player-name-input');
      const resetBtn = document.getElementById('reset-progress-btn');

      if (startBtn && nameInput) {
        startBtn.onclick = () => {
          const name = nameInput.value.trim();
          if (!name) {
            alert('請先輸入你的名字喔！');
            nameInput.focus();
            return;
          }
          window.AudioManager.playClick();
          window.GameStorage.setPlayerName(name);
          this.showScreen('timeline-screen');
          this.refreshTimeline();
        };

        nameInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            startBtn.click();
          }
        };
      }

      // 首頁：重設進度
      if (resetBtn) {
        resetBtn.onclick = () => {
          if (confirm('確定要清除所有闖關紀錄，重新開始嗎？')) {
            window.GameStorage.resetAll();
            window.AudioManager.playClick();
            if (nameInput) nameInput.value = '';
            this.refreshHomeScreen();
            alert('進度已重設！可以重新出發囉。');
          }
        };
      }

      // 音效切換按鈕（全域綁定）
      document.querySelectorAll('.sound-toggle-btn').forEach(btn => {
        btn.onclick = () => {
          const enabled = window.GameStorage.toggleSound();
          window.AudioManager.playClick();
          this.updateSoundButtonUI();
        };
      });

      // 360 場景：返回選單
      const backToTimelineBtn = document.getElementById('back-to-timeline-btn');
      if (backToTimelineBtn) {
        backToTimelineBtn.onclick = () => {
          window.AudioManager.playClick();
          window.ViewerManager.destroy();
          this.showScreen('timeline-screen');
          this.refreshTimeline();
        };
      }

      // 360 場景：找不到線索輔助指引
      const guideClueBtn = document.getElementById('guide-clue-btn');
      if (guideClueBtn) {
        guideClueBtn.onclick = () => {
          window.ViewerManager.guideToNextUnread();
        };
      }

      // 360 場景：開始生存挑戰按鈕
      const startChallengeBtn = document.getElementById('start-challenge-btn');
      if (startChallengeBtn) {
        startChallengeBtn.onclick = () => {
          window.AudioManager.playClick();
          this.launchQuizForCurrentEra();
        };
      }

      // 問答畫面：回場景看看線索
      const quizBackToSceneBtn = document.getElementById('quiz-back-to-scene-btn');
      if (quizBackToSceneBtn) {
        quizBackToSceneBtn.onclick = () => {
          window.AudioManager.playClick();
          this.openEraScene(activeEraId);
        };
      }

      // 勝利彈窗：繼續前進
      const victoryNextBtn = document.getElementById('victory-next-btn');
      if (victoryNextBtn) {
        victoryNextBtn.onclick = () => {
          window.AudioManager.playClick();
          document.getElementById('victory-modal').classList.add('hidden');
          
          const state = window.GameStorage.get();
          const totalEras = erasData && erasData.eras ? erasData.eras.length : 3;
          // 如果所有關卡都完成了
          if (state.completedEras.length >= totalEras) {
            // 前往大魔王題或證書
            if (!state.finalBossCompleted && (erasData.finalTask || erasData.finalBoss)) {
              this.launchFinalBoss();
            } else {
              this.showScreen('certificate-screen');
              window.CertificateManager.render();
            }
          } else {
            this.showScreen('timeline-screen');
            this.refreshTimeline();
          }
        };
      }

      // 證書畫面按鈕
      const downloadCertBtn = document.getElementById('download-cert-btn');
      if (downloadCertBtn) {
        downloadCertBtn.onclick = () => {
          window.AudioManager.playClick();
          window.CertificateManager.download();
        };
      }

      const printCertBtn = document.getElementById('print-cert-btn');
      if (printCertBtn) {
        printCertBtn.onclick = () => {
          window.AudioManager.playClick();
          window.CertificateManager.print();
        };
      }

      const certBackHomeBtn = document.getElementById('cert-back-home-btn');
      if (certBackHomeBtn) {
        certBackHomeBtn.onclick = () => {
          window.AudioManager.playClick();
          this.showScreen('timeline-screen');
          this.refreshTimeline();
        };
      }

      // 時代生活比較表彈窗開關
      const openComparisonBtns = document.querySelectorAll('.open-comparison-btn');
      openComparisonBtns.forEach(btn => {
        btn.onclick = () => {
          window.AudioManager.playClick();
          document.getElementById('comparison-modal').classList.remove('hidden');
        };
      });

      const closeComparisonBtn = document.getElementById('close-comparison-btn');
      if (closeComparisonBtn) {
        closeComparisonBtn.onclick = () => {
          window.AudioManager.playClick();
          document.getElementById('comparison-modal').classList.add('hidden');
        };
      }
    },

    showScreen(screenId) {
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
      });
      const target = document.getElementById(screenId);
      if (target) {
        target.classList.remove('hidden');
      }
      window.scrollTo(0, 0);
    },

    refreshHomeScreen() {
      const state = window.GameStorage.get();
      const nameInput = document.getElementById('player-name-input');
      if (nameInput && state.playerName) {
        nameInput.value = state.playerName;
      }

      const statusTag = document.getElementById('home-progress-tag');
      const totalEras = erasData && erasData.eras ? erasData.eras.length : 3;
      if (statusTag) {
        if (state.completedEras.length >= totalEras) {
          statusTag.innerHTML = state.finalBossCompleted
            ? `🏆 恭喜已獲得「${erasData.certTitle || '家鄉景觀小導覽員'}」稱號！`
            : `🌟 8 個景點都過關了！還差最後的終極任務喔！`;
          statusTag.classList.remove('hidden');
        } else if (state.completedEras.length > 0) {
          statusTag.innerHTML = `⭐ 目前進度：已通過 ${state.completedEras.length} / ${totalEras} 個景點`;
          statusTag.classList.remove('hidden');
        } else {
          statusTag.classList.add('hidden');
        }
      }
    },

    refreshTimeline() {
      const state = window.GameStorage.get();
      const playerNameSpan = document.getElementById('timeline-player-name');
      if (playerNameSpan) {
        playerNameSpan.textContent = state.playerName || '探險隊員';
      }

      const timelineContainer = document.getElementById('era-cards-container');
      if (!timelineContainer || !erasData || !erasData.eras) return;

      // 動態更新頂部時間軸節點標籤
      const timelineBar = document.querySelector('.timeline-bar');
      if (timelineBar) {
        timelineBar.innerHTML = '';
        const total = erasData.eras.length;
        erasData.eras.forEach((era, idx) => {
          const pct = Math.round(((idx + 0.4) / (total + 0.5)) * 90);
          const node = document.createElement('div');
          node.className = 'timeline-node';
          node.style.left = `${pct}%`;
          const cat = (erasData.categories || {})[era.category] || {};
          const done = window.GameStorage.isEraCompleted(era.id);
          node.innerHTML = `
            <div class="node-dot" style="border-color:${cat.color || ''};${done ? `background:${cat.color};` : ''}"></div>
            <span class="node-label">${idx + 1}. ${era.name.split('・')[1] || era.name}</span>
          `;
          timelineBar.appendChild(node);
        });
        const endNode = document.createElement('div');
        endNode.className = 'timeline-node';
        endNode.style.left = '98%';
        endNode.innerHTML = `
          <div class="node-dot" style="border-color: #1976d2;"></div>
          <span class="node-label">🏆 證書</span>
        `;
        timelineBar.appendChild(endNode);
      }

      timelineContainer.innerHTML = '';

      erasData.eras.forEach((era, idx) => {
        const isUnlocked = window.GameStorage.isEraUnlocked(era.id);
        const isCompleted = window.GameStorage.isEraCompleted(era.id);

        const card = document.createElement('div');
        card.className = `era-card ${isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked'}`;

        let statusBadgeHtml = '';
        if (isCompleted) {
          statusBadgeHtml = `<div class="era-status-badge completed"><span style="font-size:20px;">${era.badgeEmoji || '🏅'}</span> 已過關・榮獲「${era.badgeTitle || '景觀小達人'}」</div>`;
        } else if (isUnlocked) {
          statusBadgeHtml = `<div class="era-status-badge unlocked">🔓 目前關卡・點擊啟動探索</div>`;
        } else {
          statusBadgeHtml = `<div class="era-status-badge locked">🔒 尚未解鎖（請先通過前一關）</div>`;
        }

        // 讀取的線索統計
        const readCount = (state.readClues[era.id] || []).length;
        const totalClues = era.hotspots.filter(h => !h.id.includes('egg')).length;

        card.innerHTML = `
          <div class="era-card-thumb">
            <img src="${window.LAsset(era.thumb || era.panorama)}" alt="${era.name}">
            <div class="era-years-pill" style="background:${((erasData.categories || {})[era.category] || {}).color || ''}">${era.years}</div>
            ${era.placeholder ? '<div class="era-ph-pill">示意圖</div>' : ''}
          </div>
          <div class="era-card-body">
            <div class="era-card-title-row">
              <h3>${era.name}</h3>
              <span class="era-culture">${era.subtitle || ''}</span>
            </div>
            <p class="era-site">📍 第 ${idx + 1} 站｜${era.site}</p>
            <p class="era-intro-short">${(era.intro || '').slice(0, 52)}...</p>
            <div class="era-clue-stat">
              <span>🔍 線索進度：${readCount} / ${totalClues}</span>
            </div>
            ${statusBadgeHtml}
          </div>
        `;

        if (isUnlocked) {
          card.onclick = () => {
            window.AudioManager.playClick();
            this.openEraScene(era.id);
          };
        } else {
          card.onclick = () => {
            window.AudioManager.playWrong();
            alert('這一站還沒開放喔！請先完成上一站的闖關任務吧。');
          };
        }

        timelineContainer.appendChild(card);
      });

      // 檢查是否可查看大魔王題與證書
      const certBanner = document.getElementById('timeline-cert-banner');
      if (certBanner) {
        const totalEras = erasData.eras.length;
        if (state.completedEras.length >= totalEras) {
          certBanner.classList.remove('hidden');
          const certBtn = document.getElementById('view-final-cert-btn');
          if (certBtn) {
            certBtn.onclick = () => {
              window.AudioManager.playClick();
              if (!state.finalBossCompleted && (erasData.finalTask || erasData.finalBoss)) {
                this.launchFinalBoss();
              } else {
                this.showScreen('certificate-screen');
                window.CertificateManager.render();
              }
            };
          }
        } else {
          certBanner.classList.add('hidden');
        }
      }
    },

    openEraScene(eraId) {
      if (!erasData) return;
      const era = erasData.eras.find(e => e.id === eraId);
      if (!era) return;

      activeEraId = eraId;
      this.showScreen('viewer-screen');

      // 更新頂部資訊
      const titleEl = document.getElementById('scene-era-title');
      const infoEl = document.getElementById('scene-era-info');
      if (titleEl) titleEl.textContent = era.name;
      if (infoEl) {
        const shortSite = era.site.replace(/（.*）/, '');
        infoEl.textContent = `${era.subtitle ? era.subtitle + ' ｜ ' : ''}${shortSite}（${era.years}）`;
      }

      // 小隊長初始引導
      this.updateCaptainSpeech(era.captainHint || era.intro);

      // 初始化 Pannellum 360 Viewer
      window.ViewerManager.init(era, (clue, state) => {
        // 點開線索回饋
        const count = (state.readClues[era.id] || []).length;
        const total = era.hotspots.filter(h => !h.id.includes('egg')).length;
        if (count < total) {
          this.updateCaptainSpeech(`找到新線索「${clue.title}」！還有 ${total - count} 個線索藏在附近，往旁邊或後面找找看！`);
        } else {
          this.updateCaptainSpeech(`太厲害了！你把「${era.name}」的線索全都找齊了！請點擊右下角開始「闖關任務」！`);
        }
      }, () => {
        // 全部線索找齊事件
        window.AudioManager.playTone(880, 'sine', 0.3);
      });
      if (window.Landscape) window.Landscape.onSceneOpen(era);
    },

    updateCaptainSpeech(text) {
      const bubble = document.getElementById('captain-speech-text');
      if (bubble) {
        bubble.textContent = text;
      }
    },

    launchQuizForCurrentEra() {
      if (!erasData || !activeEraId) return;
      const era = erasData.eras.find(e => e.id === activeEraId);
      if (!era) return;

      window.ViewerManager.destroy();
      this.showScreen('quiz-screen');
      window.QuizManager.startEraQuiz(era);
    },

    launchFinalBoss() {
      if (erasData && erasData.finalTask && window.Landscape) {
        window.Landscape.startFinalTask();
        return;
      }
      if (!erasData || !erasData.finalBoss) return;
      this.showScreen('quiz-screen');
      window.QuizManager.startFinalBoss(erasData.finalBoss);
    },

    showEraVictoryModal(era) {
      const modal = document.getElementById('victory-modal');
      const badgeImg = document.getElementById('victory-badge-img');
      const badgeTitle = document.getElementById('victory-badge-title');
      const speech = document.getElementById('victory-speech-text');

      if (!modal) return;

      if (badgeImg) {
        if (window.CERT_ASSETS && window.CERT_ASSETS[era.id]) {
          badgeImg.src = window.CERT_ASSETS[era.id];
        } else if (era.badge) {
          badgeImg.src = window.LAsset(era.badge);
        }
      }
      if (badgeTitle) badgeTitle.textContent = `${era.badgeEmoji} 榮獲「${era.badgeTitle}」徽章！`;
      if (speech) speech.textContent = `恭喜你！成功通過了「${era.name}」的闖關任務，認識了這裡的${era.subtitle || '景觀特色'}！`;
      const nextBtn = document.getElementById('victory-next-btn');
      const st = window.GameStorage.get();
      if (nextBtn) nextBtn.textContent = st.completedEras.length >= erasData.eras.length ? '🌟 挑戰終極任務 ➔' : '前往下一個景點 ➔';

      modal.classList.remove('hidden');
    },

    updateSoundButtonUI() {
      const isSound = window.GameStorage.get().soundEnabled;
      document.querySelectorAll('.sound-toggle-btn').forEach(btn => {
        btn.innerHTML = isSound ? '🔊 音效開' : '🔇 靜音中';
        btn.classList.toggle('muted', !isSound);
      });
    }
  };

  // DOM 載入後啟動
  window.addEventListener('DOMContentLoaded', () => {
    window.App.init();
  });
})();
