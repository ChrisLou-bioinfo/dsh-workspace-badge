// ── dsh-workspace-badge · Client half ───────────────────────────────────────
// 侧边栏会话列表「单列 / 最新在上」（groupBy=flat, orderBy=updated）模式下，
// 在每行会话标题旁注入所属工作区（项目文件夹）标签。
//
// 实现方式（DOM patch，与官方生态插件的 nav-icon 补丁同族）：
//   * 锚点是官方渲染的 data-row-key="session:<id>"（0.2.0-rc.2 起每行都有，
//     flat 与分组模式一致），不按标题文本猜测；
//   * 工作区名取自 ctx.sessions.list 快照 byId[id].cwd 的 basename；
//   * flat 模式判定读 localStorage 的 dsh.workspace.view.v5（官方视图 store 的
//     持久化键）；分组模式下行上已有工作区分组头，badge 自动移除；
//   * MutationObserver + microtask 合帧；sessions 快照订阅处理 cwd 变化。
//
// 宿主 DOM 结构若变化，badge 静默失效，不影响列表本身。
// 官方槽位兜底：sidebar.session.row.hover 注册悬停卡片，显示完整工作区路径。
window.__ModuleLoader__.load({
	id: "dsh-workspace-badge",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;

		const VIEW_STORE_KEY = "dsh.workspace.view.v5";
		const ROW_SELECTOR = '[data-row-key^="session:"]';
		const BADGE_ATTR = "data-wb-badge";
		const STYLE_ID = "wb-workspace-badge-style";

		const BADGE_CSS = [
			"[" + BADGE_ATTR + "] {",
			"  flex: none;",
			"  max-width: 42%;",
			"  padding: 0 6px;",
			"  margin-right: 4px;",
			"  border-radius: 6px;",
			"  font-size: 11px;",
			"  line-height: 18px;",
			"  color: var(--dsw-alias-label-secondary, rgba(0,0,0,.55));",
			"  background: var(--dsw-alias-fill-light, rgba(0,0,0,.06));",
			"  white-space: nowrap;",
			"  overflow: hidden;",
			"  text-overflow: ellipsis;",
			"  pointer-events: none;",
			"  align-self: center;",
			"}",
		].join("\n");

		function isFlatMode() {
			try {
				const raw = localStorage.getItem(VIEW_STORE_KEY);
				if (!raw) return false;
				return JSON.parse(raw).groupBy === "flat";
			} catch {
				return false;
			}
		}

		function basename(cwd) {
			if (typeof cwd !== "string" || cwd.length === 0) return null;
			const parts = cwd.split("/").filter(Boolean);
			return parts.length > 0 ? parts[parts.length - 1] : null;
		}

		function applyBadge(ctx) {
			if (typeof document === "undefined" || !document.body) return () => {};

			const tag = document.createElement("style");
			tag.id = STYLE_ID;
			tag.textContent = BADGE_CSS;
			document.head.appendChild(tag);

			let disposed = false;
			let scheduled = false;

			function labelOf(id) {
				try {
					const summary = ctx.sessions?.list?.getSnapshot?.().byId?.[id];
					return summary ? basename(summary.cwd) : null;
				} catch {
					return null;
				}
			}

			function removeBadge(row) {
				const badge = row.querySelector(":scope > [" + BADGE_ATTR + "]");
				if (badge) badge.remove();
			}

			function setBadge(row, label) {
				// 搜索结果行已自带工作区名（searchResultWorkspace），不重复注入。
				if (row.querySelector('[class*="searchResultWorkspace"]')) return;
				let badge = row.querySelector(":scope > [" + BADGE_ATTR + "]");
				if (badge) {
					if (badge.textContent !== label) badge.textContent = label;
					return;
				}
				badge = document.createElement("span");
				badge.setAttribute(BADGE_ATTR, "");
				badge.textContent = label;
				// 行结构（0.2.0-rc.2）：[slot, title, time, ...]，插在标题后、时间前。
				const titleEl = row.children[1];
				if (titleEl) titleEl.after(badge);
				else row.appendChild(badge);
			}

			function sync() {
				scheduled = false;
				if (disposed) return;
				const flat = isFlatMode();
				const rows = document.querySelectorAll(ROW_SELECTOR);
				for (const row of rows) {
					const key = row.getAttribute("data-row-key") || "";
					const id = key.slice("session:".length);
					if (!flat) {
						removeBadge(row);
						continue;
					}
					const label = labelOf(id);
					if (label) setBadge(row, label);
					else removeBadge(row);
				}
			}

			function schedule() {
				if (scheduled || disposed) return;
				scheduled = true;
				(typeof queueMicrotask === "function" ? queueMicrotask : (f) => setTimeout(f, 0))(sync);
			}

			sync();
			let observer = null;
			try {
				observer = new MutationObserver(schedule);
				observer.observe(document.body, { childList: true, subtree: true });
			} catch {}
			// cwd 更新（会话移动工作区 / 元信息补齐）后刷新对应 badge。
			let unsubscribe = null;
			try {
				unsubscribe = ctx.sessions?.list?.subscribe?.(schedule) ?? null;
			} catch {}

			return () => {
				disposed = true;
				try { observer && observer.disconnect(); } catch {}
				try { unsubscribe && unsubscribe(); } catch {}
				try {
					for (const badge of document.querySelectorAll("[" + BADGE_ATTR + "]")) badge.remove();
				} catch {}
				try { tag.remove(); } catch {}
			};
		}

		// 官方槽位兜底：悬停卡片里显示完整工作区路径（DOM patch 失效时仍有据可查）。
		function HoverWorkspace(props) {
			let cwd = null;
			try {
				cwd = (hoverSessions && hoverSessions.list.getSnapshot().byId?.[props.sessionId]?.cwd) ?? null;
			} catch {}
			if (!cwd) return null;
			return h("div", {
				style: {
					fontSize: "12px",
					opacity: 0.65,
					wordBreak: "break-all",
				},
			}, cwd);
		}

		let hoverSessions = null;

		function apply(ctx) {
			hoverSessions = ctx.sessions;
			if (ctx.effect) ctx.effect(() => applyBadge(ctx), "dsh-workspace-badge: session row badge");
			else applyBadge(ctx);
			try {
				ctx.slots?.inject?.("sidebar.session.row.hover", () => ctx.slots.register({
					name: "sidebar.session.row.hover",
					id: "workspace-badge-hover",
					order: 50,
				}, HoverWorkspace));
			} catch (error) {
				console.error("[dsh-workspace-badge] failed to register hover slot", error);
			}
		}

		exports.apply = apply;
		exports.inject = ["slots", "sessions"];
		return module.exports;
	},
});
