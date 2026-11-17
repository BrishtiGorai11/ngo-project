/* Where is the backend?
   The backend (FastAPI) also serves this website, so normally the API is on the same address.
   Only edit this if your API lives on a different domain: window.LIFEDROP_API = "https://api.yourngo.org"; */
window.LIFEDROP_API = window.LIFEDROP_API ||
    ((location.protocol === "file:" || (location.port && location.port !== "8000" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)))
        ? "http://127.0.0.1:8000"      // opened from a separate dev server / file
        : location.origin);            // served by the backend itself

/* If the site is opened from a plain static server (Live Server, python http.server, file://)
   clean URLs like /story do not exist there, so point the links at the .html files instead.
   When the backend serves the site (port 8000) nothing is changed and URLs stay clean. */
document.addEventListener("DOMContentLoaded", function () {
    if (window.LIFEDROP_API === location.origin) return;
    var map = { "/": "index.html", "/story": "story.html", "/contact": "contact.html", "/admin": "admin.html" };
    document.querySelectorAll('a[href^="/"]').forEach(function (a) {
        var parts = a.getAttribute("href").split("#");
        if (map[parts[0]]) a.setAttribute("href", map[parts[0]] + (parts[1] ? "#" + parts[1] : ""));
    });
});
