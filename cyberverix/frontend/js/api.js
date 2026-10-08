/* ==========================================================================
   CyberVeriX - API client
   Thin fetch wrapper. Holds the session token in localStorage and normalises
   every error into an Error with .status and .details.
   ========================================================================== */
(function (global) {
  "use strict";

  var TOKEN_KEY = "cvx.token";
  var USER_KEY = "cvx.user";

  function getToken() {
    try { return global.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function setSession(token, user) {
    try {
      if (token) { global.localStorage.setItem(TOKEN_KEY, token); }
      if (user) { global.localStorage.setItem(USER_KEY, JSON.stringify(user)); }
    } catch (e) { /* private mode: session stays in memory only */ }
  }

  function clearSession() {
    try {
      global.localStorage.removeItem(TOKEN_KEY);
      global.localStorage.removeItem(USER_KEY);
    } catch (e) { /* ignore */ }
  }

  function cachedUser() {
    try { return JSON.parse(global.localStorage.getItem(USER_KEY) || "null"); }
    catch (e) { return null; }
  }

  function request(method, path, body) {
    var headers = { "Accept": "application/json" };
    var token = getToken();
    if (token) { headers.Authorization = "Bearer " + token; }
    if (body !== undefined) { headers["Content-Type"] = "application/json"; }

    return fetch(path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) { try { data = JSON.parse(text); } catch (e) { data = { error: "Server returned an unreadable response." }; } }
        if (!res.ok) {
          var err = new Error(data.error || ("Request failed (" + res.status + ")"));
          err.status = res.status;
          err.details = data.details || [];
          throw err;
        }
        return data;
      });
    }, function () {
      var err = new Error("Cannot reach the CyberVeriX server. Is it still running?");
      err.status = 0;
      err.details = [];
      throw err;
    });
  }

  global.CVX = global.CVX || {};
  global.CVX.api = {
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    cachedUser: cachedUser,
    health: function () { return request("GET", "/api/health"); },
    register: function (payload) { return request("POST", "/api/register", payload); },
    login: function (payload) { return request("POST", "/api/login", payload); },
    logout: function () { return request("POST", "/api/logout", {}); },
    me: function () { return request("GET", "/api/me"); },
    challenges: function () { return request("GET", "/api/challenges"); },
    challenge: function (id) { return request("GET", "/api/challenges/" + encodeURIComponent(id)); },
    submit: function (id, answers) {
      return request("POST", "/api/challenges/" + encodeURIComponent(id) + "/submit", { answers: answers });
    },
    attempt: function (id) { return request("GET", "/api/attempts/" + encodeURIComponent(id)); },
    profile: function () { return request("GET", "/api/profile"); },
    report: function () { return request("GET", "/api/report"); }
  };
})(window);
