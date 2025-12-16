
/*
ARUNNER ver4
QR fallback FIX
- Never outputs file:// links
- Always uses https://arunner2.netlify.app/capture.html
*/

// ===== Handwritten (QR) helpers =====

const CAPTURE_BASE_URL = "https://arunner2.netlify.app/capture.html";

function buildCaptureUrl(cid) {
  return CAPTURE_BASE_URL + "?cid=" + encodeURIComponent(cid);
}

function showFallbackLink(container, cid) {
  const url = buildCaptureUrl(cid);
  container.innerHTML =
    'If QR fails open this link on your phone:<br>' +
    '<a href="' + url + '" target="_blank">' + url + '</a>';
}

/*
IMPORTANT PATCH LOCATION
Replace any logic like:
const captureUrl = location.origin + '/' + created.captureUrl;

WITH:
const captureUrl = buildCaptureUrl(cid);
*/

// This file is intended to replace script.js
