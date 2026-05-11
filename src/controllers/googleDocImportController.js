const GDOC_ID_PATTERNS = [
  // /document/d/{id}/edit  or  /document/d/{id}/view  etc.
  /\/document\/d\/([a-zA-Z0-9_-]{25,})/,
  // docs.google.com/open?id={id}
  /[?&]id=([a-zA-Z0-9_-]{25,})/,
];

/**
 * Extract the Google Doc document ID from various share URL formats.
 */
function extractDocId(url) {
  for (const pattern of GDOC_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Remove everything Google adds that isn't useful:
 * - The outer <html>/<head> wrapper (we keep only body content + styles)
 * - Google's @font-face imports (they 404 outside of Docs)
 * - Google's body/p margin resets that flatten all spacing
 * - Inline google-specific attributes
 *
 * Returns { bodyHtml, css } - ready to inject into GrapesJS.
 */
/** Convert pt to px: 1pt = 1.3333px */
function ptToPx(pt) {
  return `${(parseFloat(pt) * 1.3333).toFixed(1)}px`;
}

function cleanGoogleDocHtml(rawHtml) {
  // 1. Extract <style> block
  const styleMatch = rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  let css = styleMatch ? styleMatch[1] : "";

  // 2. Extract <body> content
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : rawHtml;

  // 3. Remove @font-face - Google's CDN fonts 404 outside Docs
  css = css.replace(/@font-face\s*\{[^}]*\}/gi, "");

  // 4. Strip body/html rules (including class variants like body.c13) - Google sets
  //    margin:72pt (1-inch page margins) which causes layout offsets.
  //    We preserve this ourselves via the wrapper padding instead.
  css = css.replace(/(?:html|body)(?:\.\w+)?\s*\{[^}]*\}/gi, "");

  // 5. Strip Google Docs internal tracking attributes
  body = body
    .replace(/\s+id="docs-internal-guid-[^"]*"/g, "")
    .replace(/\s+data-[a-z-]+="[^"]*"/g, "");

  // 6. Remove empty tracking spans
  body = body.replace(/<span\s*><\/span>/g, "");

  // 7. Convert ALL pt measurements in CSS to px so positioning is preserved.
  //    Google uses pt for top/left/margin/padding of absolutely positioned boxes.
  //    font-size gets its own em treatment below; everything else → px.
  const convertPtInDecl = (decl) =>
    decl.replace(/:\s*(\d+(?:\.\d+)?)pt/g, (_, pt) => `: ${ptToPx(pt)}`);

  // Process each CSS rule's declarations individually
  css = css.replace(/\{([^}]*)\}/g, (_, declarations) => `{${convertPtInDecl(declarations)}}`);

  // Convert pt in inline styles in body HTML
  body = body.replace(/style="([^"]*)"/g, (_, style) => `style="${convertPtInDecl(style)}"`);

  // 8. Now specifically convert font-size px back to em for readability
  //    (we converted pt→px above; 16px ≈ 1em baseline)
  const pxToEm = (_, px) => `font-size:${(parseFloat(px) / 16).toFixed(2)}em`;
  css = css.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g, pxToEm);
  body = body.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g, pxToEm);

  // 9. Make images responsive BUT preserve intentionally small images.
  //    Only override images wider than 300px (cover/full-width images).
  body = body.replace(
    /(<img[^>]*)\s+width="(\d+)"/gi,
    (match, before, w) => parseInt(w) > 300 ? `${before} width="100%"` : match
  );
  body = body.replace(
    /(<img[^>]*style="[^"]*)(width\s*:\s*(\d+(?:\.\d+)?)px)/gi,
    (match, before, _, w) => parseFloat(w) > 300 ? `${before}width:100%` : match
  );
  // Always remove fixed height on images so aspect ratio is preserved
  body = body.replace(/(<img[^>]*)\s+height="[\d.]+"/gi, "$1");
  body = body.replace(
    /(<img[^>]*style="[^"]*)(height\s*:\s*[\d.]+px)/gi,
    "$1height:auto"
  );

  // 10. Ensure any element that contains position:absolute children has
  //     position:relative so the coordinates are relative to it, not the page.
  css = css.replace(
    /(\{[^}]*position\s*:\s*relative[^}]*\})/gi,
    (m) => m // already relative - keep
  );

  // 11. Wrap in a clean container that mimics the page dimensions Google uses
  //     (A4 width ≈ 794px, letter ≈ 816px). We use 816px to match Google's default.
  const cleaned = `<div class="gdoc-import">${body}</div>`;

  return { bodyHtml: cleaned, css: css.trim() };
}

/**
 * POST /api/templates/import-google-doc
 * Body: { url: "https://docs.google.com/document/d/..." }
 * Returns: { html: "<full html document>" }
 */
const importGoogleDoc = async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  // Validate it looks like a Google Docs URL
  if (!url.includes("docs.google.com") && !url.includes("drive.google.com")) {
    return res.status(400).json({ error: "URL must be a Google Docs or Google Drive link" });
  }

  const docId = extractDocId(url);
  if (!docId) {
    return res.status(400).json({
      error:
        "Could not extract document ID from the URL. Make sure it is a valid Google Docs share link.",
    });
  }

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;

  let rawHtml;
  try {
    const response = await fetch(exportUrl, {
      headers: {
        // Mimic a browser so Google doesn't redirect to a login page
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15 s timeout
    });

    if (response.status === 401 || response.status === 403) {
      return res.status(403).json({
        error:
          'The document is private. Please set sharing to "Anyone with the link can view" in Google Docs and try again.',
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        error: `Google returned HTTP ${response.status}. Make sure the document exists and is shared.`,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      // Google sometimes redirects to the accounts login page (returns HTML but not the doc)
      // Check for the redirect fingerprint
      const text = await response.text();
      if (
        text.includes("accounts.google.com") ||
        text.includes("ServiceLogin")
      ) {
        return res.status(403).json({
          error:
            'The document requires sign-in. Please set sharing to "Anyone with the link can view" and try again.',
        });
      }
      rawHtml = text;
    } else {
      rawHtml = await response.text();
    }
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({ error: "Request to Google timed out. Please try again." });
    }
    console.error("Google Doc fetch error:", err);
    return res.status(502).json({ error: "Failed to reach Google Docs. Check your network." });
  }

  const { bodyHtml, css } = cleanGoogleDocHtml(rawHtml);

  // Build a full HTML document (same format as what GrapesJS saves)
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }

    /* Reset - override anything Google left behind */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff;
      overflow-x: hidden;
    }

    /* Document wrapper - 816px matches Google Docs' letter-size page width.
       position:relative is critical: it makes this the reference frame for
       any position:absolute elements (e.g. cover page text boxes). */
    .gdoc-import {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      position: relative;
      width: 816px;
      max-width: 100%;
      margin: 0 auto;
      padding: 72px;        /* matches Google's default 1-inch page margins */
      overflow: hidden;
    }

    /* Responsive images - covers large cover-page images */
    .gdoc-import img {
      max-width: 100% !important;
      height: auto !important;
      display: block;
    }

    /* Tables */
    .gdoc-import table {
      border-collapse: collapse;
      width: 100%;
      max-width: 100%;
      table-layout: auto;
    }
    .gdoc-import td, .gdoc-import th { padding: 6px 8px; }

    /* Prevent any element from overflowing horizontally */
    .gdoc-import * { max-width: 100%; }

    /* Preserve Google's paragraph spacing */
    .gdoc-import p { margin: 0 0 0.5em; }

    ${css}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  res.json({ html: fullHtml, docId });
};

module.exports = { importGoogleDoc };
