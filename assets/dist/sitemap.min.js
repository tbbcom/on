(function () {
  "use strict";

  // Merge defaults with window.SitemapConfig
  const CFG = Object.assign({
    labelsWanted: [],
    showAllButton: true,
    perPage: 24,
    pagination: "numbers", // "numbers" | "load-more"
    labelNavLimit: 20,
    excerptLength: 160,
    thumbWidth: 480,
    fallbackThumb: "",
    dateLocale: "ms-MY",
    cacheTTL: 10 * 60 * 1000, // 10 min
    autoLoadMore: true,
    urlParamLabel: "label",
    urlParamPage: "page"
  }, window.SitemapConfig || {});

  // Basic i18n
  const I18N = {
    allPosts: "Semua Post",
    readMore: "Read More",
    noPosts: "Tiada pos ditemui.",
    error: "Ralat memuatkan data.",
    loading: "Loading...",
    loadMore: "Load More"
  };

  // DOM
  const navWrap = document.getElementById("recentpostnavfeed");
  const listWrap = document.getElementById("recentpostsae");
  if (!navWrap || !listWrap) return;

  // Internal state
  const state = {
    label: null,
    page: 1,
    totalResults: 0,
    totalPages: 0,
    initialized: false,
    loading: false
  };

  // Simple in-memory + sessionStorage cache
  const memCache = new Map();
  function cacheKey(label, page, perPage) {
    return `sitemap:${label || "_all"}:p${page}:pp${perPage}`;
  }
  function readCache(label, page) {
    const key = cacheKey(label, page, CFG.perPage);
    if (memCache.has(key)) return memCache.get(key);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.t > CFG.cacheTTL) {
        sessionStorage.removeItem(key);
        return null;
      }
      memCache.set(key, data);
      return data;
    } catch {
      return null;
    }
  }
  function writeCache(label, page, payload) {
    const key = cacheKey(label, page, CFG.perPage);
    const data = { t: Date.now(), payload };
    memCache.set(key, data);
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
  }

  // Util
  const ORIGIN = location.origin;
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || d.innerText || "").trim();
  }
  function truncate(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
  }
  function parseQuery() {
    const sp = new URLSearchParams(location.search);
    const label = sp.get(CFG.urlParamLabel);
    const page = parseInt(sp.get(CFG.urlParamPage) || "1", 10);
    return { label: label || null, page: Math.max(1, page || 1) };
  }
  function setQuery(label, page, replace = false) {
    const u = new URL(location.href);
    if (label) u.searchParams.set(CFG.urlParamLabel, label);
    else u.searchParams.delete(CFG.urlParamLabel);
    if (page > 1) u.searchParams.set(CFG.urlParamPage, String(page));
    else u.searchParams.delete(CFG.urlParamPage);
    if (replace) history.replaceState(null, "", u);
    else history.pushState(null, "", u);
  }
  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat(CFG.dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
    } catch {
      return iso ? iso.slice(0, 10) : "";
    }
  }

  // Build feed URL for given label + page
  function buildFeedUrl(label, page, perPage) {
    const startIdx = (page - 1) * perPage + 1;
    const path = "/feeds/posts/summary" + (label ? "/-/" + encodeURIComponent(label) : "");
    const u = new URL(ORIGIN + path);
    u.searchParams.set("alt", "json");
    u.searchParams.set("max-results", String(perPage));
    u.searchParams.set("start-index", String(startIdx));
    return u.toString();
  }

  // Image helpers
  function upgradeBloggerImg(url, width) {
    if (!url) return url;
    const h = Math.round(width * 9 / 16);
    // Common Blogger segments: /s72-c/ or /s1600/ -> replace with sized segment
    return url.replace(/\/s\d+(-[a-z-]+)?\//, `/w${width}-h${h}-p-k-no-nu/`);
  }
  function extractYouTubeId(html) {
    if (!html) return null;
    const m1 = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (m1) return m1[1];
    const m2 = html.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];
    const m3 = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (m3) return m3[1];
    return null;
  }
  function getThumb(entry) {
    const width = CFG.thumbWidth || 480;
    const ytid = extractYouTubeId(entry.content?.$t || entry.summary?.$t || "");
    if (ytid) {
      // Prefer high quality if available
      return {
        src: `https://i.ytimg.com/vi/${ytid}/hqdefault.jpg`,
        srcset: `https://i.ytimg.com/vi/${ytid}/hqdefault.jpg 1x, https://i.ytimg.com/vi/${ytid}/hq720.jpg 2x`,
        kind: "youtube"
      };
    }
    const media = entry["media$thumbnail"]?.url;
    if (media) {
      const tuned = upgradeBloggerImg(media, width);
      return { src: tuned, srcset: `${tuned} 1x`, kind: "media" };
    }
    // Grab first <img> from content if present
    const raw = entry.content?.$t || entry.summary?.$t || "";
    const img = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (img && img[1]) {
      const u = img[1].startsWith("http") ? img[1] : (new URL(img[1], ORIGIN)).toString();
      const tuned = u.includes("blogger.googleusercontent.com") ? upgradeBloggerImg(u, width) : u;
      return { src: tuned, srcset: `${tuned} 1x`, kind: "inline" };
    }
    return { src: CFG.fallbackThumb || "", srcset: "", kind: "fallback" };
  }

  // Fetch feed page
  async function fetchPage(label, page) {
    const cached = readCache(label, page);
    if (cached?.payload) return cached.payload;

    const url = buildFeedUrl(label, page, CFG.perPage);
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const feed = json?.feed;
    const total = parseInt(feed?.["openSearch$totalResults"]?.$t || "0", 10);
    const entries = (feed?.entry || []).map(e => {
      const title = e.title?.$t || "Tanpa tajuk";
      const link = (e.link || []).find(l => l.rel === "alternate")?.href || "#";
      const published = e.published?.$t || "";
      const categories = (e.category || []).map(c => c.term).filter(Boolean);
      const summary = e.summary?.$t || e.content?.$t || "";
      const excerpt = truncate(stripHtml(summary), CFG.excerptLength);
      const thumb = getThumb(e);
      return { title, link, published, categories, excerpt, thumb };
    });

    const payload = { total, entries };
    writeCache(label, page, payload);
    return payload;
  }

  // Collect top labels when labelsWanted is empty
  async function getTopLabels(limit) {
    if ((CFG.labelsWanted || []).length) return CFG.labelsWanted.slice(0, limit);
    const counts = new Map();
    let startIndex = 1;
    const step = 150;
    const maxScan = Math.max(limit * 15, 450); // heuristic
    let scanned = 0;
    while (scanned < maxScan) {
      const u = new URL(ORIGIN + "/feeds/posts/summary");
      u.searchParams.set("alt", "json");
      u.searchParams.set("max-results", String(step));
      u.searchParams.set("start-index", String(startIndex));
      const r = await fetch(u.toString(), { credentials: "same-origin" });
      if (!r.ok) break;
      const j = await r.json();
      const entries = j?.feed?.entry || [];
      if (!entries.length) break;
      for (const e of entries) {
        const cats = (e.category || []).map(c => c.term).filter(Boolean);
        for (const c of cats) counts.set(c, (counts.get(c) || 0) + 1);
      }
      scanned += entries.length;
      startIndex += step;
      if (entries.length < step) break;
      if (counts.size >= limit * 3 && scanned >= limit * 10) break;
    }
    const sorted = Array.from(counts.entries()).sort((a,b) => b[1] - a[1]).map(x => x[0]);
    return sorted.slice(0, limit);
  }

  // Renderers
  function showSpinner() {
    listWrap.innerHTML = `<div class="spinner" role="status" aria-label="${I18N.loading}"></div>`;
  }
  function showError(msg) {
    listWrap.innerHTML = `<div class="error" role="alert">${esc(msg || I18N.error)}</div>`;
  }
  function showEmpty() {
    listWrap.innerHTML = `<div class="empty">${esc(I18N.noPosts)}</div>`;
  }

  function renderNav(labels) {
    const nav = document.createElement("div");
    nav.className = "label-nav";

    if (CFG.showAllButton) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "label-btn";
      btn.textContent = I18N.allPosts;
      btn.dataset.label = "";
      if (!state.label) btn.classList.add("active");
      btn.setAttribute("aria-pressed", String(!state.label));
      nav.appendChild(btn);
    }

    labels.forEach(lab => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "label-btn";
      btn.textContent = lab;
      btn.dataset.label = lab;
      if (state.label === lab) btn.classList.add("active");
      btn.setAttribute("aria-pressed", String(state.label === lab));
      nav.appendChild(btn);
    });

    nav.addEventListener("click", (e) => {
      const target = e.target.closest(".label-btn");
      if (!target) return;
      const newLabel = target.dataset.label || null;
      if (state.label === newLabel) return;
      state.label = newLabel;
      state.page = 1;
      setQuery(state.label, state.page);
      updateNavActive();
      loadAndRender({ replaceList: true });
    });

    navWrap.innerHTML = "";
    navWrap.appendChild(nav);
  }

  function updateNavActive() {
    const btns = navWrap.querySelectorAll(".label-btn");
    btns.forEach(b => {
      const match = (b.dataset.label || "") === (state.label || "");
      b.classList.toggle("active", match);
      b.setAttribute("aria-pressed", String(match));
    });
  }

  function articleCard(item) {
    const article = document.createElement("article");
    article.className = "card";

    const aThumb = document.createElement("a");
    aThumb.className = "thumb";
    aThumb.href = item.link;
    aThumb.rel = "bookmark";
    aThumb.ariaLabel = item.title;
    if (item.thumb?.src) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = item.thumb.src;
      if (item.thumb.srcset) img.srcset = item.thumb.srcset;
      img.alt = item.title;
      aThumb.appendChild(img);
    }
    article.appendChild(aThumb);

    const content = document.createElement("div");
    content.className = "content";

    const h = document.createElement("h3");
    h.className = "title";
    const a = document.createElement("a");
    a.href = item.link;
    a.rel = "bookmark";
    a.textContent = item.title;
    h.appendChild(a);

    const excerpt = document.createElement("p");
    excerpt.className = "excerpt";
    excerpt.textContent = item.excerpt;

    const meta = document.createElement("div");
    meta.className = "meta";
    const time = document.createElement("time");
    time.dateTime = item.published;
    time.textContent = fmtDate(item.published);
    const more = document.createElement("a");
    more.href = item.link;
    more.className = "read-more";
    more.textContent = I18N.readMore;
    meta.appendChild(time);
    meta.appendChild(more);

    content.appendChild(h);
    if (item.excerpt) content.appendChild(excerpt);
    content.appendChild(meta);

    article.appendChild(content);
    return article;
  }

  function renderList(items, { replace = true } = {}) {
    // Title
    let title = listWrap.querySelector(".sitemap-title");
    if (!title) {
      title = document.createElement("div");
      title.className = "sitemap-title";
      listWrap.appendChild(title);
    }
    title.textContent = state.label || I18N.allPosts;

    // Grid
    let grid = listWrap.querySelector(".posts-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "posts-grid";
      listWrap.appendChild(grid);
    }
    if (replace) grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach(it => frag.appendChild(articleCard(it)));
    grid.appendChild(frag);
  }

  function pageList(totalPages, current, maxLen = 7) {
    // build [1, '…', n-1, n, n+1, '…', total]
    const pages = [];
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const side = Math.floor((maxLen - 3) / 2);
    const start = clamp(current - side, 2, Math.max(2, totalPages - (side * 2) - 1));
    const end = clamp(start + (side * 2), 1, totalPages - 1);
    pages.push(1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("…");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }

  function renderPagination() {
    // Remove existing actions
    const existing = listWrap.querySelector(".actions");
    if (existing) existing.remove();

    if (CFG.pagination === "load-more") {
      if (state.page >= state.totalPages || state.totalPages <= 1) return;
      const actions = document.createElement("div");
      actions.className = "actions";
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.type = "button";
      btn.textContent = I18N.loadMore;
      btn.addEventListener("click", async () => {
        await loadNextAppend();
      });
      actions.appendChild(btn);
      listWrap.appendChild(actions);

      // Optional auto-load when near bottom
      if (CFG.autoLoadMore && "IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach(en => {
            if (en.isIntersecting && !state.loading) {
              io.disconnect();
              btn.click();
            }
          });
        }, { rootMargin: "400px" });
        io.observe(actions);
      }
      return;
    }

    // numbers pagination
    if (state.totalPages <= 1) return;
    const actions = document.createElement("div");
    actions.className = "actions";
    const pag = document.createElement("div");
    pag.className = "pagination";

    const pages = pageList(state.totalPages, state.page, 7);
    pages.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "page-btn";
      b.disabled = p === "…";
      b.textContent = String(p);
      if (p === state.page) b.classList.add("active");
      if (p !== "…") {
        b.addEventListener("click", () => {
          if (p === state.page) return;
          state.page = p;
          setQuery(state.label, state.page);
          loadAndRender({ replaceList: true });
        });
      }
      pag.appendChild(b);
    });

    actions.appendChild(pag);
    listWrap.appendChild(actions);
  }

  // JSON-LD ItemList for SEO
  function updateItemListJsonLd(items) {
    let el = document.getElementById("sitemap-itemlist-jsonld");
    const basePosition = (state.page - 1) * CFG.perPage;
    const json = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": state.label || I18N.allPosts,
      "itemListOrder": "http://schema.org/ItemListOrderAscending",
      "numberOfItems": items.length,
      "itemListElement": items.map((it, idx) => ({
        "@type": "ListItem",
        "position": basePosition + idx + 1,
        "url": it.link,
        "name": it.title
      }))
    };
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "sitemap-itemlist-jsonld";
      document.body.appendChild(el);
    }
    el.textContent = JSON.stringify(json);
  }

  // Core loader
  async function loadAndRender({ replaceList = true } = {}) {
    if (state.loading) return;
    state.loading = true;

    if (replaceList) {
      // preserve title, but show spinner in grid area
      listWrap.setAttribute("aria-busy", "true");
      const grid = listWrap.querySelector(".posts-grid");
      if (grid) grid.innerHTML = `<div class="spinner" role="status" aria-label="${I18N.loading}"></div>`;
      else showSpinner();
    }

    try {
      const data = await fetchPage(state.label, state.page);
      state.totalResults = data.total || 0;
      state.totalPages = state.totalResults ? Math.ceil(state.totalResults / CFG.perPage) : 0;

      if (!data.entries.length && state.page > 1) {
        showEmpty();
      } else if (!data.entries.length && state.page === 1) {
        showEmpty();
      } else {
        renderList(data.entries, { replace: replaceList });
        renderPagination();
        updateItemListJsonLd(data.entries);
      }
    } catch (err) {
      console.error("Sitemap error:", err);
      showError(I18N.error);
    } finally {
      listWrap.setAttribute("aria-busy", "false");
      state.loading = false;
    }
  }

  async function loadNextAppend() {
    if (state.loading) return;
    if (state.page >= state.totalPages) return;
    state.page += 1;
    setQuery(state.label, state.page);
    await loadAndRender({ replaceList: false });
    // re-render pagination for load-more (maybe hide if end)
    renderPagination();
  }

  // Initialize
  async function init() {
    const { label, page } = parseQuery();
    state.label = label;
    state.page = page;

    // Build label nav
    let labels = CFG.labelsWanted && CFG.labelsWanted.length ? CFG.labelsWanted : [];
    try {
      if (!labels.length) {
        labels = await getTopLabels(CFG.labelNavLimit);
      }
    } catch (e) {
      console.warn("Label scan failed; falling back to config", e);
    }
    renderNav(labels);

    // First load
    await loadAndRender({ replaceList: true });

    // History back/forward
    window.addEventListener("popstate", () => {
      const q = parseQuery();
      const changed = (q.label !== state.label) || (q.page !== state.page);
      if (!changed) return;
      state.label = q.label;
      state.page = q.page;
      updateNavActive();
      loadAndRender({ replaceList: true });
    });

    state.initialized = true;
  }

  // Kickoff
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
