
(function () {
  "use strict";

  var state = { messages: [], filter: "all", query: "", selected: null, lastUnread: null };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c];
    });
  }

  function toast(message, isError) {
    var el = document.getElementById("adminToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "adminToast";
      el.className = "admin-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle("error", !!isError);
    el.classList.add("show");
    clearTimeout(window.__messageToastTimer);
    window.__messageToastTimer = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  function request(method, body) {
    return fetch("/api/messages", {
      method: method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.message || "Message request failed.");
        return data;
      });
    });
  }

  function dateText(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return "Unknown date";
    return d.toLocaleString(undefined, { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  function relative(value) {
    var d = new Date(value), diff = Math.max(0, Date.now() - d.getTime());
    var minute = 60000, hour = 60 * minute, day = 24 * hour;
    if (diff < minute) return "Just now";
    if (diff < hour) return Math.floor(diff / minute) + " min ago";
    if (diff < day) return Math.floor(diff / hour) + " hr ago";
    if (diff < 7 * day) {
      var days = Math.floor(diff / day);
      return days + " day" + (days === 1 ? "" : "s") + " ago";
    }
    return d.toLocaleDateString(undefined, { day:"2-digit", month:"short", year:"numeric" });
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    return state.messages.filter(function (m) {
      if (state.filter === "unread" && (m.read || m.archived)) return false;
      if (state.filter === "read" && (!m.read || m.archived)) return false;
      if (state.filter === "starred" && (!m.starred || m.archived)) return false;
      if (state.filter === "archived" && !m.archived) return false;
      if (state.filter === "today" && new Date(m.createdAt).toDateString() !== new Date().toDateString()) return false;
      if (!q) return true;
      return [m.name, m.email, m.subject, m.message].some(function (v) {
        return String(v || "").toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function updateStats() {
    var active = state.messages.filter(function (m) { return !m.archived; });
    var unread = active.filter(function (m) { return !m.read; });
    var starred = active.filter(function (m) { return !!m.starred; });
    var archived = state.messages.filter(function (m) { return !!m.archived; });

    [["messageTotal", active.length], ["messageUnread", unread.length], ["messageStarred", starred.length], ["messageArchived", archived.length]]
      .forEach(function (item) {
        var el = document.getElementById(item[0]);
        if (el) el.textContent = item[1];
      });

    var badge = document.getElementById("messageSidebarBadge");
    if (badge) {
      badge.textContent = unread.length;
      badge.hidden = unread.length === 0;
    }

    var pageBadge = document.getElementById("messagePageBadge");
    if (pageBadge) pageBadge.textContent = unread.length ? unread.length + " unread" : "All caught up";
  }

  function renderList() {
    var list = document.getElementById("messagesList");
    if (!list) return;

    updateStats();
    var items = filtered();

    if (!items.length) {
      list.innerHTML = state.messages.length
        ? '<div class="messages-empty"><i class="bi bi-search"></i><h3>No messages found</h3><p>Try another search or filter.</p></div>'
        : '<div class="messages-empty"><i class="bi bi-envelope-open"></i><h3>Your inbox is empty</h3><p>Messages submitted through the public Contact form will appear here.</p></div>';
      return;
    }

    list.innerHTML = items.map(function (m) {
      var preview = String(m.message || "").replace(/\s+/g, " ").slice(0, 125);
      return '<article class="message-row ' + (m.read ? "" : "unread") + ' ' + (m.starred ? "starred" : "") + '">' +
        '<label class="message-check"><input type="checkbox" data-message-select="' + esc(m.pathname) + '"></label>' +
        '<button type="button" class="message-star ' + (m.starred ? "active" : "") + '" title="' + (m.starred ? "Remove important" : "Mark important") + '" data-message-star="' + esc(m.pathname) + '"><i class="bi ' + (m.starred ? "bi-star-fill" : "bi-star") + '"></i></button>' +
        '<button type="button" class="message-main" data-message-open="' + esc(m.pathname) + '">' +
        '<span class="message-sender">' + esc(m.name) + '</span><span class="message-email">' + esc(m.email) + '</span>' +
        '<span class="message-subject">' + esc(m.subject) + '</span><span class="message-preview">' + esc(preview) + '</span></button>' +
        '<time class="message-time" title="' + esc(dateText(m.createdAt)) + '">' + esc(relative(m.createdAt)) + '</time></article>';
    }).join("");
  }

  function renderDetail(m) {
    var panel = document.getElementById("messageDetail");
    if (!panel) return;

    if (!m) {
      panel.innerHTML = '<div class="message-detail-empty"><i class="bi bi-envelope-paper"></i><h3>Select a message</h3><p>Open a message to read it here.</p></div>';
      return;
    }

    panel.innerHTML =
      '<div class="message-detail-head"><button type="button" class="btn-outline message-back-mobile" data-message-back><i class="bi bi-arrow-left"></i> Back</button>' +
      '<div class="message-detail-actions">' +
      '<button type="button" class="vault-action ' + (m.starred ? "active" : "") + '" data-detail-star><i class="bi ' + (m.starred ? "bi-star-fill" : "bi-star") + '"></i></button>' +
      '<button type="button" class="vault-action" data-detail-archive><i class="bi ' + (m.archived ? "bi-inbox" : "bi-archive") + '"></i></button>' +
      '<button type="button" class="vault-action danger" data-detail-delete><i class="bi bi-trash3"></i></button></div></div>' +
      '<div class="message-detail-title"><span class="message-detail-label">' + (m.archived ? "ARCHIVED" : "MESSAGE") + '</span><h2>' + esc(m.subject) + '</h2></div>' +
      '<div class="message-detail-sender"><div class="message-avatar">' + esc((m.name || "?").trim().charAt(0).toUpperCase()) + '</div>' +
      '<div><strong>' + esc(m.name) + '</strong><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></div>' +
      '<time>' + esc(dateText(m.createdAt)) + '</time></div>' +
      '<div class="message-body">' + esc(m.message).replace(/
/g, "<br>") + '</div>' +
      '<div class="message-detail-footer"><a class="btn-main" href="mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent("Re: " + m.subject) + '"><i class="bi bi-reply"></i> Reply</a>' +
      '<button type="button" class="btn-outline" data-detail-read><i class="bi ' + (m.read ? "bi-envelope" : "bi-envelope-open") + '"></i> ' + (m.read ? "Mark unread" : "Mark read") + '</button></div>';
  }

  function updateMessage(m, changes, success) {
    return request("POST", Object.assign({ action:"update", pathname:m.pathname }, changes)).then(function (result) {
      var index = state.messages.findIndex(function (item) { return item.pathname === m.pathname; });
      if (index >= 0) state.messages[index] = Object.assign({}, state.messages[index], result.message);
      if (state.selected && state.selected.pathname === m.pathname) state.selected = state.messages[index];
      renderList();
      renderDetail(state.selected);
      if (success) toast(success);
    });
  }

  function deleteMessage(m) {
    return confirmAction("Delete this message permanently?").then(function (confirmed) {
      if (!confirmed) return;
      return request("POST", { action:"delete", pathname:m.pathname }).then(function () {
        state.messages = state.messages.filter(function (item) { return item.pathname !== m.pathname; });
        state.selected = null;
        renderList();
        renderDetail(null);
        toast("Message deleted.");
      });
    });
  }

  function openMessage(m) {
    var p = m.read ? Promise.resolve() : updateMessage(m, { read:true });
    return p.then(function () {
      state.selected = state.messages.find(function (item) { return item.pathname === m.pathname; }) || m;
      renderList();
      renderDetail(state.selected);
      if (window.innerWidth <= 850) {
        var page = document.getElementById("messagesPage");
        if (page) page.classList.add("message-detail-mobile");
      }
    });
  }

  function load(showLoading) {
    var list = document.getElementById("messagesList");
    if (!list) return Promise.resolve();
    if (showLoading) list.innerHTML = '<div class="messages-loading"><i class="bi bi-arrow-repeat"></i> Loading inbox...</div>';

    return request("GET").then(function (result) {
      var previousUnread = state.lastUnread;
      state.messages = Array.isArray(result.messages) ? result.messages : [];
      var currentUnread = state.messages.filter(function (m) { return !m.read && !m.archived; }).length;
      state.lastUnread = currentUnread;

      if (previousUnread !== null && currentUnread > previousUnread && !showLoading) {
        toast((currentUnread - previousUnread) + " new message" + (currentUnread - previousUnread === 1 ? "" : "s") + " received.");
      }

      if (state.selected) {
        state.selected = state.messages.find(function (m) { return m.pathname === state.selected.pathname; }) || null;
      }

      renderList();
      renderDetail(state.selected);
    }).catch(function (error) {
      list.innerHTML = '<div class="messages-empty error"><i class="bi bi-shield-x"></i><h3>Inbox unavailable</h3><p>' + esc(error.message) + '</p></div>';
    });
  }

  function selectedMessages() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-message-select]:checked")).map(function (input) {
      return state.messages.find(function (m) { return m.pathname === input.dataset.messageSelect; });
    }).filter(Boolean);
  }

  function bulkUpdate(changes, label) {
    var selected = selectedMessages();
    if (!selected.length) return toast("Select at least one message.", true);
    return selected.reduce(function (promise, m) {
      return promise.then(function () { return request("POST", Object.assign({ action:"update", pathname:m.pathname }, changes)); });
    }, Promise.resolve()).then(function () {
      return load(false);
    }).then(function () { toast(label); }).catch(function (error) { toast(error.message, true); });
  }

  function bulkDelete() {
    var selected = selectedMessages();
    if (!selected.length) return toast("Select at least one message.", true);
    return confirmAction("Delete the selected messages permanently?").then(function (confirmed) {
      if (!confirmed) return;
      return selected.reduce(function (promise, m) {
        return promise.then(function () {
          return request("POST", { action:"delete", pathname:m.pathname });
        });
      }, Promise.resolve()).then(function () {
        return load(false);
      }).then(function () {
        toast("Selected messages deleted.");
      }).catch(function (error) {
        toast(error.message, true);
      });
    });
  }

  function bind() {
    var search = document.getElementById("messageSearch");
    if (search) search.addEventListener("input", function (event) {
      state.query = event.target.value;
      renderList();
    });

    document.querySelectorAll("[data-message-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll("[data-message-filter]").forEach(function (item) { item.classList.remove("active"); });
        button.classList.add("active");
        state.filter = button.dataset.messageFilter;
        renderList();
      });
    });

    var refresh = document.getElementById("messageRefresh");
    if (refresh) refresh.addEventListener("click", function () {
      if (refresh.classList.contains("is-refreshing")) return;
      var refreshIcon = refresh.querySelector(".message-refresh-icon");
      refresh.classList.add("is-refreshing");
      if (refreshIcon) {
        refreshIcon.classList.add("is-refreshing");
        refreshIcon.style.animation = "none";
        void refreshIcon.offsetWidth;
        refreshIcon.style.animation = "messageRefreshSpin .8s linear infinite";
      }
      load(false).finally(function () {
        setTimeout(function () {
          refresh.classList.remove("is-refreshing");
          if (refreshIcon) {
            refreshIcon.classList.remove("is-refreshing");
            refreshIcon.style.animation = "";
          }
        }, 900);
      });
    });

    var selectAll = document.getElementById("messageSelectAll");
    if (selectAll) selectAll.addEventListener("change", function (event) {
      document.querySelectorAll("[data-message-select]").forEach(function (input) { input.checked = event.target.checked; });
    });

    var bulkRead = document.getElementById("messageBulkRead");
    var bulkUnread = document.getElementById("messageBulkUnread");
    var bulkArchive = document.getElementById("messageBulkArchive");
    var bulkDeleteButton = document.getElementById("messageBulkDelete");
    if (bulkRead) bulkRead.addEventListener("click", function () { bulkUpdate({read:true}, "Selected messages marked read."); });
    if (bulkUnread) bulkUnread.addEventListener("click", function () { bulkUpdate({read:false}, "Selected messages marked unread."); });
    if (bulkArchive) bulkArchive.addEventListener("click", function () { bulkUpdate({archived:true}, "Selected messages archived."); });
    if (bulkDeleteButton) bulkDeleteButton.addEventListener("click", bulkDelete);

    document.addEventListener("click", function (event) {
      var open = event.target.closest("[data-message-open]");
      var star = event.target.closest("[data-message-star]");
      var detailStar = event.target.closest("[data-detail-star]");
      var detailArchive = event.target.closest("[data-detail-archive]");
      var detailDelete = event.target.closest("[data-detail-delete]");
      var detailRead = event.target.closest("[data-detail-read]");
      var back = event.target.closest("[data-message-back]");

      var action = Promise.resolve();
      if (open) {
        var opened = state.messages.find(function (m) { return m.pathname === open.dataset.messageOpen; });
        if (opened) action = openMessage(opened);
      } else if (star) {
        var starred = state.messages.find(function (m) { return m.pathname === star.dataset.messageStar; });
        if (starred) action = updateMessage(starred, {starred:!starred.starred}, starred.starred ? "Removed from important." : "Marked important.");
      } else if (detailStar && state.selected) {
        action = updateMessage(state.selected, {starred:!state.selected.starred}, state.selected.starred ? "Removed from important." : "Marked important.");
      } else if (detailArchive && state.selected) {
        action = updateMessage(state.selected, {archived:!state.selected.archived}, state.selected.archived ? "Moved to inbox." : "Message archived.");
      } else if (detailDelete && state.selected) {
        action = deleteMessage(state.selected);
      } else if (detailRead && state.selected) {
        action = updateMessage(state.selected, {read:!state.selected.read}, state.selected.read ? "Marked unread." : "Marked read.");
      } else if (back) {
        var mobilePage = document.getElementById("messagesPage");
        if (mobilePage) mobilePage.classList.remove("message-detail-mobile");
      }

      action.catch(function (error) { toast(error.message || "Message action failed.", true); });
    });

    document.querySelectorAll(".nav-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.dataset.section === "messages") setTimeout(function () { load(false); }, 0);
      });
    });

    load(true);
    setInterval(function () {
      if (!document.hidden) load(false);
    }, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
}());
