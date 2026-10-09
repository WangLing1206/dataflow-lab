/* =============================================================
   importer.js · 数据导入 / 导出
   ============================================================= */
(function (global) {
  'use strict';
  const { toast } = global.U;

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(new Error('文件读取失败'));
      fr.readAsText(file, 'utf-8');
    });
  }

  function parse(text, name) {
    const df = global.DF.DataFrame.auto(text, { name: name || '导入数据' });
    if (!df.length) throw new Error('没有解析到数据行');
    return df;
  }

  function exportCSV(df, filename) {
    const blob = new Blob(['\ufeff' + df.toCSV()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'dataflow-result.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('已导出 CSV：' + (filename || 'dataflow-result.csv'));
  }

  function bind(app) {
    const fileInput = document.getElementById('fileInput');
    document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        const text = await readFile(f);
        const df = parse(text, f.name);
        app.loadData(df, `已导入 ${f.name}：${df.length} 行 × ${df.columns.length} 列`);
      } catch (e) {
        toast('导入失败：' + e.message, 3200);
      }
      fileInput.value = '';
    });

    const modal = document.getElementById('pasteModal');
    document.getElementById('btnPaste').addEventListener('click', () => { modal.hidden = false; });
    modal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) modal.hidden = true; });
    document.getElementById('btnPasteOk').addEventListener('click', () => {
      const text = document.getElementById('pasteArea').value.trim();
      if (!text) { toast('请先粘贴数据'); return; }
      try {
        const df = parse(text, '粘贴数据');
        app.loadData(df, `已载入粘贴数据：${df.length} 行 × ${df.columns.length} 列`);
        modal.hidden = true;
      } catch (e) {
        toast('解析失败：' + e.message, 3200);
      }
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      exportCSV(app.currentDf(), 'dataflow-result.csv');
    });
  }

  global.Importer = { bind, readFile, parse, exportCSV };
})(window);
