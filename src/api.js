export default class API {
  constructor(token) {
    this.token = token;
    this.headers = {
      "BotuReadKernel": token,
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
        SCANID: scanId,
      }),
    });
    return this.handleJson(await resp.json());
  }

  async selectBookChapter(bookId, emId) {
    const resp = await fetch("/readkernel/KernelAPI/BookInfo/selectJgpBookChapter", {
      method: "POST",
      headers: this.headers,
      body: new URLSearchParams({
        BOOKID: bookId,
        EMID: emId,
      }),
    });
    return this.handleJson(await resp.json());
  }
}
