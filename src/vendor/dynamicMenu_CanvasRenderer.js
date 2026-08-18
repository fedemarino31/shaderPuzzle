var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { P as PROTOCOL_VERSION, a as checkProtocol, c as completeTreePath } from "./dynamicMenu_protocol_57NKGFsr.js";
function shouldRenderControlChange(mode, event) {
  return mode !== "commitOnly" || (event == null ? void 0 : event.forceImmediate) === true;
}
const DEFAULT_THEME = {
  bg: "#1a1a1a",
  fg: "#ffffff",
  accent: "#dddddd",
  // matches the amber/gold of the UI screenshot
  accentDim: "#aaaaaa",
  muted: "#aaa",
  mutedDark: "#555555",
  separator: "#333333",
  btnBg: "#2e2e2e",
  // solid fill for inactive buttons/switches/arrows
  tabBg: "#3a3a3a",
  tabActiveBg: "#5d5d5d",
  fontFamily: '"Roboto Mono", monospace',
  // matches the DOM menu; falls back to system monospace
  fontPx: 8,
  // logical pixels
  rowHeight: 16,
  tabHeight: 16,
  padding: 4,
  labelWidth: 80,
  // logical px allocated to item label
  valueWidth: 40,
  // logical px for value text on the right
  trackHeight: 4,
  // slider track height in logical px
  knobWidth: 4,
  // slider knob width in logical px
  treeOptMinW: 28,
  // minimum option button width for treeList
  treeLevelGap: 5,
  // gap in px between tree levels
  treeRowGap: 1,
  // gap in px between rows within the same level
  treeRowH: 14,
  // height in px of each option row in treeList
  tabFillWidth: false,
  // true → tabs share full width equally; false → square tabs sized to label, left-aligned
  separatorHeight: 8,
  // logical height of a separator row
  folderHeaderBg: "#2b2b2b",
  // background fill for a folder header row
  folderContentBg: "rgba(0,0,0,0.28)",
  // darker box drawn behind a folder's children
  folderIndent: 8,
  // logical px each nesting level indents a folder's children
  focus: "#e8a531",
  // focus navigation cursor color (amber/orange, matches DOM --mm-focus)
  focusLineWidth: 1.5
  // focus cursor stroke width in logical px
};
class CanvasRenderer {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas - The output canvas element.
   * @param {number} [options.logicalWidth]    - Logical width in px (auto if omitted).
   * @param {number} [options.logicalHeight]   - Logical height in px (auto if omitted).
   * @param {number} [options.scale=2]         - Device pixel ratio / upscale factor.
   * @param {'commitOnly'|'immediate'} [options.mode='commitOnly'] - Update mode. Events explicitly
   * marked for immediate feedback (such as continuous focused-slider adjustment) are rendered in either mode.
   * @param {object} [options.theme]           - Partial theme override.
   */
  constructor({ canvas, logicalWidth, logicalHeight, scale = 2, mode = "commitOnly", theme = {} } = {}) {
    this.canvas = canvas;
    this._userLogicalWidth = logicalWidth ?? null;
    this._userLogicalHeight = logicalHeight ?? null;
    this.scale = scale;
    this.mode = mode;
    this.theme = Object.assign({}, DEFAULT_THEME, theme);
    this.logicalWidth = logicalWidth ?? 0;
    this.logicalHeight = logicalHeight ?? 0;
    this.menuState = null;
    this.layoutCache = null;
    this.protocolVersion = PROTOCOL_VERSION;
    this._protocolWarned = false;
    this.focus = null;
    this.bgCanvas = document.createElement("canvas");
    this.dynCanvas = document.createElement("canvas");
    this.onCommand = null;
    this.onResize = null;
    this.onRender = null;
    this._dragState = null;
    this.viewMode = "composed";
    this.iconAtlas = null;
  }
  // ─── Public API ───────────────────────────────────────────────────────────
  /**
   * Validate that an incoming DynamicMenu snapshot speaks a compatible protocol.
   * Throws on a major mismatch (the data cannot be interpreted safely); warns
   * once per renderer instance on a minor mismatch or a missing version.
   * @param {object} state - Snapshot carrying a `version` field.
   * @private
   */
  _assertProtocol(state) {
    const { level, message } = checkProtocol(state == null ? void 0 : state.version);
    if (level === "major") throw new Error(message);
    if ((level === "minor" || level === "unknown") && !this._protocolWarned) {
      this._protocolWarned = true;
      console.warn(message);
    }
  }
  /**
   * Load a full menu state snapshot and render everything.
   * If logicalWidth/logicalHeight were not provided to the constructor,
   * they are auto-computed from the state here.
   * @param {object} menuState - Snapshot from menu.getMenuState()
   */
  setState(menuState) {
    var _a;
    this._assertProtocol(menuState);
    this.menuState = menuState;
    this.focus = (menuState == null ? void 0 : menuState.focus) ?? null;
    if (this._userLogicalWidth === null || this._userLogicalHeight === null) {
      const [w, h] = this._computeAutoSize(menuState);
      if (this._userLogicalWidth === null) this.logicalWidth = w;
      if (this._userLogicalHeight === null) this.logicalHeight = h;
    }
    this._initCanvases();
    this._computeLayout();
    this.renderFull();
    this._ensureTextFont();
    if ((_a = menuState.tabs) == null ? void 0 : _a.some((t) => t.icon)) {
      this.iconAtlas = null;
      this._buildIconAtlas(menuState.tabs);
    }
  }
  /**
   * Make sure the configured text font (e.g. "Roboto Mono") is loaded into the
   * document's FontFaceSet before drawing. The @font-face is registered by the
   * DynamicMenu stylesheet (injected inline when DynamicMenu mounts). If the
   * family is generic or unavailable, the canvas falls back to system monospace.
   */
  async _ensureTextFont() {
    if (this._textFontReady) return;
    const primary = String(this.theme.fontFamily || "").split(",")[0].trim().replace(/['"]/g, "");
    if (!primary || ["monospace", "serif", "sans-serif"].includes(primary)) {
      this._textFontReady = true;
      return;
    }
    const px = Math.round((this.theme.fontPx || 8) * (this.scale || 1));
    try {
      await Promise.all([
        document.fonts.load(`${px}px "${primary}"`),
        document.fonts.load(`700 ${px}px "${primary}"`)
      ]);
    } catch (e) {
    }
    this._textFontReady = true;
    this.renderFull();
  }
  /**
   * Apply an event emitted by DynamicMenu.
   * @param {object} evt - Event from menu.subscribe()
   */
  applyEvent(evt) {
    var _a;
    if (!this.menuState) return;
    if (evt == null ? void 0 : evt.state) this._assertProtocol(evt.state);
    switch (evt.type) {
      case "tabChange":
        if (evt.state) {
          this.menuState = evt.state;
          if ("focus" in evt.state) this.focus = evt.state.focus;
        } else if (evt.currentTabId) this.menuState.currentTabId = evt.currentTabId;
        this._computeLayout();
        this.renderFull();
        break;
      case "focusChange":
        this.focus = evt.focus ?? null;
        this._compose();
        break;
      case "structureChange":
        if (evt.state) {
          this.menuState = evt.state;
          if ("focus" in evt.state) this.focus = evt.state.focus;
        }
        if (this._userLogicalWidth === null || this._userLogicalHeight === null) {
          const [w, h] = this._computeAutoSize(this.menuState);
          if (this._userLogicalWidth === null) this.logicalWidth = w;
          if (this._userLogicalHeight === null) this.logicalHeight = h;
          this._initCanvases();
        }
        this._computeLayout();
        this.renderFull();
        if ((_a = this.menuState.tabs) == null ? void 0 : _a.some((t) => t.icon)) {
          this.iconAtlas = null;
          this._buildIconAtlas(this.menuState.tabs);
        }
        break;
      case "controlChange":
        if (!shouldRenderControlChange(this.mode, evt)) break;
        this._applyControlPatch(evt);
        break;
      case "controlCommit":
        this._applyControlPatch(evt);
        break;
      case "visibilityChange":
        if (!evt.visible) {
          const ctx = this.canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
          this.renderFull();
        }
        break;
    }
  }
  /** Force a full re-render of both layers and compose. */
  renderFull() {
    if (!this.menuState || !this.layoutCache) return;
    this._renderBackground();
    this._renderDynamicFull();
    this._compose();
  }
  /** Re-render only the dynamic layer completely, then compose. */
  renderDynamicFull() {
    if (!this.menuState || !this.layoutCache) return;
    this._renderDynamicFull();
    this._compose();
  }
  /**
   * Re-render only the dynamic region of a single item, then compose.
   * Falls back to full dynamic redraw if item rect is not found.
   * @param {string} itemId
   */
  renderItemDynamic(itemId) {
    if (!this.menuState || !this.layoutCache) return;
    const rect = this.layoutCache.itemRects[itemId];
    if (!rect) {
      this.renderDynamicFull();
      return;
    }
    const ctx = this.dynCanvas.getContext("2d");
    const s = this.scale;
    ctx.clearRect(rect.x * s, rect.y * s, rect.w * s, rect.h * s);
    const activeTab = this._getActiveTab();
    if (!activeTab) return;
    const item = activeTab.items.find((i) => i.id === itemId);
    if (!item) return;
    this._renderItemDynamic(ctx, item, rect, s);
    this._compose();
  }
  /**
   * Resize to new logical dimensions. Triggers a full re-render.
   * @param {number} logicalWidth
   * @param {number} logicalHeight
   * @param {number} [scale]
   */
  resize(logicalWidth, logicalHeight, scale) {
    this._userLogicalWidth = logicalWidth;
    this._userLogicalHeight = logicalHeight;
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    if (scale !== void 0) this.scale = scale;
    this._initCanvases();
    if (this.menuState) {
      this._computeLayout();
      this.renderFull();
    }
  }
  /** Returns the output canvas element. */
  getCanvas() {
    return this.canvas;
  }
  /**
   * Switch which layer is displayed on the output canvas.
   * @param {'composed'|'bg'|'dyn'} mode
   */
  setViewMode(mode) {
    this.viewMode = mode;
    this._compose();
  }
  /** Cleans up internal state. */
  destroy() {
    this.menuState = null;
    this.layoutCache = null;
    this.focus = null;
    this.bgCanvas = null;
    this.dynCanvas = null;
  }
  // ─── Internal ─────────────────────────────────────────────────────────────
  _computeAutoSize(menuState) {
    const { tabHeight, rowHeight, padding } = this.theme;
    const autoWidth = this._userLogicalWidth ?? this.theme.labelWidth + 100 + this.theme.valueWidth + padding * 2;
    let maxContentHeight = 0;
    if (menuState && menuState.tabs) {
      menuState.tabs.forEach((tab) => {
        let tabH = 0;
        this._getVisibleItems(tab).forEach(({ item }) => {
          tabH += this._measureItemHeight(item, autoWidth);
        });
        if (tabH > maxContentHeight) maxContentHeight = tabH;
      });
    }
    const autoHeight = tabHeight + padding * 2 + rowHeight + maxContentHeight;
    return [autoWidth, autoHeight];
  }
  _initCanvases() {
    var _a;
    const w = Math.round(this.logicalWidth * this.scale);
    const h = Math.round(this.logicalHeight * this.scale);
    const sizeChanged = this.canvas.width !== w || this.canvas.height !== h;
    for (const c of [this.canvas, this.bgCanvas, this.dynCanvas]) {
      c.width = w;
      c.height = h;
      c.style.width = this.logicalWidth + "px";
      c.style.height = this.logicalHeight + "px";
    }
    if (sizeChanged) (_a = this.onResize) == null ? void 0 : _a.call(this, w, h, this.logicalWidth, this.logicalHeight);
  }
  _computeLayout() {
    if (!this.menuState) return;
    const { tabHeight, rowHeight, padding } = this.theme;
    const w = this.logicalWidth;
    const tabBarRect = { x: 0, y: 0, w, h: tabHeight };
    const contentY = tabHeight;
    const activeTab = this._getActiveTab();
    const itemRects = {};
    if (activeTab && activeTab.items) {
      let currentY = contentY + padding + rowHeight;
      this._getVisibleItems(activeTab).forEach(({ item, depth }) => {
        const indent = depth * this.theme.folderIndent;
        const controlX = padding + this.theme.labelWidth + indent;
        const controlW = w - controlX - this.theme.valueWidth - padding;
        const h = this._measureItemHeight(item, w);
        const y = currentY;
        currentY += h;
        const labelRect = { x: padding + indent, y, w: this.theme.labelWidth, h };
        const valueRect = { x: w - this.theme.valueWidth - padding, y, w: this.theme.valueWidth, h };
        const rect = { x: 0, y, w, h, type: item.type, depth, labelRect, valueRect };
        if (item.type === "folder") {
          rect.headerRect = { x: 0, y, w, h };
        } else if (item.type === "slider") {
          const trackY = y + Math.floor((h - this.theme.trackHeight) / 2);
          rect.trackRect = { x: controlX, y: trackY, w: controlW, h: this.theme.trackHeight };
        } else if (item.type === "button") {
          const btnAreaX = controlX;
          const btnAreaW = w - btnAreaX - padding;
          const buttons = item.buttons || [];
          const btnCount = buttons.length;
          const btnGap = 2;
          const hPad = 8;
          const charW = this.theme.fontPx * 0.65;
          const minBtnW = 20;
          if (btnCount === 0) {
            rect.buttonRects = [];
          } else {
            const natWidths = buttons.map((btn) => {
              const lbl = typeof btn === "object" ? btn.label || "" : String(btn || "");
              return Math.max(minBtnW, Math.ceil(lbl.length * charW) + hPad * 2);
            });
            const totalNat = natWidths.reduce((s, bw) => s + bw, 0) + btnGap * (btnCount - 1);
            let startX, finalWidths;
            if (totalNat <= btnAreaW) {
              startX = btnAreaX + Math.floor((btnAreaW - totalNat) / 2);
              finalWidths = natWidths;
            } else {
              startX = btnAreaX;
              const available = btnAreaW - btnGap * (btnCount - 1);
              const totalNatNoGap = natWidths.reduce((s, bw) => s + bw, 0);
              finalWidths = natWidths.map(
                (nw) => Math.max(minBtnW, Math.round(nw / totalNatNoGap * available))
              );
            }
            let bx = startX;
            rect.buttonRects = buttons.map((_, bi) => {
              const bw = finalWidths[bi];
              const br = { x: bx, y: y + 2, w: bw, h: h - 4 };
              bx += bw + btnGap;
              return br;
            });
          }
        } else if (item.type === "switch") {
          rect.switchRect = { x: controlX, y: y + 2, w: 28, h: h - 4 };
        } else if (item.type === "treeList") {
          rect.treeRect = { x: controlX, y, w: w - controlX - padding, h };
        } else if (item.type === "select") {
          const arrowW = 12;
          const arrowGap = 2;
          const nextX = w - padding - arrowW;
          const prevX = nextX - arrowGap - arrowW;
          rect.prevRect = { x: prevX, y: y + 2, w: arrowW, h: h - 4 };
          rect.nextRect = { x: nextX, y: y + 2, w: arrowW, h: h - 4 };
          rect.valueRect = { x: controlX, y, w: prevX - controlX - 2, h };
        }
        itemRects[item.id] = rect;
      });
    }
    this.layoutCache = { tabBarRect, contentY, itemRects };
  }
  _renderBackground() {
    const ctx = this.bgCanvas.getContext("2d");
    const s = this.scale;
    const w = this.logicalWidth * s;
    const h = this.logicalHeight * s;
    const {
      bg,
      fg,
      muted,
      mutedDark,
      separator,
      btnBg,
      tabBg,
      tabActiveBg,
      fontFamily,
      fontPx,
      tabHeight,
      padding
    } = this.theme;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    if (!this.menuState) return;
    ctx.fillStyle = tabBg;
    ctx.fillRect(0, 0, w, tabHeight * s);
    const tabs = this.menuState.tabs || [];
    if (tabs.length > 0) {
      const tabW = this.theme.tabFillWidth ? Math.floor((this.logicalWidth - padding * 2) / tabs.length) : tabHeight;
      tabs.forEach((tab, i) => {
        const tx = i * tabW * s;
        const ty = 0;
        const tw = tabW * s;
        const th = tabHeight * s;
        const isActive = tab.id === this.menuState.currentTabId;
        ctx.fillStyle = isActive ? tabActiveBg : tabBg;
        ctx.fillRect(tx, ty, tw, th);
        if (isActive) {
          ctx.fillStyle = fg;
          ctx.fillRect(tx, (tabHeight - 2) * s, tw, 2 * s);
        }
        ctx.fillStyle = "#000000";
        ctx.fillRect(tx - 1 * s, ty, 1 * s, th);
        if (i === tabs.length - 1) {
          ctx.fillRect(tx + tw, ty, 1 * s, th);
        }
        const atlas = this.iconAtlas;
        if (atlas && atlas.map[tab.id]) {
          const { char } = atlas.map[tab.id];
          ctx.save();
          ctx.font = `900 ${atlas.size}px ${atlas.fontFamily}`;
          ctx.fillStyle = isActive ? fg : muted;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(char, tx + tw / 2, ty + tabHeight * s / 2);
          ctx.restore();
        } else {
          ctx.fillStyle = isActive ? fg : muted;
          this._drawText(
            ctx,
            tab.label || tab.id,
            tx + tw / 2,
            ty + tabHeight * s / 2,
            fontPx * s,
            fontFamily,
            "center",
            "middle"
          );
        }
      });
    }
    const activeTab = this._getActiveTab();
    if (!activeTab || !this.layoutCache) return;
    const tabTitleLabel = activeTab.label || activeTab.id;
    if (tabTitleLabel) {
      const titleRowH = this.theme.rowHeight;
      const titleRowY = tabHeight;
      ctx.fillStyle = "#252525";
      ctx.fillRect(0, titleRowY * s, w, titleRowH * s);
      ctx.fillStyle = fg;
      this._drawText(
        ctx,
        tabTitleLabel,
        padding * s,
        (titleRowY + titleRowH / 2) * s,
        fontPx * s,
        fontFamily,
        "left",
        "middle"
      );
    }
    activeTab.items.forEach((item) => {
      var _a;
      if (item.type !== "folder") return;
      const collapsible = item.collapsible ?? ((_a = this.menuState) == null ? void 0 : _a.collapsibleFolders) ?? true;
      if (collapsible && item.collapsed) return;
      const childRects = activeTab.items.filter((c) => c.folderId === item.id).map((c) => this.layoutCache.itemRects[c.id]).filter(Boolean);
      if (!childRects.length) return;
      const top = Math.min(...childRects.map((r) => r.y));
      const bottom = Math.max(...childRects.map((r) => r.y + r.h));
      ctx.fillStyle = this.theme.folderContentBg;
      ctx.fillRect(padding * s, top * s, (this.logicalWidth - padding * 2) * s, (bottom - top) * s);
    });
    activeTab.items.forEach((item) => {
      var _a;
      const rect = this.layoutCache.itemRects[item.id];
      if (!rect) return;
      if (item.type === "separator") {
        ctx.fillStyle = separator;
        const lineY = rect.y + Math.floor(rect.h / 2);
        ctx.fillRect(padding * s, lineY * s, (this.logicalWidth - padding * 2) * s, 1 * s);
        return;
      }
      if (item.type === "folder") {
        const hr = rect.headerRect || rect;
        ctx.fillStyle = this.theme.folderHeaderBg;
        ctx.fillRect(hr.x * s, hr.y * s, hr.w * s, hr.h * s);
        const collapsible = item.collapsible ?? ((_a = this.menuState) == null ? void 0 : _a.collapsibleFolders) ?? true;
        let textX = padding * s;
        if (collapsible) {
          const cx = padding + 3;
          const cy = hr.y + hr.h / 2;
          const t = 3;
          ctx.fillStyle = fg;
          ctx.beginPath();
          if (item.collapsed) {
            ctx.moveTo((cx - t) * s, (cy - t) * s);
            ctx.lineTo((cx + t) * s, cy * s);
            ctx.lineTo((cx - t) * s, (cy + t) * s);
          } else {
            ctx.moveTo((cx - t) * s, (cy - t) * s);
            ctx.lineTo((cx + t) * s, (cy - t) * s);
            ctx.lineTo(cx * s, (cy + t) * s);
          }
          ctx.closePath();
          ctx.fill();
          textX = (padding + 2 * t + 4) * s;
        }
        ctx.fillStyle = fg;
        this._drawText(
          ctx,
          item.label || "",
          textX,
          (hr.y + hr.h / 2) * s,
          fontPx * s,
          fontFamily,
          "left",
          "middle"
        );
        return;
      }
      const rowLabelText = item.type === "button" ? item.rowLabel || "" : item.label || "";
      if (rowLabelText && rect.labelRect) {
        ctx.fillStyle = muted;
        this._drawText(
          ctx,
          rowLabelText,
          (rect.labelRect.x + rect.labelRect.w - padding) * s,
          (rect.y + rect.h / 2) * s,
          fontPx * s,
          fontFamily,
          "right",
          "middle"
        );
      }
      if (item.type === "slider" && rect.trackRect) {
        const tr = rect.trackRect;
        ctx.fillStyle = mutedDark;
        ctx.fillRect(tr.x * s, tr.y * s, tr.w * s, tr.h * s);
      }
      if (item.type === "button" && rect.buttonRects) {
        rect.buttonRects.forEach((br, bi) => {
          const btn = (item.buttons || [])[bi];
          ctx.fillStyle = btnBg;
          ctx.fillRect(br.x * s, br.y * s, br.w * s, br.h * s);
          ctx.fillStyle = muted;
          this._drawText(
            ctx,
            typeof btn === "object" ? btn.label || "" : String(btn || ""),
            (br.x + br.w / 2) * s,
            (br.y + br.h / 2) * s,
            fontPx * s,
            fontFamily,
            "center",
            "middle"
          );
        });
      }
      if (item.type === "switch" && rect.switchRect) {
        const sr = rect.switchRect;
        ctx.fillStyle = btnBg;
        ctx.fillRect(sr.x * s, sr.y * s, sr.w * s, sr.h * s);
      }
      if (item.type === "select") {
        for (const [arrow, label] of [
          [rect.prevRect, "<"],
          [rect.nextRect, ">"]
        ]) {
          if (!arrow) continue;
          ctx.fillStyle = btnBg;
          ctx.fillRect(arrow.x * s, arrow.y * s, arrow.w * s, arrow.h * s);
          ctx.fillStyle = muted;
          this._drawText(
            ctx,
            label,
            (arrow.x + arrow.w / 2) * s,
            (arrow.y + arrow.h / 2) * s,
            fontPx * s,
            fontFamily,
            "center",
            "middle"
          );
        }
      }
    });
  }
  _renderDynamicFull() {
    const ctx = this.dynCanvas.getContext("2d");
    const s = this.scale;
    ctx.clearRect(0, 0, this.logicalWidth * s, this.logicalHeight * s);
    const activeTab = this._getActiveTab();
    if (!activeTab || !this.layoutCache) return;
    activeTab.items.forEach((item) => {
      const rect = this.layoutCache.itemRects[item.id];
      if (!rect) return;
      this._renderItemDynamic(ctx, item, rect, s);
    });
  }
  _renderItemDynamic(ctx, item, rect, s) {
    const { fg, accent, accentDim, muted, mutedDark, fontFamily, fontPx, trackHeight } = this.theme;
    switch (item.type) {
      case "slider": {
        if (!rect.trackRect) break;
        const tr = rect.trackRect;
        const min = item.min ?? 0;
        const max = item.max ?? 1;
        const val = item.value ?? min;
        const ratio = max === min ? 0 : Math.max(0, Math.min(1, (val - min) / (max - min)));
        const knobX = tr.x + ratio * (tr.w - this.theme.knobWidth);
        ctx.fillStyle = accentDim;
        ctx.fillRect(tr.x * s, tr.y * s, (knobX - tr.x + this.theme.knobWidth / 2) * s, tr.h * s);
        ctx.fillStyle = accent;
        const knobY = rect.y + (rect.h - (trackHeight + 4)) / 2;
        ctx.fillRect(knobX * s, knobY * s, this.theme.knobWidth * s, (trackHeight + 4) * s);
        if (rect.valueRect) {
          const decimals = item.step && !Number.isInteger(item.step) ? 3 : item.step === 1 ? 0 : 3;
          const valStr = typeof val === "number" ? val.toFixed(decimals) : String(val);
          ctx.fillStyle = fg;
          this._drawText(
            ctx,
            valStr,
            (rect.valueRect.x + rect.valueRect.w) * s,
            (rect.y + rect.h / 2) * s,
            fontPx * s,
            fontFamily,
            "right",
            "middle"
          );
        }
        break;
      }
      case "select": {
        const valStr = String(item.value ?? "");
        if (rect.valueRect) {
          const vr = rect.valueRect;
          ctx.fillStyle = this.theme.btnBg;
          ctx.fillRect(vr.x * s, (vr.y + 2) * s, vr.w * s, (vr.h - 4) * s);
          ctx.fillStyle = accent;
          this._drawText(
            ctx,
            valStr,
            (vr.x + 4) * s,
            (rect.y + rect.h / 2) * s,
            fontPx * s,
            fontFamily,
            "left",
            "middle"
          );
        }
        break;
      }
      case "switch": {
        if (!rect.switchRect) break;
        const sr = rect.switchRect;
        const isOn = !!item.value;
        ctx.fillStyle = isOn ? accent : muted;
        ctx.fillRect(sr.x * s, sr.y * s, sr.w * s, sr.h * s);
        ctx.fillStyle = isOn ? "#000" : fg;
        this._drawText(
          ctx,
          isOn ? "ON" : "OFF",
          (sr.x + sr.w / 2) * s,
          (sr.y + sr.h / 2) * s,
          fontPx * s,
          fontFamily,
          "center",
          "middle"
        );
        break;
      }
      case "button": {
        if (!rect.buttonRects) break;
        rect.buttonRects.forEach((br, bi) => {
          const btn = (item.buttons || [])[bi];
          const isActive = btn && btn.active;
          if (isActive) {
            ctx.fillStyle = accent;
            ctx.fillRect(br.x * s, br.y * s, br.w * s, br.h * s);
            ctx.fillStyle = "#000";
            this._drawText(
              ctx,
              typeof btn === "object" ? btn.label || "" : String(btn || ""),
              (br.x + br.w / 2) * s,
              (br.y + br.h / 2) * s,
              fontPx * s,
              fontFamily,
              "center",
              "middle"
            );
          }
        });
        break;
      }
      case "treeList": {
        if (!rect.treeRect) break;
        const tr = rect.treeRect;
        const levels = item.levels || [];
        if (!levels.length) break;
        const treeLayout = this._computeTreeLevelLayout(levels, tr.w);
        treeLayout.forEach((levelLayout) => {
          levelLayout.rows.forEach((row) => {
            row.options.forEach((opt) => {
              const ox = tr.x + opt.x;
              const oy = tr.y + row.y;
              ctx.fillStyle = opt.active ? accent : mutedDark;
              ctx.fillRect(ox * s, oy * s, opt.w * s, row.h * s);
              ctx.fillStyle = opt.active ? "#000" : fg;
              this._drawText(
                ctx,
                opt.label,
                (ox + opt.w / 2) * s,
                (oy + row.h / 2) * s,
                (fontPx - 1) * s,
                fontFamily,
                "center",
                "middle"
              );
            });
          });
        });
        break;
      }
    }
  }
  // ─── Interaction / Hit Testing ────────────────────────────────────────────
  /**
   * Build an array of interactive areas for the current layout.
   * Each area: { type, tabId?, itemId?, rect, ...extra }
   * rect is in LOGICAL pixels (not scaled).
   */
  _getHitAreas() {
    if (!this.menuState || !this.layoutCache) return [];
    const { padding, tabHeight } = this.theme;
    const areas = [];
    const tabs = this.menuState.tabs || [];
    if (tabs.length > 0) {
      const tabW = this.theme.tabFillWidth ? Math.floor((this.logicalWidth - padding * 2) / tabs.length) : tabHeight;
      tabs.forEach((tab, i) => {
        areas.push({
          type: "tab",
          tabId: tab.id,
          rect: { x: i * tabW, y: 0, w: tabW, h: tabHeight }
        });
      });
    }
    const activeTab = this._getActiveTab();
    if (!activeTab) return areas;
    activeTab.items.forEach((item) => {
      var _a;
      const rect = this.layoutCache.itemRects[item.id];
      if (!rect) return;
      const base = { tabId: activeTab.id, itemId: item.id };
      switch (item.type) {
        case "slider":
          if (rect.trackRect) {
            areas.push({
              ...base,
              type: "slider-track",
              trackRect: rect.trackRect,
              item,
              rect: { x: rect.trackRect.x, y: rect.y, w: rect.trackRect.w, h: rect.h }
            });
          }
          break;
        case "select":
          if (rect.prevRect) areas.push({ ...base, type: "select-prev", rect: rect.prevRect });
          if (rect.nextRect) areas.push({ ...base, type: "select-next", rect: rect.nextRect });
          break;
        case "switch":
          areas.push({ ...base, type: "switch", rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } });
          break;
        case "folder": {
          const collapsible = item.collapsible ?? ((_a = this.menuState) == null ? void 0 : _a.collapsibleFolders) ?? true;
          if (collapsible) {
            const hr = rect.headerRect || rect;
            areas.push({ ...base, type: "folder-header", rect: { x: hr.x, y: hr.y, w: hr.w, h: hr.h } });
          }
          break;
        }
        case "button":
          if (rect.buttonRects) {
            rect.buttonRects.forEach((br, bi) => {
              const btn = (item.buttons || [])[bi];
              const label = typeof btn === "object" ? btn.label || "" : String(btn || "");
              areas.push({ ...base, type: "button", buttonIndex: bi, buttonLabel: label, rect: br });
            });
          }
          break;
        case "treeList":
          if (rect.treeRect && item.levels) {
            const tr = rect.treeRect;
            const treeLayout = this._computeTreeLevelLayout(item.levels, tr.w);
            treeLayout.forEach((levelLayout) => {
              let globalOptIdx = 0;
              levelLayout.rows.forEach((row) => {
                row.options.forEach((opt) => {
                  areas.push({
                    ...base,
                    type: "treeList-option",
                    levelIndex: levelLayout.levelIdx,
                    optionIndex: globalOptIdx,
                    optionLabel: opt.label,
                    item,
                    rect: { x: tr.x + opt.x, y: tr.y + row.y, w: opt.w, h: row.h }
                  });
                  globalOptIdx++;
                });
              });
            });
          }
          break;
      }
    });
    return areas;
  }
  /**
   * Hit test at logical coordinates. Returns the first matching area or null.
   * @param {number} lx - Logical x (0 … logicalWidth)
   * @param {number} ly - Logical y (0 … logicalHeight)
   */
  hitTest(lx, ly) {
    for (const area of this._getHitAreas()) {
      const r = area.rect;
      if (lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h) return area;
    }
    return null;
  }
  /**
   * Unified pointer event entry point for 3D / VR surfaces.
   *
   * In a VR or Three.js application, cast a ray from the controller or
   * camera, compute its intersection with the plane that holds this menu
   * as a texture, read the UV from the intersection result, and call this
   * method.  The UV must be in canvas space: (0,0) = top-left,
   * (1,1) = bottom-right.  Note that Three.js PlaneGeometry UV has V
   * increasing upward, so you need to flip it: v_canvas = 1 - v_three.
   *
   * @param {'down'|'move'|'up'} type  Pointer event phase.
   * @param {number} u  Normalized horizontal coordinate [0, 1].
   * @param {number} v  Normalized vertical coordinate   [0, 1].
   * @returns {object|null}  Hit area descriptor, or null if nothing was hit.
   */
  pointerEventUV(type, u, v) {
    switch (type) {
      case "down":
        return this.pointerDown(u, v);
      case "move":
        return this.pointerMove(u, v);
      case "up":
        return this.pointerUp(u, v);
      default:
        return null;
    }
  }
  /**
   * Call on mousedown / pointerdown.
   * u, v are normalized [0, 1] over the canvas CSS display area.
   * Returns the hit area, or null if nothing was hit.
   */
  pointerDown(u, v) {
    if (!this.menuState || !this.layoutCache) return null;
    if (this.focus) {
      this.focus = null;
      this._compose();
    }
    this._fireCommand({ type: "pointer-interaction" });
    const lx = u * this.logicalWidth;
    const ly = v * this.logicalHeight;
    const hit = this.hitTest(lx, ly);
    if (!hit) return null;
    if (hit.type === "slider-track") {
      this._dragState = { hit };
      this._applySliderDragAt(hit, lx);
    } else {
      this._fireCommand(this._hitToCommand(hit));
    }
    return hit;
  }
  /**
   * Call on mousemove / pointermove. Only relevant during a slider drag.
   * u, v are normalized [0, 1].
   */
  pointerMove(u, v) {
    if (!this._dragState) return null;
    const lx = u * this.logicalWidth;
    if (this._dragState.hit.type === "slider-track") {
      this._applySliderDragAt(this._dragState.hit, lx);
    }
    return this._dragState.hit;
  }
  /**
   * Call on mouseup / pointerup. Finalises an in-progress drag.
   * u, v are normalized [0, 1].
   */
  pointerUp(u, v) {
    if (!this._dragState) return null;
    const { hit } = this._dragState;
    this._dragState = null;
    if (hit.type === "slider-track") {
      const lx = u * this.logicalWidth;
      const rawValue = this._sliderRawFromX(hit, lx);
      this._fireCommand({ type: "set-slider-raw", tabId: hit.tabId, itemId: hit.itemId, payload: { rawValue } });
    }
    return hit;
  }
  // ── Private interaction helpers ───────────────────────────────────────────
  /** Convert an x logical coordinate to a raw slider value within [min, max]. */
  _sliderRawFromX(hit, lx) {
    const tr = hit.trackRect;
    const ratio = Math.max(0, Math.min(1, (lx - tr.x) / tr.w));
    const { min = 0, max = 1 } = hit.item;
    return min + ratio * (max - min);
  }
  /** Update the slider's local value for immediate live feedback during drag. */
  _applySliderDragAt(hit, lx) {
    const rawValue = this._sliderRawFromX(hit, lx);
    const activeTab = this._getActiveTab();
    if (!activeTab) return;
    const item = activeTab.items.find((i) => i.id === hit.itemId);
    if (item) {
      item.value = rawValue;
      this.renderItemDynamic(hit.itemId);
    }
    this._fireCommand({
      type: "set-slider-raw",
      tabId: hit.tabId,
      itemId: hit.itemId,
      payload: { rawValue, commit: false }
    });
  }
  /** Build a logical command from a hit area. */
  _hitToCommand(hit) {
    var _a, _b;
    switch (hit.type) {
      case "tab":
        return { type: "set-tab", tabId: hit.tabId };
      case "select-prev":
        return { type: "cycle", tabId: hit.tabId, itemId: hit.itemId, payload: { direction: "prev" } };
      case "select-next":
        return { type: "cycle", tabId: hit.tabId, itemId: hit.itemId, payload: { direction: "next" } };
      case "switch":
        return { type: "toggle", tabId: hit.tabId, itemId: hit.itemId };
      case "folder-header":
        return { type: "toggle-folder", tabId: hit.tabId, itemId: hit.itemId };
      case "button":
        return {
          type: "activate",
          tabId: hit.tabId,
          itemId: hit.itemId,
          payload: { buttonIndex: hit.buttonIndex, buttonLabel: hit.buttonLabel }
        };
      case "treeList-option": {
        const currentPath = Array.isArray((_a = hit.item) == null ? void 0 : _a.value) ? hit.item.value : [];
        const newPath = completeTreePath((_b = hit.item) == null ? void 0 : _b.tree, [
          ...currentPath.slice(0, hit.levelIndex),
          hit.optionLabel
        ]);
        return { type: "set-value", tabId: hit.tabId, itemId: hit.itemId, payload: { value: newPath } };
      }
      default:
        return null;
    }
  }
  /** Emit a command to the onCommand callback if set. */
  _fireCommand(cmd) {
    if (cmd && this.onCommand) this.onCommand(cmd);
  }
  _compose() {
    var _a;
    const ctx = this.canvas.getContext("2d");
    const w = this.logicalWidth * this.scale;
    const h = this.logicalHeight * this.scale;
    ctx.clearRect(0, 0, w, h);
    if (this.viewMode === "bg") {
      ctx.drawImage(this.bgCanvas, 0, 0);
    } else if (this.viewMode === "dyn") {
      ctx.fillStyle = this.theme.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this.dynCanvas, 0, 0);
    } else {
      ctx.drawImage(this.bgCanvas, 0, 0);
      ctx.drawImage(this.dynCanvas, 0, 0);
    }
    if (this.viewMode !== "bg") this._renderFocusOverlay(ctx, this.scale);
    (_a = this.onRender) == null ? void 0 : _a.call(this);
  }
  /**
   * Draw the focus navigation cursor (a stroked rectangle) over the active tab
   * or the complete focused-control row. Reuses the existing layout cache,
   * so a focus move only needs a recompose — no layout recompute.
   * @param {CanvasRenderingContext2D} ctx - The output canvas context.
   * @param {number} s - Device pixel scale.
   */
  _renderFocusOverlay(ctx, s) {
    const focus = this.focus;
    if (!focus || !this.layoutCache) return;
    const lw = Math.max(1, Math.round((this.theme.focusLineWidth || 1.5) * s));
    ctx.save();
    ctx.strokeStyle = this.theme.focus;
    ctx.lineWidth = lw;
    const stroke = (r) => {
      if (!r) return;
      const inset = lw / 2;
      ctx.strokeRect(r.x * s + inset, r.y * s + inset, Math.max(0, r.w * s - lw), Math.max(0, r.h * s - lw));
    };
    const strokeInnerSeparator = (r) => {
      if (!r) return;
      const innerLw = Math.max(1, Math.round(s));
      const inset = lw + innerLw / 2;
      ctx.save();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = innerLw;
      ctx.strokeRect(
        r.x * s + inset,
        r.y * s + inset,
        Math.max(0, r.w * s - inset * 2),
        Math.max(0, r.h * s - inset * 2)
      );
      ctx.restore();
    };
    if (focus.area === "tabs") {
      stroke({ x: 0, y: 0, w: this.logicalWidth, h: this.theme.tabHeight });
      ctx.restore();
      return;
    }
    const rect = this.layoutCache.itemRects[focus.itemId];
    if (!rect) {
      ctx.restore();
      return;
    }
    stroke({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    const activeTab = this._getActiveTab();
    const item = activeTab == null ? void 0 : activeTab.items.find((it) => it.id === focus.itemId);
    if ((item == null ? void 0 : item.type) === "button" && rect.buttonRects && focus.subIndex != null) {
      stroke(rect.buttonRects[focus.subIndex]);
    } else if ((item == null ? void 0 : item.type) === "treeList" && rect.treeRect && item.levels && Array.isArray(focus.treePath)) {
      const levelIndex = focus.treeLevel ?? 0;
      const label = focus.treePath[levelIndex];
      const levelLayout = this._computeTreeLevelLayout(item.levels, rect.treeRect.w)[levelIndex];
      if (levelLayout) {
        levelLayout.rows.forEach((row) => {
          row.options.forEach((opt) => {
            if (opt.label === label) {
              const optionRect = {
                x: rect.treeRect.x + opt.x,
                y: rect.treeRect.y + row.y,
                w: opt.w,
                h: row.h
              };
              stroke(optionRect);
              strokeInnerSeparator(optionRect);
            }
          });
        });
      }
    }
    ctx.restore();
  }
  _applyControlPatch(evt) {
    if (!this.menuState) return;
    const activeTab = this._getActiveTab();
    if (!activeTab || activeTab.id !== evt.tabId) return;
    const item = activeTab.items.find((i) => i.id === evt.itemId);
    if (!item) return;
    if (evt.statePatch) {
      Object.assign(item, evt.statePatch);
    }
    if (item.type === "treeList" && item.tree) {
      item.levels = this._buildTreeLevels(item.tree, item.value ?? []);
      if (this._userLogicalWidth === null || this._userLogicalHeight === null) {
        const [w, h] = this._computeAutoSize(this.menuState);
        let sizeChanged = false;
        if (this._userLogicalWidth === null && w !== this.logicalWidth) {
          this.logicalWidth = w;
          sizeChanged = true;
        }
        if (this._userLogicalHeight === null && h !== this.logicalHeight) {
          this.logicalHeight = h;
          sizeChanged = true;
        }
        if (sizeChanged) this._initCanvases();
      }
      this._computeLayout();
      this.renderFull();
      return;
    }
    this.renderItemDynamic(evt.itemId);
  }
  /**
   * Resolve a FontAwesome class name (e.g. 'fa-sitemap') to its Unicode glyph
   * character by reading the CSS ::before content of a temporary DOM element.
   * Requires FontAwesome CSS to be loaded by the page.
   * @param {string} iconClass  e.g. 'fa-sitemap'
   * @returns {string|null}  The glyph character, or null if not found.
   */
  _resolveFAChar(iconClass) {
    const el = document.createElement("i");
    el.className = `fas ${iconClass}`;
    Object.assign(el.style, { position: "absolute", visibility: "hidden", top: "-9999px" });
    document.body.appendChild(el);
    const computed = window.getComputedStyle(el);
    const raw = window.getComputedStyle(el, "::before").content;
    const faVar = computed.getPropertyValue("--fa").trim();
    document.body.removeChild(el);
    console.log("[CanvasRenderer] _resolveFAChar", iconClass, "| raw:", raw, "| --fa:", JSON.stringify(faVar));
    if (raw && raw !== "none") {
      const contentPart = raw.split("/")[0].trim();
      if (contentPart.length >= 3) {
        const char = contentPart.slice(1, -1);
        if (char) return char;
      }
    }
    if (faVar) {
      const inner = faVar.startsWith('"') ? faVar.slice(1, faVar.lastIndexOf('"')) : faVar;
      if (inner) {
        const char = inner.replace(
          /\\([0-9a-fA-F]{1,6})\s?/g,
          (_, hex) => String.fromCodePoint(parseInt(hex, 16))
        );
        if (char) return char;
      }
    }
    return null;
  }
  /**
   * Build a bitmap icon atlas from FontAwesome glyphs for all tabs that have an icon.
   * Renders white icons on a transparent background (one row, N columns).
   * Stores result in this.iconAtlas and triggers a full re-render when done.
   * @param {Array} tabs  Tab objects from the menu state, each with { id, icon? }
   */
  async _buildIconAtlas(tabs) {
    const iconSizePx = Math.round(this.theme.tabHeight * this.scale * 0.65);
    const probeEl = document.createElement("i");
    probeEl.className = "fas";
    Object.assign(probeEl.style, { position: "absolute", visibility: "hidden", top: "-9999px" });
    document.body.appendChild(probeEl);
    const faFontFamily = window.getComputedStyle(probeEl).fontFamily || '"Font Awesome 5 Free"';
    document.body.removeChild(probeEl);
    const FA_FONT = `900 ${iconSizePx}px ${faFontFamily}`;
    console.log("[CanvasRenderer] _buildIconAtlas | FA_FONT:", FA_FONT);
    const entries = [];
    for (const tab of tabs) {
      if (!tab.icon) continue;
      const isRawChar = (tab.icon.codePointAt(0) ?? 0) > 127;
      const char = isRawChar ? tab.icon : this._resolveFAChar(tab.icon);
      console.log(
        "[CanvasRenderer] icon:",
        tab.icon,
        "| char:",
        char,
        "| codePoint:",
        char ? char.codePointAt(0).toString(16) : "null"
      );
      if (char) entries.push({ tabId: tab.id, char });
    }
    console.log("[CanvasRenderer] entries resolved:", entries.length, "/", tabs.filter((t) => t.icon).length);
    if (!entries.length) return;
    const loadedFonts = await document.fonts.load(FA_FONT);
    console.log(
      "[CanvasRenderer] document.fonts.load resolved | loaded:",
      loadedFonts.length,
      loadedFonts.map((f) => `${f.family} w${f.weight}`)
    );
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = iconSizePx * entries.length;
    atlasCanvas.height = iconSizePx;
    const ctx = atlasCanvas.getContext("2d");
    ctx.font = FA_FONT;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const map = {};
    entries.forEach(({ tabId, char }, i) => {
      const x = i * iconSizePx;
      ctx.fillText(char, x + iconSizePx / 2, iconSizePx / 2);
      map[tabId] = { x, y: 0, w: iconSizePx, h: iconSizePx, char };
    });
    this.iconAtlas = { canvas: atlasCanvas, map, size: iconSizePx, fontFamily: faFontFamily };
    this.renderFull();
  }
  /**
   * Compute per-level layout for a treeList with variable-width options and
   * greedy row packing.
   *
   * Each option's natural width is estimated from its label length.
   * Options are greedily packed into rows; if an option doesn't fit it starts
   * a new row. Widths within a row are then stretched proportionally to fill
   * the full treeW.
   *
   * Returns array of:
   *   { levelIdx, rows: [{ options: [{label, active, x, w}], y, h }], totalH }
   * where x/y are relative to the top-left of the treeRect.
   */
  _computeTreeLevelLayout(levels, treeW) {
    const { treeOptMinW, treeLevelGap, treeRowGap, treeRowH, fontPx } = this.theme;
    const hPad = 6;
    const charW = fontPx * 0.65;
    const btnGap = 1;
    const result = [];
    let curY = 0;
    levels.forEach((level, li) => {
      const opts = level.options || [];
      const natWidths = opts.map((opt) => Math.max(treeOptMinW, Math.ceil(opt.label.length * charW) + hPad * 2));
      const rawRows = [];
      let cur = { indices: [], usedW: 0 };
      opts.forEach((_, oi) => {
        const w = natWidths[oi];
        const extra = cur.indices.length > 0 ? btnGap : 0;
        if (cur.indices.length > 0 && cur.usedW + extra + w > treeW) {
          rawRows.push(cur);
          cur = { indices: [], usedW: 0 };
        }
        cur.indices.push(oi);
        cur.usedW += (cur.indices.length > 1 ? btnGap : 0) + w;
      });
      if (cur.indices.length > 0) rawRows.push(cur);
      const rows = [];
      rawRows.forEach((rawRow) => {
        if (rows.length > 0) curY += treeRowGap;
        const n = rawRow.indices.length;
        const gaps = (n - 1) * btnGap;
        const available = treeW - gaps;
        const equalW = Math.floor(available / n);
        const minWidths = rawRow.indices.map((oi) => natWidths[oi]);
        const allFitEqual = minWidths.every((mw) => mw <= equalW);
        let finalWidths;
        if (allFitEqual) {
          finalWidths = rawRow.indices.map(
            (_, ri) => ri === n - 1 ? treeW - (equalW + btnGap) * (n - 1) : equalW
          );
        } else {
          const totalNat = minWidths.reduce((s, mw) => s + mw, 0);
          finalWidths = rawRow.indices.map(
            (oi) => Math.max(natWidths[oi], Math.round(natWidths[oi] / totalNat * available))
          );
          const sumExceptLast = finalWidths.slice(0, -1).reduce((s, w) => s + w, 0) + gaps;
          finalWidths[n - 1] = Math.max(natWidths[rawRow.indices[n - 1]], treeW - sumExceptLast);
        }
        let x = 0;
        const rowOpts = rawRow.indices.map((oi, ri) => {
          const w = finalWidths[ri];
          const entry = { label: opts[oi].label, active: opts[oi].active, x, w };
          x += w + btnGap;
          return entry;
        });
        rows.push({ options: rowOpts, y: curY, h: treeRowH });
        curY += treeRowH;
      });
      const totalH = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].h : 0;
      result.push({ levelIdx: li, rows, totalH });
      if (li < levels.length - 1) curY += treeLevelGap;
    });
    return result;
  }
  _buildTreeLevels(tree, path) {
    const levels = [];
    let current = tree;
    let levelIdx = 0;
    while (current !== void 0) {
      if (Array.isArray(current)) {
        levels.push({
          level: levelIdx,
          options: current.map((opt) => ({ label: String(opt), active: opt === path[levelIdx] }))
        });
        break;
      } else if (current && typeof current === "object") {
        const keys = Object.keys(current);
        levels.push({
          level: levelIdx,
          options: keys.map((k) => ({ label: k, active: k === path[levelIdx] }))
        });
        const nextKey = path[levelIdx];
        current = nextKey !== void 0 ? current[nextKey] : void 0;
        levelIdx++;
      } else {
        break;
      }
    }
    return levels;
  }
  _getActiveTab() {
    if (!this.menuState) return null;
    return (this.menuState.tabs || []).find((t) => t.id === this.menuState.currentTabId) ?? null;
  }
  /**
   * Returns the items of a tab that should actually be laid out / drawn, in
   * display order, skipping the children of collapsed folders. Each entry is
   * `{ item, depth }` where depth>0 means the item is inside a folder (indented).
   * The snapshot already orders items as: folder header followed by its children.
   * @param {object} tab - A tab snapshot.
   * @returns {Array<{item: object, depth: number}>}
   */
  _getVisibleItems(tab) {
    var _a;
    if (!tab || !tab.items) return [];
    const globalCollapsible = ((_a = this.menuState) == null ? void 0 : _a.collapsibleFolders) ?? true;
    const collapsedFolders = /* @__PURE__ */ new Set();
    for (const it of tab.items) {
      if (it.type === "folder") {
        const collapsible = it.collapsible ?? globalCollapsible;
        if (collapsible && it.collapsed) collapsedFolders.add(it.id);
      }
    }
    const out = [];
    for (const it of tab.items) {
      if (it.folderId && collapsedFolders.has(it.folderId)) continue;
      out.push({ item: it, depth: it.folderId ? 1 : 0 });
    }
    return out;
  }
  /**
   * Returns the laid-out height (logical px) of a single item, shared by
   * `_computeLayout` and `_computeAutoSize` so both stay in sync.
   * @param {object} item
   * @param {number} w - Logical width to size width-dependent items (treeList) against.
   */
  _measureItemHeight(item, w) {
    const { rowHeight } = this.theme;
    if (item.type === "treeList") {
      const levels = item.levels || [];
      if (levels.length === 0) return rowHeight;
      const treeW = w - (this.theme.padding + this.theme.labelWidth) - this.theme.padding;
      const layout = this._computeTreeLevelLayout(levels, treeW);
      const last = layout[layout.length - 1];
      const lastRow = last.rows[last.rows.length - 1];
      return lastRow.y + lastRow.h + 2;
    }
    if (item.type === "separator") return this.theme.separatorHeight;
    return rowHeight;
  }
  /**
   * Draw text using canvas 2D text API.
   * Future: replace this with bitmap atlas rendering.
   */
  _drawText(ctx, text, x, y, sizePx, family, align = "left", baseline = "alphabetic") {
    ctx.font = `${sizePx}px ${family}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(String(text), x, y);
  }
}
/**
 * Protocol/contract version this CanvasRenderer build speaks. Compared against
 * the `version` stamped on every DynamicMenu snapshot/event. See `protocol.js`.
 * @type {string}
 */
__publicField(CanvasRenderer, "PROTOCOL_VERSION", PROTOCOL_VERSION);
if (typeof window !== "undefined") {
  window.CanvasRenderer = CanvasRenderer;
}
export {
  CanvasRenderer
};
//# sourceMappingURL=dynamicMenu_CanvasRenderer.js.map
