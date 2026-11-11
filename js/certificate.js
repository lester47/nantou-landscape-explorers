// js/certificate.js - 探險家闖關證書 Canvas 繪製與匯出
(function () {
  const CANVAS_WIDTH = 1754;
  const CANVAS_HEIGHT = 1240;

  window.CertificateManager = {
    canvas: null,
    ctx: null,

    init() {
      this.canvas = document.getElementById('certificate-canvas');
      if (this.canvas) {
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
      }
    },

    async render() {
      if (!this.canvas) this.init();
      if (!this.ctx) return;

      const ctx = this.ctx;
      const state = window.GameStorage.get();
      const playerName = state.playerName || '探險隊員';
      const erasData = window.ERAS_DATA || {};
      const issuer = erasData.issuer || '南投縣 國小社會領域教學團隊';

      // 取得日期
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const dateStr = `${year} 年 ${month} 月 ${day} 日`;

      // 1. 繪製背景底圖
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      try {
        let bgSrc = (erasData.assets && erasData.assets.certBg) || 'cert/certificate_bg.png';
        if (window.CERT_ASSETS && window.CERT_ASSETS.bg) {
          bgSrc = window.CERT_ASSETS.bg;
        }
        const bgImg = await this.loadImage(bgSrc);
        ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (e) {
        // Fallback 米色紙紋背景
        ctx.fillStyle = '#fcf8f0';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#b25d2e';
        ctx.strokeRect(30, 30, CANVAS_WIDTH - 60, CANVAS_HEIGHT - 60);
      }

      // 繪製內層古典飾框（底圖自帶插畫時不畫）
      if (!erasData.certLayout) {
        ctx.strokeStyle = '#d79b5c';
        ctx.lineWidth = 4;
        ctx.strokeRect(70, 70, CANVAS_WIDTH - 140, CANVAS_HEIGHT - 140);
      }

      // 2. 標題：闖關成功證書
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2e7d32';
      ctx.font = 'bold 56px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.letterSpacing = '6px';
      ctx.fillText(erasData.certSub || '🏆  闖  關  成  功  證  書  🏆', CANVAS_WIDTH / 2, 175);

      // 3. 稱號：臺灣史前時光探險家
      ctx.fillStyle = '#3e2723';
      ctx.font = 'bold 78px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.letterSpacing = '8px';
      ctx.fillText(erasData.certTitle || '家鄉景觀小導覽員', CANVAS_WIDTH / 2, 275);

      // 4. 金色分割線
      const grad = ctx.createLinearGradient(CANVAS_WIDTH / 2 - 400, 0, CANVAS_WIDTH / 2 + 400, 0);
      grad.addColorStop(0, 'rgba(215, 155, 92, 0)');
      grad.addColorStop(0.5, 'rgba(191, 54, 12, 0.85)');
      grad.addColorStop(1, 'rgba(215, 155, 92, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 - 450, 315);
      ctx.lineTo(CANVAS_WIDTH / 2 + 450, 315);
      ctx.stroke();

      // 5. 恭喜學生姓名
      ctx.fillStyle = '#271912';
      ctx.font = 'normal 46px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText(`恭喜`, CANVAS_WIDTH / 2, 400);

      // 學生姓名底線與加重
      ctx.font = 'bold 56px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.fillStyle = '#b71c1c';
      ctx.fillText(`【  ${playerName}  】 同學`, CANVAS_WIDTH / 2, 475);

      // 6. 表揚內文 (四行詩意敘述)
      ctx.fillStyle = '#4e342e';
      ctx.font = '500 36px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.letterSpacing = '2px';
      const lineHeight = 55;
      const startY = 565;
      const textLines = erasData.certTextLines || [
        '走訪南投 8 個景點，認識自然景觀與人文景觀，',
        '細心觀察景觀線索，並全數完成闖關任務，',
        '也看見地震和人為建設帶來的改變，',
        '表現卓絕優異，特頒發此證書，以資鼓勵！'
      ];
      textLines.forEach((line, idx) => {
        ctx.fillText(line, CANVAS_WIDTH / 2, startY + lineHeight * idx);
      });

      // 6b. 我推薦的家鄉景觀（課本動動腦）
      if (state.myLandscape) {
        ctx.fillStyle = '#c0571b';
        ctx.font = 'bold 36px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(`🏡 我推薦的家鄉景觀：「${state.myLandscape}」`, CANVAS_WIDTH / 2, startY + lineHeight * textLines.length + 12);
      }

      // 7. 徽章：若證書底圖有預留圓框（certLayout），就把徽章放進框裡
      const eras = erasData.eras || [];
      const badgeCount = eras.length;
      const layout = (window.CERT_LAYOUT_OFF ? null : erasData.certLayout) || null;
      const serial = `NT-LAND-${now.getTime().toString(36).toUpperCase()}`;

      if (layout && layout.badgeCenters && layout.badgeCenters.length >= badgeCount) {
        // 頒發單位與日期放在徽章上方
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4e342e';
        ctx.font = 'bold 28px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(`頒發單位：${issuer}`, CANVAS_WIDTH / 2, layout.issuerY);
        ctx.font = '24px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        ctx.fillStyle = '#6d4c41';
        ctx.fillText(`認證日期：${dateStr}　｜　認證序號：${serial}`, CANVAS_WIDTH / 2, layout.issuerY + 40);

        const size = layout.badgeSize;
        for (let i = 0; i < badgeCount; i++) {
          const era = eras[i];
          const bx = layout.badgeCenters[i];
          const by = layout.badgeY;
          try {
            let badgeSrc = window.LAsset ? window.LAsset(era.badge) : era.badge;
            if (window.CERT_ASSETS && window.CERT_ASSETS[era.id]) badgeSrc = window.CERT_ASSETS[era.id];
            const img = await this.loadImage(badgeSrc);
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, bx - size / 2, by - size / 2, size, size);
            ctx.restore();
          } catch (e) {
            ctx.font = '48px sans-serif';
            ctx.fillText(era.badgeEmoji || '🏅', bx, by + 16);
          }
          // 名稱寫在圓框下方的白底小籤
          const label = era.name.split('・')[1] || era.name;
          ctx.font = 'bold 17px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
          const tw = ctx.measureText(label).width;
          const ly = by + size / 2 + 26;
          ctx.fillStyle = 'rgba(255, 252, 243, 0.92)';
          ctx.fillRect(bx - tw / 2 - 8, ly - 19, tw + 16, 26);
          ctx.fillStyle = '#3e2723';
          ctx.fillText(label, bx, ly);
        }
        return;
      }

      const badgeY = badgeCount > 6 ? 892 : 870;
      const badgeSize = badgeCount > 6 ? 116 : badgeCount > 3 ? 130 : 160;

      for (let i = 0; i < badgeCount; i++) {
        const era = eras[i];
        const badgeX = (CANVAS_WIDTH / (badgeCount + 1)) * (i + 1);

        try {
          let badgeSrc = (window.LAsset ? window.LAsset(era.badge) : era.badge) || `img/badges/${era.id}.png`;
          if (window.CERT_ASSETS && window.CERT_ASSETS[era.id]) {
            badgeSrc = window.CERT_ASSETS[era.id];
          }
          const img = await this.loadImage(badgeSrc);
          ctx.drawImage(img, badgeX - badgeSize / 2, badgeY - badgeSize / 2, badgeSize, badgeSize);
        } catch (e) {
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#ff9800';
          ctx.fill();
          ctx.font = '54px sans-serif';
          ctx.fillText(era.badgeEmoji || '🏅', badgeX, badgeY + 18);
        }

        ctx.fillStyle = '#5d4037';
        ctx.font = `bold ${badgeCount > 3 ? 22 : 26}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
        ctx.fillText(badgeCount > 6 ? (era.name.split('・')[1] || era.name) : era.name, badgeX, badgeY + badgeSize / 2 + 32);
        ctx.fillStyle = '#2e7d32';
        ctx.font = `bold ${badgeCount > 3 ? 20 : 24}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
        ctx.fillText(era.badgeTitle || '景觀小達人', badgeX, badgeY + badgeSize / 2 + (badgeCount > 3 ? 56 : 65));
      }

      // 8. 頒發單位與日期
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4e342e';
      ctx.font = 'bold 28px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.fillText(`頒發單位：${issuer}`, CANVAS_WIDTH - 240, 1062);
      ctx.font = '26px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.fillText(`認證日期：${dateStr}`, CANVAS_WIDTH - 240, 1100);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#8d6e63';
      ctx.font = '22px monospace';
      ctx.fillText(`認證序號：${serial}`, 240, 1100);
    },

    loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed ' + src));
        img.src = src;
      });
    },

    download() {
      if (!this.canvas) this.init();
      if (!this.canvas) return;
      const state = window.GameStorage.get();
      const playerName = state.playerName || '探險隊員';
      const filename = `${(window.ERAS_DATA && window.ERAS_DATA.certTitle) || '家鄉景觀小導覽員'}證書_${playerName}.png`;

      if (window.claude && window.claude.use && !this._skipClaudeSave) {
        const canvas = this.canvas;
        window.claude.use('downloads').then((dl) => {
          if (!dl) { this._skipClaudeSave = true; this.download(); this._skipClaudeSave = false; return; }
          canvas.toBlob((blob) => {
            if (!blob) return;
            dl.save({ filename, data: blob }).catch((e) => {
              if (e && e.code !== 'declined' && e.code !== 'rate_limited') {
                alert('這裡無法直接下載，請點擊「🖨️ 列印證書 (A4)」列印或另存為 PDF 喔！');
              }
            });
          }, 'image/png');
        });
        return;
      }

      const triggerDownload = (url) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) {
            document.body.removeChild(a);
          }
        }, 300);
      };

      try {
        if (this.canvas.toBlob) {
          this.canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              triggerDownload(url);
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            } else {
              try {
                const dataUrl = this.canvas.toDataURL('image/png');
                triggerDownload(dataUrl);
              } catch (e) {
                console.warn('toDataURL fallback failed:', e);
              }
            }
          }, 'image/png');
          return;
        }
      } catch (err) {
        console.warn('toBlob threw error, trying toDataURL...', err);
      }

      try {
        const dataUrl = this.canvas.toDataURL('image/png');
        triggerDownload(dataUrl);
      } catch (err2) {
        console.error('All download methods failed:', err2);
        alert('瀏覽器安全性限制下載圖片，請點擊「🖨️ 列印證書 (A4)」按鈕直接列印或另存為 PDF 喔！');
      }
    },

    print() {
      window.print();
    }
  };
})();
