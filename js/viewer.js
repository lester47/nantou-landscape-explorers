// js/viewer.js - Pannellum 360° 全景檢視與熱點互動模組
(function () {
  let viewerInstance = null;
  let currentEra = null;

  window.ViewerManager = {
    init(eraData, onClueReadCallback, onAllCluesFoundCallback) {
      currentEra = eraData;
      const container = document.getElementById('panorama');
      if (!container) return;

      // 銷毀舊的 viewer 實例
      if (viewerInstance) {
        try {
          viewerInstance.destroy();
        } catch (e) {
          // ignore
        }
        viewerInstance = null;
      }
      container.innerHTML = '';

      const state = window.GameStorage.get();
      const readClues = state.readClues[eraData.id] || [];

      // 建立熱點設定
      const hotSpots = eraData.hotspots.map(h => {
        const isRead = readClues.includes(h.id);
        return {
          id: h.id,
          pitch: h.pitch,
          yaw: h.yaw,
          cssClass: `clue-hotspot ${isRead ? 'read' : 'unread'}`,
          createTooltipFunc: (div) => {
            div.className = `golden-marker ${isRead ? 'read' : 'unread'}`;
            div.setAttribute('data-id', h.id);
            div.innerHTML = `
              <div class="marker-pulse-ring"></div>
              <div class="marker-icon-box">
                <span class="marker-icon">${h.icon}</span>
              </div>
              <div class="marker-label-tag">
                <span class="marker-star">${isRead ? '✅' : '✨'}</span>
                <span class="marker-text">${h.title}</span>
              </div>
            `;
            div.onclick = (e) => {
              e.stopPropagation();
              window.AudioManager.playClick();
              this.openClueModal(h, onClueReadCallback, onAllCluesFoundCallback);
            };
          },
          clickHandlerFunc: () => {
            window.AudioManager.playClick();
            this.openClueModal(h, onClueReadCallback, onAllCluesFoundCallback);
          }
        };
      });

      const isDebug = new URLSearchParams(window.location.search).has('debug');

      // 自動抓取 img/pano/ 最新圖片：
      // 在 http 伺服器環境下直接載入實體圖片並附帶防快取戳記；在 file:/// 或包含 Base64 下則使用同步的 Base64 避開 CORS
      let panoSrc = eraData.panorama;
      if (eraData.dataUri && typeof eraData.dataUri === 'string' && eraData.dataUri.startsWith('data:image/')) {
        panoSrc = eraData.dataUri;
      } else if (eraData.panorama && typeof eraData.panorama === 'string' && eraData.panorama.startsWith('data:image/')) {
        panoSrc = eraData.panorama;
      } else if (window.PANO_DATA && window.PANO_DATA[eraData.id] && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        panoSrc = window.PANO_DATA[eraData.id];
      } else if (location.protocol.startsWith('http')) {
        panoSrc = (eraData.panorama && !eraData.panorama.startsWith('data:')) ? `${eraData.panorama}?t=${Date.now()}` : eraData.panorama;
      } else if (window.PANO_DATA && window.PANO_DATA[eraData.id]) {
        panoSrc = window.PANO_DATA[eraData.id];
      }

      try {
        viewerInstance = pannellum.viewer('panorama', {
          type: 'equirectangular',
          panorama: panoSrc,
          autoLoad: true,
          autoRotate: -0.5, // 緩慢旋轉吸引注意力，操作時自動停止
          showZoomCtrl: true,
          showFullscreenCtrl: true,
          compass: true,
          hotSpotDebug: isDebug,
          hfov: 95,
          minHfov: 50,
          maxHfov: 120,
          pitch: -5,
          yaw: 0,
          hotSpots: hotSpots
        });

        // 監聽鍵盤方向鍵
        container.setAttribute('tabindex', '0');

        // 畫面尺寸自適應回調
        setTimeout(() => {
          if (viewerInstance) {
            try {
              viewerInstance.resize();
            } catch (e) {
              // ignore
            }
          }
        }, 100);
      } catch (err) {
        console.error('Failed to init pannellum viewer', err);
        container.innerHTML = `
          <div class="pano-fallback">
            <img src="${eraData.panorama}" alt="${eraData.name}" style="width:100%; height:100%; object-fit:cover;">
            <p class="fallback-note">全景檢視器載入中...</p>
          </div>
        `;
      }

      // 綁定線索雷達下拉選單按鈕
      const toggleBtn = document.getElementById('clue-radar-toggle-btn');
      if (toggleBtn) {
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          window.AudioManager.playClick();
          this.toggleRadarMenu();
        };
      }

      // 點擊選單外部自動收合（僅全域註冊一次）
      if (!this._hasBoundRadarDismiss) {
        document.addEventListener('click', (e) => {
          const dropdown = document.getElementById('clue-radar-dropdown');
          if (dropdown && !dropdown.contains(e.target)) {
            this.closeRadarMenu();
          }
        });
        this._hasBoundRadarDismiss = true;
      }

      this.closeRadarMenu();
      this.updateProgressCounter();
      this.updateRadarBar(onClueReadCallback, onAllCluesFoundCallback);
    },

    updateRadarBar(onClueReadCallback, onAllCluesFoundCallback) {
      const radarContainer = document.getElementById('clue-radar-items');
      if (!radarContainer || !currentEra) return;

      radarContainer.innerHTML = '';
      const state = window.GameStorage.get();
      const readClues = state.readClues[currentEra.id] || [];

      currentEra.hotspots.forEach(h => {
        const isRead = readClues.includes(h.id);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `menu-clue-item ${isRead ? 'read' : 'unread'}`;
        item.innerHTML = `
          <div class="clue-item-left">
            <span class="clue-status-icon">${isRead ? '✅' : '✨'}</span>
            <span class="clue-item-icon">${h.icon}</span>
            <span class="clue-item-title">${h.title}</span>
          </div>
          <span class="clue-item-tag">${isRead ? '已探索' : '點擊轉向 ➔'}</span>
        `;
        item.onclick = (e) => {
          e.stopPropagation();
          this.closeRadarMenu();
          this.navigateToClue(h, onClueReadCallback, onAllCluesFoundCallback);
        };
        radarContainer.appendChild(item);
      });
    },

    toggleRadarMenu() {
      const menu = document.getElementById('clue-radar-menu');
      const toggleBtn = document.getElementById('clue-radar-toggle-btn');
      if (!menu) return;
      const isHidden = menu.classList.contains('hidden');
      if (isHidden) {
        menu.classList.remove('hidden');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        menu.classList.add('hidden');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    },

    closeRadarMenu() {
      const menu = document.getElementById('clue-radar-menu');
      const toggleBtn = document.getElementById('clue-radar-toggle-btn');
      if (menu) menu.classList.add('hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    },

    navigateToClue(clue, onClueReadCallback, onAllCluesFoundCallback) {
      window.AudioManager.playClick();
      if (viewerInstance) {
        viewerInstance.lookAt(clue.pitch, clue.yaw, 75, 1000);
      }
      setTimeout(() => {
        this.openClueModal(clue, onClueReadCallback, onAllCluesFoundCallback);
      }, 500);
    },

    openClueModal(clue, onClueReadCallback, onAllCluesFoundCallback) {
      const modal = document.getElementById('clue-modal');
      const titleEl = document.getElementById('clue-title');
      const iconEl = document.getElementById('clue-icon');
      const textEl = document.getElementById('clue-text');
      const speakBtn = document.getElementById('clue-speak-btn');
      const closeBtn = document.getElementById('clue-close-btn');

      if (!modal) return;

      iconEl.textContent = clue.icon;
      titleEl.textContent = clue.title;
      textEl.textContent = clue.text;

      // 語音朗讀事件綁定
      speakBtn.onclick = () => {
        window.AudioManager.speak(`${clue.title}。${clue.text}`);
      };

      // 關閉小卡
      closeBtn.onclick = () => {
        window.AudioManager.stopSpeaking();
        window.AudioManager.playClick();
        modal.classList.add('hidden');
      };

      modal.classList.remove('hidden');

      // 標記為已讀
      const state = window.GameStorage.markClueRead(currentEra.id, clue.id);
      window.AudioManager.playClue();

      // 更新 hotspot 樣式
      this.refreshHotspotStyles();
      this.updateProgressCounter();

      if (typeof onClueReadCallback === 'function') {
        onClueReadCallback(clue, state);
      }

      // 檢查是否全部線索都讀過了
      const requiredClues = currentEra.hotspots.filter(h => !h.id.includes('egg')).map(h => h.id);
      const userReadList = state.readClues[currentEra.id] || [];
      const allFound = requiredClues.every(id => userReadList.includes(id));

      if (allFound && typeof onAllCluesFoundCallback === 'function') {
        onAllCluesFoundCallback();
      }
    },

    refreshHotspotStyles() {
      if (!currentEra) return;
      const state = window.GameStorage.get();
      const readClues = state.readClues[currentEra.id] || [];

      currentEra.hotspots.forEach(h => {
        const isRead = readClues.includes(h.id);
        document.querySelectorAll(`.golden-marker[data-id="${h.id}"]`).forEach(m => {
          m.classList.toggle('read', isRead);
          m.classList.toggle('unread', !isRead);
          const star = m.querySelector('.marker-star');
          if (star) star.textContent = isRead ? '✅' : '✨';
        });
      });
      this.updateRadarBar();
    },

    updateProgressCounter() {
      if (!currentEra) return;
      const state = window.GameStorage.get();
      const readClues = state.readClues[currentEra.id] || [];
      const requiredHotspots = currentEra.hotspots.filter(h => !h.id.includes('egg'));
      const total = requiredHotspots.length;
      const found = requiredHotspots.filter(h => readClues.includes(h.id)).length;

      const badge = document.getElementById('radar-progress-badge');
      if (badge) {
        badge.textContent = `${found} / ${total}`;
      }

      const counterEl = document.getElementById('clue-counter');
      if (counterEl) {
        counterEl.innerHTML = `<span>🔍 景觀線索</span> <strong>${found} / ${total}</strong>`;
      }

      const challengeBtn = document.getElementById('start-challenge-btn');
      if (challengeBtn) {
        if (found >= total) {
          challengeBtn.classList.remove('disabled');
          challengeBtn.removeAttribute('disabled');
          challengeBtn.classList.add('pulse-glow');
        } else {
          challengeBtn.classList.add('disabled');
          challengeBtn.setAttribute('disabled', 'true');
          challengeBtn.classList.remove('pulse-glow');
        }
      }
    },

    // 找不到線索輔助指引功能：平滑轉向最近一個未讀線索
    guideToNextUnread() {
      if (!viewerInstance || !currentEra) return;
      const state = window.GameStorage.get();
      const readClues = state.readClues[currentEra.id] || [];

      // 優先找主要線索
      const unread = currentEra.hotspots.find(h => !readClues.includes(h.id) && !h.id.includes('egg'));
      if (unread) {
        window.AudioManager.playTone(520, 'sine', 0.15);
        viewerInstance.lookAt(unread.pitch, unread.yaw, 80, 1200);
        
        // 小隊長提示
        window.App.updateCaptainSpeech(`發現線索方向！正在幫你轉過去，快看「${unread.title}」！`);
      } else {
        // 如果全部都找到了
        window.App.updateCaptainSpeech('太厲害了！這一站的線索你都找齊了，快點擊右下角開始「闖關任務」吧！');
      }
    },

    getViewer() {
      return viewerInstance;
    },

    destroy() {
      this.closeRadarMenu();
      if (viewerInstance) {
        try {
          viewerInstance.destroy();
        } catch (e) {
          // ignore
        }
        viewerInstance = null;
      }
    }
  };
})();
