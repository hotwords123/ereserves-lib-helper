import jsPDF from "jspdf";
import API from "./api";
import { getCookie, TaskPool } from "./util";

const url = new URL(window.location.href);

if (url.pathname.startsWith("/readkernel/ReadJPG/JPGJsNetPage/")) {
  initDownloader();
}

function initDownloader() {
  const bookId = document.querySelector("#bookId")?.value;
  const bookName = document.querySelector("#bookname")?.value;
  const scanId = document.querySelector("#scanid")?.value;
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
    const doc = new jsPDF({
      unit: "px",
      putOnlyUsedFonts: true,
      compress: true,
      hotfixes: ["px_scaling"],
    });
    doc.deletePage(1);

    for (const chapter of chapters) {
      for (const page of chapter.JGPS) {
        const url = `/readkernel/JPGFile/DownJPGJsNetPage?filePath=${page.hfsKey}`;

        page.task = pool.run(async () => {
          for (let i = 0; i < 3; i++) {
            try {
              const resp = await fetch(url);
              const arrayBuffer = await resp.arrayBuffer();
              return new Uint8Array(arrayBuffer);
            } catch (err) {
              console.error(err);
            }
          }

          throw new Error(`无法下载 ${url}`);
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

        const { width, height } = jsPDF.API.getImageProperties(data);
        doc.addPage([width, height], width > height ? "l" : "p");
        doc.addImage(data, "JPEG", 0, 0, width, height);

        const pageNumber = doc.getNumberOfPages();
        if (!parent) {
          parent = doc.outline.add(null, chapter.EFRAGMENTNAME, { pageNumber });
        }
        // doc.outline.add(parent, page.fileName, { pageNumber });
      }
    }

    showFeedback(`下载完成：${bookName}`);
    doc.save(`${bookName}.pdf`);
  }
}
