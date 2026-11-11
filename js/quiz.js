// js/quiz.js - 景點闖關任務問答邏輯
(function () {
  let currentEra = null;
  let currentQuestions = [];
  let currentIndex = 0;
  let isFinalBoss = false;

  window.QuizManager = {
    startEraQuiz(eraData) {
      currentEra = eraData;
      currentQuestions = eraData.quiz;
      currentIndex = 0;
      isFinalBoss = false;
      this.renderQuestion();
    },

    startFinalBoss(finalBossData) {
      currentEra = { name: '終極任務', id: 'finalBoss', badgeTitle: (window.ERAS_DATA && window.ERAS_DATA.certTitle) || '家鄉景觀小導覽員' };
      currentQuestions = [finalBossData];
      currentIndex = 0;
      isFinalBoss = true;
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
        progressEl.textContent = `第 ${currentIndex + 1} / ${currentQuestions.length} 題`;
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
        window.AudioManager.playWrong();
        selectedBtn.classList.add('shake', 'wrong');
        setTimeout(() => selectedBtn.classList.remove('shake'), 600);

        feedbackContainer.className = 'quiz-feedback-box hint-box';
        feedbackContainer.classList.remove('hidden');
        feedbackTextEl.innerHTML = `
          <div class="feedback-badge-tag hint">💡 提示一下</div>
          <p>${q.hint}</p>
          <small class="hint-small">別灰心，回想一下剛剛在 360° 場景看到的線索，再試一次！</small>
        `;
      }
    },

    handleQuizCompleted() {
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
