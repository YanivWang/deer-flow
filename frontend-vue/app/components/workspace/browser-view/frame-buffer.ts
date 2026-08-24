/*
  【文件职责】     将 browser 二进制帧合并到每动画帧最多一次并回收 URL。
  【架构位置】     L3
  【主要导出】     createFrameBuffer
  【依赖关系】     browser requestAnimationFrame · object URL
  【边界与注意】   保留 I2-I4；服务 browser-view 业务接线。
*/

/** Coalesces lossy browser frames to the display refresh rate. */
export class LatestBrowserFrameBuffer {
  private pendingFrame: Blob | null = null;
  private pendingRequest: number | null = null;
  private currentUrl: string | null = null;

  constructor(private readonly publish: (url: string | null) => void) {}

  push(frame: Blob) {
    this.pendingFrame = frame;
    if (this.pendingRequest !== null) return;
    this.pendingRequest = requestAnimationFrame(() => {
      this.pendingRequest = null;
      const latest = this.pendingFrame;
      this.pendingFrame = null;
      if (!latest) return;
      const url = URL.createObjectURL(latest);
      this.revokeCurrent();
      this.currentUrl = url;
      this.publish(url);
    });
  }

  replaceWithUrl(url: string) {
    this.cancelPending();
    this.revokeCurrent();
    this.currentUrl = url;
    this.publish(url);
  }

  dispose() {
    this.cancelPending();
    this.revokeCurrent();
    this.publish(null);
  }

  private cancelPending() {
    this.pendingFrame = null;
    if (this.pendingRequest !== null) cancelAnimationFrame(this.pendingRequest);
    this.pendingRequest = null;
  }

  private revokeCurrent() {
    if (this.currentUrl?.startsWith("blob:"))
      URL.revokeObjectURL(this.currentUrl);
    this.currentUrl = null;
  }
}
