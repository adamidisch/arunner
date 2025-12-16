// ===== QR / Handwritten Upload Logic =====

const CAPTURE_BASE_URL = "https://arunner2.netlify.app/capture.html";

function showQRModal(cid) {
  const modal = document.getElementById("qrModal");
  const qrContainer = document.getElementById("qrContainer");
  const fallbackText = document.getElementById("qrFallback");

  qrContainer.innerHTML = "";
  fallbackText.innerHTML = "";

  const captureUrl = `${CAPTURE_BASE_URL}?cid=${cid}`;

  // Bulletproof QR via image (no libraries)
  const qrImg = document.createElement("img");
  qrImg.src =
    "https://quickchart.io/qr?size=220&text=" +
    encodeURIComponent(captureUrl);
  qrImg.alt = "Scan QR";
  qrImg.style.width = "220px";
  qrImg.style.height = "220px";

  qrImg.onload = () => {
    qrContainer.appendChild(qrImg);
  };

  qrImg.onerror = () => {
    // QR image failed → show ONLY https link
    fallbackText.innerHTML = `
      <div style="margin-top:12px;font-size:14px;">
        If QR fails open this link on your phone:<br>
        <a href="${captureUrl}" target="_blank">${captureUrl}</a>
      </div>
    `;
  };

  modal.classList.add("show");
}

// ===== Close modal =====
function closeQRModal() {
  document.getElementById("qrModal").classList.remove("show");
}
