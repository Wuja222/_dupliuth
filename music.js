(function () {
  "use strict";

  var tracks = [
    { title: "SimpGai808", src: "SimpGai808.mp3" },
    { title: "ThichAnhCo", src: "ThichAnhCo.mp3" },
    { title: "TamTriLangThang", src: "TamTriLangThang.mp3" },
  ];
  var player;
  var audio;
  var playerScript;
  var pages = new Map();
  var currentKey;
  var currentTrackIndex = 0;

  function pageKey(url) {
    var pageUrl = new URL(url, window.location.href);
    return pageUrl.origin + pageUrl.pathname + pageUrl.search;
  }

  function capturePage() {
    return {
      title: document.title,
      lang: document.documentElement.lang,
      headNodes: Array.from(document.head.childNodes).filter(function (node) {
        return node !== playerScript;
      }),
      bodyNodes: Array.from(document.body.childNodes).filter(function (node) {
        return node !== player;
      }),
    };
  }

  function createPage(parsed, targetUrl) {
    var scripts = [];
    var headNodes = Array.from(parsed.head.childNodes)
      .filter(function (node) {
        return node.nodeName.toLowerCase() !== "script" &&
          node.nodeName.toLowerCase() !== "title";
      })
      .map(function (node) {
        return document.importNode(node, true);
      });
    var bodyNodes = Array.from(parsed.body.childNodes).map(function (node) {
      if (node.nodeName.toLowerCase() !== "script") {
        return document.importNode(node, true);
      }

      var placeholder = document.createComment("page-script");
      scripts.push({
        placeholder: placeholder,
        source: node,
      });
      return placeholder;
    });

    return {
      title: parsed.title,
      lang: parsed.documentElement.lang,
      headNodes: headNodes,
      bodyNodes: bodyNodes,
      scripts: scripts,
      targetUrl: targetUrl,
    };
  }

  function applyPage(page) {
    document.title = page.title;
    document.documentElement.lang = page.lang;
    document.head.replaceChildren.apply(
      document.head,
      page.headNodes.concat([playerScript]),
    );
    document.body.replaceChildren.apply(
      document.body,
      page.bodyNodes.concat([player]),
    );

    var scriptEntries = page.scripts || [];
    if (!scriptEntries.length) {
      page.bodyNodes.forEach(function (node) {
        if (node.nodeName.toLowerCase() === "script") {
          scriptEntries.push({ placeholder: node, source: node });
        }
      });
    }

    scriptEntries.forEach(function (entry) {
      var script = document.createElement("script");
      Array.from(entry.source.attributes).forEach(function (attribute) {
        script.setAttribute(attribute.name, attribute.value);
      });
      if (entry.source.src) {
        script.src = new URL(entry.source.getAttribute("src"), page.targetUrl).href;
        script.async = false;
      } else {
        script.textContent = entry.source.textContent;
      }
      page.bodyNodes[page.bodyNodes.indexOf(entry.placeholder)] = script;
      entry.placeholder.replaceWith(script);
    });

    page.scripts = [];
    window.scrollTo(0, 0);
  }

  function loadPage(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Không thể tải trang (" + response.status + ").");
      }
      return response.text();
    }).then(function (html) {
      var parsed = new DOMParser().parseFromString(html, "text/html");
      if (!parsed.body || !parsed.title) {
        throw new Error("Nội dung trang không hợp lệ.");
      }
      return createPage(parsed, url);
    });
  }

  function navigate(url, addHistoryEntry) {
    var targetKey = pageKey(url);
    if (targetKey === currentKey) {
      return Promise.resolve();
    }

    pages.set(currentKey, capturePage());
    var pagePromise = pages.has(targetKey)
      ? Promise.resolve(pages.get(targetKey))
      : loadPage(url);

    return pagePromise.then(function (page) {
      pages.set(targetKey, page);
      if (addHistoryEntry) {
        window.history.pushState({}, "", url);
      }
      applyPage(page);
      currentKey = targetKey;
    }).catch(function (error) {
      console.error("Điều hướng trang thất bại:", error);
    });
  }

  function setupNavigation() {
    currentKey = pageKey(window.location.href);
    pages.set(currentKey, capturePage());

    document.addEventListener("click", function (event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      var link = event.target.closest("a");
      if (
        !link ||
        link.target ||
        link.hasAttribute("download") ||
        link.origin !== window.location.origin ||
        pageKey(link.href) === currentKey
      ) {
        return;
      }

      event.preventDefault();
      navigate(link.href, true);
    });

    window.addEventListener("popstate", function () {
      navigate(window.location.href, false);
    });
  }

  function setTrack(index, shouldPlay) {
    currentTrackIndex = index;
    audio.pause();
    audio.src = tracks[index].src;
    audio.load();
    if (shouldPlay) {
      audio.play().catch(function (error) {
        console.warn("Trình duyệt chưa cho phép tự phát nhạc:", error);
      });
    }
  }

  function createPlayer() {
    audio = document.createElement("audio");
    audio.hidden = true;
    audio.autoplay = true;
    audio.preload = "auto";
    audio.setAttribute("aria-hidden", "true");
    player = audio;

    audio.addEventListener("ended", function () {
      setTrack((currentTrackIndex + 1) % tracks.length, true);
    });
    audio.addEventListener("error", function () {
      console.error("Không tải được bài nhạc:", tracks[currentTrackIndex].src);
    });
    document.addEventListener("pointerdown", function () {
      if (audio.paused) {
        audio.play().catch(function (error) {
          console.warn("Trình duyệt chưa cho phép phát nhạc:", error);
        });
      }
    }, { once: true });
    document.addEventListener("keydown", function () {
      if (audio.paused) {
        audio.play().catch(function (error) {
          console.warn("Trình duyệt chưa cho phép phát nhạc:", error);
        });
      }
    }, { once: true });

    setTrack(0, true);
    playerScript = document.querySelector("script[data-music-player]");
    setupNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPlayer, { once: true });
  } else {
    createPlayer();
  }
})();
