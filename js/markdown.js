// js/markdown.js - 輕量純 JavaScript Markdown 解析器與表格雙向轉換器
(function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function inlineFormat(text) {
    if (!text) return '';
    let out = text;
    // 粗體 **text** 或 __text__
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // 斜體 *text* 或 _text_
    out = out.replace(/\*([^\*]+?)\*/g, '<em>$1</em>');
    out = out.replace(/_([^_]+?)_/g, '<em>$1</em>');
    // 刪除線 ~~text~~
    out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // 行內代碼 `code`
    out = out.replace(/`([^`]+?)`/g, '<code class="md-inline-code">$1</code>');
    // 連結 [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // 醒目標籤 💡 [提示] 或 🔥
    out = out.replace(/(💡|🔥|🌟|🏆|⚠️|🎯)/g, '<span class="md-emoji">$1</span>');
    return out;
  }

  const MarkdownLite = {
    /**
     * 將 Markdown 字串解析為 HTML
     */
    parse(md) {
      if (!md || typeof md !== 'string') return '';

      const lines = md.replace(/\r\n/g, '\n').split('\n');
      let html = [];
      let inTable = false;
      let tableRows = [];
      let tableAligns = [];
      let inList = false;
      let listType = 'ul'; // 'ul' | 'ol'
      let inBlockquote = false;
      let quoteLines = [];

      function flushTable() {
        if (!inTable) return;
        if (tableRows.length > 0) {
          let tHtml = '<div class="md-table-wrap"><table class="md-table">';
          // 第一列為表頭
          const header = tableRows[0];
          tHtml += '<thead><tr>';
          header.forEach((cell, idx) => {
            const align = tableAligns[idx] ? ` style="text-align: ${tableAligns[idx]};"` : '';
            tHtml += `<th${align}>${inlineFormat(cell)}</th>`;
          });
          tHtml += '</tr></thead><tbody>';

          for (let r = 1; r < tableRows.length; r++) {
            const row = tableRows[r];
            tHtml += '<tr>';
            row.forEach((cell, idx) => {
              const align = tableAligns[idx] ? ` style="text-align: ${tableAligns[idx]};"` : '';
              // 若首欄為加粗標籤
              if (idx === 0) {
                tHtml += `<td${align}><strong>${inlineFormat(cell)}</strong></td>`;
              } else {
                tHtml += `<td${align}>${inlineFormat(cell)}</td>`;
              }
            });
            tHtml += '</tr>';
          }

          tHtml += '</tbody></table></div>';
          html.push(tHtml);
        }
        inTable = false;
        tableRows = [];
        tableAligns = [];
      }

      function flushList() {
        if (!inList) return;
        html.push(`</${listType}>`);
        inList = false;
      }

      function flushBlockquote() {
        if (!inBlockquote) return;
        const qContent = quoteLines.map(l => inlineFormat(l)).join('<br>');
        if (qContent.includes('💡') || qContent.includes('[!NOTE]') || qContent.includes('[!TIP]')) {
          html.push(`<div class="md-alert info"><span class="md-alert-icon">💡</span><div>${qContent.replace(/\[!(NOTE|TIP|IMPORTANT)\]/i, '').trim()}</div></div>`);
        } else if (qContent.includes('⚠️') || qContent.includes('[!WARNING]')) {
          html.push(`<div class="md-alert warning"><span class="md-alert-icon">⚠️</span><div>${qContent.replace(/\[!WARNING\]/i, '').trim()}</div></div>`);
        } else {
          html.push(`<blockquote class="md-blockquote">${qContent}</blockquote>`);
        }
        inBlockquote = false;
        quoteLines = [];
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. 空行
        if (!trimmed) {
          flushTable();
          flushList();
          flushBlockquote();
          continue;
        }

        // 2. 檢測表格列 (以 | 開頭或包含多個 |)
        if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.endsWith('|'))) {
          flushList();
          flushBlockquote();

          // 解析儲存格
          const cells = trimmed
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map(c => c.trim());

          // 判斷是否為表格分隔列 (例如: | --- | :---: | ---: |)
          const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
          if (isSeparator) {
            tableAligns = cells.map(c => {
              const left = c.startsWith(':');
              const right = c.endsWith(':');
              if (left && right) return 'center';
              if (right) return 'right';
              if (left) return 'left';
              return 'left';
            });
            inTable = true;
            continue;
          }

          if (!inTable) {
            inTable = true;
            tableRows = [cells];
          } else {
            tableRows.push(cells);
          }
          continue;
        } else {
          flushTable();
        }

        // 3. 標題 (#, ##, ###, ####)
        const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (hMatch) {
          flushList();
          flushBlockquote();
          const level = hMatch[1].length;
          const text = inlineFormat(hMatch[2]);
          html.push(`<h${level} class="md-h${level}">${text}</h${level}>`);
          continue;
        }

        // 4. 分隔線 (---, ***, ___)
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
          flushList();
          flushBlockquote();
          html.push('<hr class="md-hr">');
          continue;
        }

        // 5. 引用或提示區塊 (> ...)
        if (trimmed.startsWith('>')) {
          flushList();
          inBlockquote = true;
          const qText = trimmed.replace(/^>\s*/, '');
          quoteLines.push(qText);
          continue;
        } else {
          flushBlockquote();
        }

        // 6. 無序清單 (- item, * item, + item)
        const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
        if (ulMatch) {
          if (!inList || listType !== 'ul') {
            flushList();
            inList = true;
            listType = 'ul';
            html.push('<ul class="md-ul">');
          }
          html.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
          continue;
        }

        // 7. 有序清單 (1. item, 2. item)
        const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (olMatch) {
          if (!inList || listType !== 'ol') {
            flushList();
            inList = true;
            listType = 'ol';
            html.push('<ol class="md-ol">');
          }
          html.push(`<li>${inlineFormat(olMatch[2])}</li>`);
          continue;
        }

        flushList();

        // 8. 一般段落
        html.push(`<p class="md-p">${inlineFormat(trimmed)}</p>`);
      }

      flushTable();
      flushList();
      flushBlockquote();

      return html.join('\n');
    },

    /**
     * 從 Markdown 內容中擷取表格，轉為 { headers: string[], rows: string[][] }
     */
    extractTable(md) {
      if (!md) return null;
      const lines = md.replace(/\r\n/g, '\n').split('\n');
      const tableLines = [];
      let foundTable = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.endsWith('|'))) {
          foundTable = true;
          tableLines.push(trimmed);
        } else if (foundTable && trimmed === '') {
          break;
        }
      }

      if (tableLines.length < 2) return null;

      const parseCells = l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().replace(/\*\*/g, ''));
      const headers = parseCells(tableLines[0]);
      const rows = [];

      for (let i = 1; i < tableLines.length; i++) {
        const cells = parseCells(tableLines[i]);
        const isSep = cells.every(c => /^:?-+:?$/.test(c));
        if (isSep) continue;
        rows.push(cells);
      }

      return { headers, rows };
    },

    /**
     * 將 { headers, rows } 結構轉換為標準 GFM Markdown 表格字串
     */
    toMarkdownTable(headers, rows) {
      if (!headers || !headers.length) return '';
      let md = [];
      md.push('| ' + headers.join(' | ') + ' |');
      md.push('| ' + headers.map(() => ':---').join(' | ') + ' |');
      if (rows && rows.length) {
        rows.forEach(row => {
          const cells = headers.map((_, idx) => (row[idx] !== undefined ? String(row[idx]).replace(/\|/g, '\\|') : ''));
          md.push('| ' + cells.join(' | ') + ' |');
        });
      }
      return md.join('\n');
    }
  };

  // 匯出全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownLite;
  }
  if (typeof window !== 'undefined') {
    window.MarkdownLite = MarkdownLite;
  }
})();
