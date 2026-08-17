(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const DEFAULT_WORDS = ["девственница", "девственник", "екстремізм", "екстреміст", "нацистский", "фашистский", "extremism", "extremist", "неонацизм", "неонацист", "autistik", "neo-nazi", "нацистка", "фашистка", "cuckold", "fascism", "fascist", "neonazi", "pidoras", "ватники", "москали", "москаль", "пидорас", "підорас", "сионist", "сионист", "сіоніст", "autist", "faggot", "nazism", "nazist", "nigger", "petukh", "retard", "virgin", "аутист", "аутіст", "вагина", "ватник", "куколд", "нацизм", "нацист", "ниггер", "фашизм", "фашист", "хиджаб", "debil", "gomik", "incel", "nigga", "pedik", "pidor", "гомик", "гомік", "дебил", "дебіл", "инцел", "конча", "педик", "педік", "петух", "пидор", "пизда", "підор", "хохлы", "хохол", "cuck", "cunt", "naga", "nazi", "simp", "даун", "жиды", "нага", "нига", "симп", "хачи", "жид", "хач"];

  let words = [];
  let matcher = null;
  let revealHotkey = "ctrl";
  let revealDuration = 5000;

  api.storage.sync.get({
    blockedWords: DEFAULT_WORDS,
    revealHotkey: "ctrl",
    revealDuration: 5000
  }).then(data => {
    words = normalizeList(data.blockedWords);
    revealHotkey = data.revealHotkey || "ctrl";
    revealDuration = Number(data.revealDuration) || 5000;
    rebuildMatcher();
    scan(document.documentElement);
    scanEditableControls(document);
    startTitleProtection();
    observe(document.documentElement);
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes.blockedWords) {
      words = normalizeList(changes.blockedWords.newValue);
      rebuildMatcher();
      unblurAll(document);
      scan(document.documentElement);
      scanEditableControls(document);
      originalTitle = document.title;
      updateTitle();
    }

    if (changes.revealHotkey) revealHotkey = changes.revealHotkey.newValue || "ctrl";
    if (changes.revealDuration) revealDuration = Number(changes.revealDuration.newValue) || 5000;
  });

  function normalizeList(list) {
    return [...new Set(
      (Array.isArray(list) ? list : [])
        .map(String)
        .map(s => s.trim())
        .filter(Boolean)
    )].sort((a, b) => b.length - a.length);
  }

  // Case-insensitive and separator-tolerant matching:
  // "П И Д О Р", "п-и-д-о-р", "п.и.д.о.р" and mixed case are normalized.
  function normalizeForMatch(text) {
    const chars = [];
    const indexes = [];

    for (let i = 0; i < text.length; i++) {
      const c = text[i].toLowerCase();
      if (/[\p{L}\p{N}]/u.test(c)) {
        chars.push(c);
        indexes.push(i);
      }
    }
    return { text: chars.join(""), indexes };
  }

  function normalizeWord(word) {
    return [...word.toLowerCase()]
      .filter(c => /[\p{L}\p{N}]/u.test(c))
      .join("");
  }

  function rebuildMatcher() {
    const list = words.map(normalizeWord).filter(Boolean);
    matcher = list.length
      ? new RegExp(`(?:${list.map(escapeRegExp).join("|")})`, "giu")
      : null;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function skip(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest(".stb-blurred-word")) return true;

    return [
      "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE",
      "TEXTAREA", "INPUT", "SELECT", "OPTION"
    ].includes(parent.tagName);
  }

  function rangesFor(text) {
    if (!matcher || !text) return [];

    const n = normalizeForMatch(text);
    matcher.lastIndex = 0;

    const result = [];
    let m;

    while ((m = matcher.exec(n.text)) !== null) {
      const start = n.indexes[m.index];
      const endIndex = m.index + m[0].length - 1;
      const end = n.indexes[endIndex];

      if (start !== undefined && end !== undefined) {
        result.push({ start, end: end + 1 });
      }
    }

    return merge(result);
  }

  function merge(ranges) {
    if (ranges.length < 2) return ranges;
    ranges.sort((a, b) => a.start - b.start);

    const out = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = out[out.length - 1];
      const cur = ranges[i];

      if (cur.start <= last.end) {
        last.end = Math.max(last.end, cur.end);
      } else {
        out.push(cur);
      }
    }
    return out;
  }

  function process(node) {
    if (skip(node)) return;

    const text = node.nodeValue || "";
    const ranges = rangesFor(text);
    if (!ranges.length) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const r of ranges) {
      if (r.start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, r.start)));
      }

      const span = document.createElement("span");
      span.className = "stb-blurred-word";
      span.dataset.hotkey = revealHotkey;
      span.textContent = text.slice(r.start, r.end);
      span.title = `${prettyHotkey()} + click — показать на ${revealDuration / 1000} сек.`;
      fragment.appendChild(span);

      cursor = r.end;
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    node.replaceWith(fragment);
  }

  function scan(root) {
    if (!root || !matcher) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return skip(node)
            ? NodeFilter.FILTER_REJECT
            : rangesFor(node.nodeValue || "").length
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(process);

    if (root.querySelectorAll) {
      root.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot) {
          scan(el.shadowRoot);
          observe(el.shadowRoot);
        }
      });
    }
  }

  function observe(root) {
    if (!root || root.__stbObserved) return;
    root.__stbObserved = true;

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            process(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            scan(node);
            observeShadowRoots(node);
          }
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  function observeShadowRoots(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll("*").forEach(el => {
      if (el.shadowRoot) {
        scan(el.shadowRoot);
        observe(el.shadowRoot);
      }
    });
  }

  function unblurAll(root) {
    root.querySelectorAll?.(".stb-blurred-word").forEach(el => {
      el.replaceWith(document.createTextNode(el.textContent || ""));
    });

    root.querySelectorAll?.("*").forEach(el => {
      if (el.shadowRoot) unblurAll(el.shadowRoot);
    });
  }

  function prettyHotkey() {
    return revealHotkey === "ctrl" ? "Ctrl" :
           revealHotkey === "alt" ? "Alt" : "Shift";
  }

  // Inputs and textareas are not text nodes, so TreeWalker cannot see
  // what the user is typing there. Blur the control itself when its value
  // contains a configured term.
  function checkEditable(target) {
    if (!target || !["INPUT", "TEXTAREA"].includes(target.tagName)) return;

    const value = target.value || "";
    const hasBlocked = Boolean(rangesFor(value).length);

    target.classList.toggle("stb-editable-blurred", hasBlocked);
    target.dataset.stbBlocked = hasBlocked ? "1" : "0";
  }

  document.addEventListener("input", event => {
    checkEditable(event.target);
  }, true);

  document.addEventListener("change", event => {
    checkEditable(event.target);
  }, true);

  // Check already populated search/chat fields.
  function scanEditableControls(root = document) {
    root.querySelectorAll?.("input, textarea").forEach(checkEditable);
  }

  // Browser tabs display document.title. We cannot modify the browser's
  // own address/search bar, but we can mask blocked text in the page title.
  let originalTitle = null;
  let updatingTitle = false;

  function maskTitle(title) {
    if (!matcher || !title) return title;

    const ranges = rangesFor(title);
    if (!ranges.length) return title;

    let out = "";
    let cursor = 0;

    for (const r of ranges) {
      out += title.slice(cursor, r.start);
      out += "•••";
      cursor = r.end;
    }

    out += title.slice(cursor);
    return out;
  }

  function updateTitle() {
    if (!document.title || updatingTitle) return;

    if (originalTitle === null || document.title !== maskTitle(originalTitle)) {
      originalTitle = document.title;
    }

    const masked = maskTitle(originalTitle);

    if (document.title !== masked) {
      updatingTitle = true;
      document.title = masked;
      updatingTitle = false;
    }
  }

  const titleObserver = new MutationObserver(() => {
    if (updatingTitle) return;

    // Sites like Twitch constantly change document.title.
    // If the current title is not our masked version, treat it as the
    // site's new original title and mask it again.
    const current = document.title;
    if (current !== maskTitle(originalTitle || "")) {
      originalTitle = current;
    }

    updateTitle();
  });

  function startTitleProtection() {
    const titleElement = document.querySelector("title");
    if (!titleElement) return;

    originalTitle = document.title;

    titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });

    updateTitle();
  }

  document.addEventListener("click", event => {
    const target = event.target?.closest?.(".stb-blurred-word");
    if (!target) return;

    const allowed =
      revealHotkey === "ctrl" ? event.ctrlKey :
      revealHotkey === "alt" ? event.altKey :
      event.shiftKey;

    if (!allowed) return;

    event.preventDefault();
    event.stopPropagation();
    target.classList.add("stb-revealed");

    setTimeout(() => {
      if (target.isConnected) target.classList.remove("stb-revealed");
    }, revealDuration);
  }, true);
})();