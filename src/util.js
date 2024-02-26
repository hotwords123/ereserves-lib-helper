export function getCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=").map(decodeURIComponent);
    if (key === name) {
      return value;
    }
  }
  return null;
}

export class TaskPool {
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
