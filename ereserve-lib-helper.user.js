// ==UserScript==
// @name         EReserves Lib Helper
// @namespace    https://github.com/hotwords123/ereserves-lib-helper
// @version      0.1.2
// @author       hotwords123
// @description  Download textbooks from Tsinghua EReserves
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.tsinghua.edu.cn
// @match        http://ereserves.lib.tsinghua.edu.cn/readkernel/ReadJPG/JPGJsNetPage/*
// @match        https://ereserves.lib.tsinghua.edu.cn/readkernel/ReadJPG/JPGJsNetPage/*
// @require      https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js
// ==/UserScript==

(function (jspdf) {
  'use strict';

  class API {
    constructor(token) {
      this.token = token;
      this.headers = {
        "BotuReadKernel": token
      };
    }
    handleJson(json) {
      if (json.code !== 1) {
        throw new Error(`${json.info} (${json.code})`);
      }
      return json.data;
    }
    async selectBookChapters(scanId) {
      const resp = await fetch("/readkernel/KernelAPI/BookInfo/selectJgpBookChapters", {
        method: "POST",
        headers: this.headers,
        body: new URLSearchParams({
          SCANID: scanId
        })
      });
      return this.handleJson(await resp.json());
    }
    async selectBookChapter(bookId, emId) {
      const resp = await fetch("/readkernel/KernelAPI/BookInfo/selectJgpBookChapter", {
        method: "POST",
        headers: this.headers,
        body: new URLSearchParams({
          BOOKID: bookId,
          EMID: emId
        })
      });
      return this.handleJson(await resp.json());
    }
  }
  function getCookie(name) {
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [key, value] = cookie.split("=").map(decodeURIComponent);
      if (key === name) {
        return value;
      }
    }
    return null;
  }
  class TaskPool {
    constructor(maxTasks) {
      this.maxTasks = maxTasks;
      this.pendingTasks = [];
      this.runningTasks = 0;
    }
    async run(task) {
      await this.acquire();
      try {
        return await task();
      } finally {
        this.release();
      }
    }
    acquire() {
      if (this.runningTasks < this.maxTasks) {
        this.runningTasks++;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.pendingTasks.push(resolve);
      });
    }
    release() {
      const resolve = this.pendingTasks.shift();
      if (resolve) {
        resolve();
      } else {
        this.runningTasks--;
      }
    }
  }
  const url = new URL(window.location.href);
  if (url.pathname.startsWith("/readkernel/ReadJPG/JPGJsNetPage/")) {
    initDownloader();
  }
  function initDownloader() {
    var _a, _b, _c;
    const bookId = (_a = document.querySelector("#bookId")) == null ? void 0 : _a.value;
    const bookName = (_b = document.querySelector("#bookname")) == null ? void 0 : _b.value;
    const scanId = (_c = document.querySelector("#scanid")) == null ? void 0 : _c.value;
    const token = getCookie("BotuReadKernel");
    if (!bookId || !bookName || !scanId || !token) {
      alert("无法获取书籍信息");
      return;
    }
    const api = new API(token);
    const p_bookname = document.querySelector("#p_bookname");
    let working = false;
    p_bookname.title = "双击下载 PDF";
    p_bookname.addEventListener("dblclick", async () => {
      if (working) {
        return;
      }
      working = true;
      window.onbeforeunload = (evt) => {
        evt.preventDefault();
        evt.returnValue = "下载中，确定要离开吗？";
      };
      try {
        await handleDownload();
      } catch (err) {
        console.error(err);
        showFeedback("下载失败：" + err.message);
      } finally {
        working = false;
        window.onbeforeunload = null;
      }
    });
    function showFeedback(text) {
      p_bookname.textContent = text;
    }
    async function handleDownload() {
      showFeedback(`获取书籍信息：${bookName}`);
      const chapters = await api.selectBookChapters(scanId);
      for (const chapter of chapters) {
        showFeedback(`获取章节信息：${chapter.EFRAGMENTNAME}`);
        const data = await api.selectBookChapter(bookId, chapter.EMID);
        Object.assign(chapter, data);
      }
      showFeedback(`准备下载：${bookName}`);
      const pool = new TaskPool(8);
      const doc = new jspdf.jsPDF({
        unit: "px",
        putOnlyUsedFonts: true,
        compress: true,
        hotfixes: ["px_scaling"]
      });
      doc.deletePage(1);
      for (const chapter of chapters) {
        for (const page of chapter.JGPS) {
          const url2 = `/readkernel/JPGFile/DownJPGJsNetPage?filePath=${page.hfsKey}`;
          page.task = pool.run(async () => {
            for (let i = 0; i < 3; i++) {
              try {
                const resp = await fetch(url2);
                const arrayBuffer = await resp.arrayBuffer();
                return new Uint8Array(arrayBuffer);
              } catch (err) {
                console.error(err);
              }
            }
            throw new Error(`无法下载 ${url2}`);
          });
        }
      }
      for (const chapter of chapters) {
        let parent = null;
        for (let i = 0; i < chapter.JGPS.length; i++) {
          showFeedback(`下载中：${chapter.EFRAGMENTNAME} (${i + 1}/${chapter.JGPS.length})`);
          const page = chapter.JGPS[i];
          const data = await page.task;
          delete page.task;
          const { width, height } = jspdf.jsPDF.API.getImageProperties(data);
          doc.addPage([width, height], width > height ? "l" : "p");
          doc.addImage(data, "JPEG", 0, 0, width, height);
          const pageNumber = doc.getNumberOfPages();
          if (!parent) {
            parent = doc.outline.add(null, chapter.EFRAGMENTNAME, { pageNumber });
          }
        }
      }
      showFeedback(`下载完成：${bookName}`);
      doc.save(`${bookName}.pdf`);
    }
  }

})(jspdf);