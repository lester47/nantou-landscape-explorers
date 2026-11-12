// js/quiz.js - 景點闖關任務問答邏輯
(function () {
  let currentEra = null;
  let currentQuestions = [];
  let currentIndex = 0;
  let isFinalBoss = false;
  let lockedOut = false;

  // 防亂猜設定：eras.json 加 "quizRetry": { "maxWrong": 2 } 才啟用
  function retryRule() {
    const r = window.ERAS_DATA && window.ERAS_DATA.quizRetry;
    return r && r.maxWrong > 0 ? r : null;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 重來時：題目順序與選項位置都打亂（答案跟著選項移動）
  function shuffledQuiz(quiz) {
    return shuffle(quiz.map((q, i) => ({ q, i }))).map(({ q, i }) => {
      const order = shuffle(q.options.map((_, k) => k));
      return { ...q, options: order.map(k => q.options[k]), answer: order.indexOf(q.answer), _origIndex: i };
    });
  }

  window.QuizManager = {
    startEraQuiz(eraData) {
      currentEra = eraData;
      const retried = retryRule() && window.GameStorage.get().quizRetries?.[eraData.id] > 0;
      currentQuestions = retried
        ? shuffledQuiz(eraData.quiz)
        : eraData.quiz.map((q, i) => ({ ...q, _origIndex: i }));
      currentIndex = 0;
      isFinalBoss = false;
      lockedOut = false;
      this.renderQuestion();

      // 上次錯太多題卻沒回去看（例如重新整理），直接要求重新探索
      const rule = retryRule();
      if (rule && window.GameStorage.getQuizMissed(eraData.id).length >= rule.maxWrong) {
        this.lockOutForRetry(rule,
          document.getElementById('quiz-options-container'),
          document.getElementById('quiz-feedback'),
          document.getElementById('quiz-feedback-text'),
          document.getElementById('quiz-next-btn'));
      }
    },

    startFinalBoss(finalBossData) {
      currentEra = { name: '終極任務', id: 'finalBoss', badgeTitle: (window.ERAS_DATA && window.ERAS_DATA.certTitle) || '家鄉景觀小導覽員' };
      currentQuestions = [finalBossData];
      currentIndex = 0;
      isFinalBoss = true;
      lockedOut = false;
      this.renderQuestion();
    },

    renderQuestion() {
      const q = currentQuestions[currentIndex];
      if (!q) return;

      const titleEl = document.getElementById('quiz-era-name');
      const progressEl = document.getElementById('quiz-progress');
      const questionTextEl = document.getElementById('quiz-question-text');
      const optionsContainer = document.getElementById('quiz-options-container');
      const feedbackContainer = document.getElementById('quiz-feedback');
      const feedbackTextEl = document.getElementById('quiz-feedback-text');
      const nextBtn = document.getElementById('quiz-next-btn');
      const speakBtn = document.getElementById('quiz-speak-btn');

      if (titleEl) {
        titleEl.textContent = isFinalBoss ? '🌟 終極大挑戰' : `${currentEra.badgeEmoji || '🏁'} ${currentEra.name}・闖關任務`;
        if (window.Landscape) window.Landscape.onQuizRender(isFinalBoss ? null : currentEra);
      }
      if (progressEl) {
        let progressText = `第 ${currentIndex + 1} / ${currentQuestions.length} 題`;
        const rule = !isFinalBoss && retryRule();
        if (rule) {
          const left = rule.maxWrong - window.GameStorage.getQuizMissed(currentEra.id).length;
          progressText += `｜可答錯 ${Math.max(left - 1, 0)} 題`;
        }
        progressEl.textContent = progressText;
      }
      if (questionTextEl) {
        questionTextEl.textContent = q.q;
      }

      // 語音朗讀題目
      if (speakBtn) {
        speakBtn.onclick = () => {
          const optionsText = q.options.map((opt, i) => `選項 ${String.fromCharCode(65 + i)}：${opt}`).join('。');
          window.AudioManager.speak(`${q.q}。${optionsText}`);
        };
      }

      // 重設反饋區
      feedbackContainer.classList.add('hidden');
      feedbackContainer.className = 'quiz-feedback-box hidden';
      nextBtn.classList.add('hidden');

      // 渲染選項按鈕
      optionsContainer.innerHTML = '';
      delete optionsContainer.dataset.tried;
      const optionLetters = ['A', 'B', 'C', 'D'];

      q.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.innerHTML = `
          <span class="option-letter">${optionLetters[idx]}</span>
          <span class="option-text">${optText}</span>
        `;

        btn.onclick = () => {
          this.handleAnswer(idx, q, btn, optionsContainer, feedbackContainer, feedbackTextEl, nextBtn);
        };

        optionsContainer.appendChild(btn);
      });
    },

    handleAnswer(selectedIdx, q, selectedBtn, optionsContainer, feedbackContainer, feedbackTextEl, nextBtn) {
      const isCorrect = selectedIdx === q.answer;

      if (isCorrect) {
        window.AudioManager.playCorrect();
        selectedBtn.classList.add('correct');

        // 禁用其他選項
        const allBtns = optionsContainer.querySelectorAll('.quiz-option-btn');
        allBtns.forEach(btn => btn.setAttribute('disabled', 'true'));

        feedbackContainer.className = 'quiz-feedback-box success-box';
        feedbackContainer.classList.remove('hidden');
        feedbackTextEl.innerHTML = `
          <div class="feedback-badge-tag">🎉 答對了！</div>
          <p>${q.explain}</p>
        `;

        const isLastQuestion = currentIndex + 1 >= currentQuestions.length;
        nextBtn.textContent = isLastQuestion ? (isFinalBoss ? '🏆 領取家鄉景觀小導覽員證書' : '✨ 通關！領取榮譽徽章') : '下一題 ➔';
        nextBtn.classList.remove('hidden');

        nextBtn.onclick = () => {
          window.AudioManager.playClick();
          window.AudioManager.stopSpeaking();
          if (isLastQuestion) {
            this.handleQuizCompleted();
          } else {
            currentIndex++;
            this.renderQuestion();
          }
        };
      } else {
        if (lockedOut) return;
        window.AudioManager.playWrong();
        selectedBtn.classList.add('shake', 'wrong');
        setTimeout(() => selectedBtn.classList.remove('shake'), 600);

        const rule = !isFinalBoss && retryRule();
        if (rule) {
          // 只算「這題第一次作答」就答錯
          const firstTry = !optionsContainer.dataset.tried;
          optionsContainer.dataset.tried = '1';
          const missed = firstTry
            ? window.GameStorage.addQuizMissed(currentEra.id, q._origIndex)
            : window.GameStorage.getQuizMissed(currentEra.id);

          if (missed.length >= rule.maxWrong) {
            this.lockOutForRetry(rule, optionsContainer, feedbackContainer, feedbackTextEl, nextBtn);
            return;
          }

          const left = rule.maxWrong - missed.length;
          feedbackContainer.className = 'quiz-feedback-box hint-box';
          feedbackContainer.classList.remove('hidden');
          feedbackTextEl.innerHTML = `
            <div class="feedback-badge-tag hint">💡 提示一下</div>
            <p>${q.hint}</p>
            <small class="hint-small">${firstTry
              ? `⚠️ 這一站已經有 ${missed.length} 題第一次就答錯了，再錯 ${left} 題就要回 360° 重新找線索喔！`
              : '回想一下剛剛在 360° 場景看到的線索，再試一次！'}</small>
          `;
          const progressEl = document.getElementById('quiz-progress');
          if (progressEl) progressEl.textContent = `第 ${currentIndex + 1} / ${currentQuestions.length} 題｜可答錯 ${Math.max(left - 1, 0)} 題`;
          return;
        }

        feedbackContainer.className = 'quiz-feedback-box hint-box';
        feedbackContainer.classList.remove('hidden');
        feedbackTextEl.innerHTML = `
          <div class="feedback-badge-tag hint">💡 提示一下</div>
          <p>${q.hint}</p>
          <small class="hint-small">別灰心，回想一下剛剛在 360° 場景看到的線索，再試一次！</small>
        `;
      }
    },

    lockOutForRetry(rule, optionsContainer, feedbackContainer, feedbackTextEl, nextBtn) {
      lockedOut = true;
      optionsContainer.querySelectorAll('.quiz-option-btn').forEach(btn => btn.setAttribute('disabled', 'true'));
      const backBtn = document.getElementById('quiz-back-to-scene-btn');
      if (backBtn) backBtn.classList.add('hidden');

      feedbackContainer.className = 'quiz-feedback-box hint-box';
      feedbackContainer.classList.remove('hidden');
      feedbackTextEl.innerHTML = `
        <div class="feedback-badge-tag hint">🔍 再探險一次！</div>
        <p>這一站有 ${rule.maxWrong} 題第一次就答錯了，看起來線索還沒看仔細喔！</p>
        <small class="hint-small">回到 360° 場景把線索重新看一遍，再回來挑戰。題目和選項的順序會重新排列。</small>
      `;

      nextBtn.textContent = '🔍 回到 360° 重新找線索';
      nextBtn.classList.remove('hidden');
      nextBtn.onclick = () => {
        window.AudioManager.playClick();
        window.AudioManager.stopSpeaking();
        if (backBtn) backBtn.classList.remove('hidden');
        window.GameStorage.resetEraForRetry(currentEra.id);
        window.App.openEraScene(currentEra.id);
        window.App.updateCaptainSpeech(`線索都變回未看了！把「${currentEra.name}」的線索仔細再看一次，看完再來挑戰吧！`);
      };
    },

    handleQuizCompleted() {
      if (!isFinalBoss && retryRule()) window.GameStorage.clearQuizMissed(currentEra.id);
      if (isFinalBoss) {
        window.GameStorage.setFinalBossCompleted();
        window.AudioManager.playWin();
        window.App.showScreen('certificate-screen');
        window.CertificateManager.render();
      } else {
        // 完成一個時代
        window.GameStorage.completeEra(currentEra.id);
        window.AudioManager.playWin();
        window.App.showEraVictoryModal(currentEra);
      }
    }
  };
})();
