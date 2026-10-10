/* =============================================================
   importer.js · 导入 / 导出（文件、粘贴、下载）
   ============================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const D = global.DF;
  const I = global.I18n;
  const { $, toast } = U;

  function bind(app) {
    const fileInput = $('#fileInput');
    $('#btnImport').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const df = D.DataFrame.auto(String(reader.result), { name: f.name });
          app.loadData(df, `${I.t('msg.loaded')}：${f.name}`);
        } catch (e) {
          toast(I.t('msg.importFail') + '：' + (e.message || ''), 3000);
        }
      };
      reader.onerror = () => toast(I.t('msg.importFail'), 3000);
      reader.readAsText(f, 'utf-8');
      fileInput.value = '';
    });

    $('#btnPaste').addEventListener('click', () => {
      $('#pasteModal').hidden = false;
      $('#pasteArea').focus();
    });
    $('#btnPasteOk').addEventListener('click', () => {
      const text = $('#pasteArea').value.trim();
      if (!text) { toast(I.t('msg.pasteEmpty')); return; }
      try {
        const df = D.DataFrame.auto(text, { name: 'pasted' });
        $('#pasteModal').hidden = true;
        app.loadData(df, I.t('msg.loaded'));
      } catch (e) {
        toast(I.t('msg.importFail') + '：' + (e.message || ''), 3000);
      }
    });

    $('#btnExport').addEventListener('click', () => {
      const df = app.currentDf();
      if (!df) return;
      const csv = '\ufeff' + df.toCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dataflow-result.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(I.t('msg.exported'), 2400);
    });
  }

  global.Importer = { bind };
})(window);
