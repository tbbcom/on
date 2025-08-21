document.addEventListener("DOMContentLoaded", function () {
  const titleInput = document.getElementById("imeta-title");
  const descInput = document.getElementById("imeta-desc");
  const slugInput = document.getElementById("imeta-slug");
  const titleCount = document.getElementById("imeta-title-count");
  const descCount = document.getElementById("imeta-desc-count");
  const slugStatus = document.getElementById("imeta-slug-status");
  const serpTitle = document.querySelector(".serp-title");
  const serpDesc = document.querySelector(".serp-desc");
  const serpUrl = document.getElementById("imeta-serp-url");
  const scoreEl = document.getElementById("imeta-score");
  const scoreBar = document.getElementById("imeta-score-bar");
  const suggestionsEl = document.getElementById("imeta-suggestions");
  const copyBtn = document.getElementById("ibtn-copy");

  let score = 0;

  function update() {
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    const slug = slugInput.value.trim();

    // Update counters
    titleCount.textContent = `${title.length} / 60`;
    descCount.textContent = `${desc.length} / 155`;

    // SERP Preview
    serpTitle.textContent = title || "Your title will appear here";
    serpDesc.textContent = desc || "Your meta description will appear here.";
    serpUrl.textContent = slug ? `https://www.yoursite.com/${slug}` : "https://www.yoursite.com/...";

    // Slug analysis
    if (slug) {
      if (slug.match(/^[a-z0-9]+(-[a-z0-9]+)*$/)) {
        slugStatus.textContent = "✅ SEO-friendly slug";
        slugStatus.style.color = "green";
      } else {
        slugStatus.textContent = "❌ Use lowercase letters, numbers, and hyphens only";
        slugStatus.style.color = "red";
      }
    } else {
      slugStatus.textContent = "";
    }

    // SEO Score & Suggestions
    const suggestions = [];
    score = 0;

    if (title.length >= 50 && title.length <= 60) {
      score += 30;
      suggestions.push("✅ Title length is optimal (50–60 chars)");
    } else if (title.length > 60) {
      suggestions.push("⚠️ Title is too long (will be truncated)");
    } else if (title.length > 0) {
      suggestions.push("⚠️ Title is too short (aim for 50+ chars)");
    }

    if (desc.length >= 120 && desc.length <= 155) {
      score += 30;
      suggestions.push("✅ Meta description length is perfect");
    } else if (desc.length > 155) {
      suggestions.push("⚠️ Meta description too long (truncates at 155)");
    } else if (desc.length > 0) {
      suggestions.push("⚠️ Meta description too short (aim 120+)");
    }

    if (slug && slug.match(/^[a-z0-9]+(-[a-z0-9]+)*$/)) {
      score += 20;
      suggestions.push("✅ Clean, SEO-friendly URL slug");
    } else if (slug) {
      suggestions.push("❌ Avoid spaces, underscores, or uppercase");
    }

    if (title && desc && slug) score += 20;

    // Update UI
    scoreEl.textContent = score;
    scoreBar.style.width = `${score}%`;
    scoreBar.style.backgroundColor = score >= 70 ? "#4CAF50" : score >= 50 ? "#FF9800" : "#F44336";

    suggestionsEl.innerHTML = "";
    suggestions.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = s;
      suggestionsEl.appendChild(li);
    });

    // Copy meta tags
    copyBtn.onclick = () => {
      const metaTags = `
<title>${title}</title>
<meta name="description" content="${desc}" />
<!-- URL: https://www.yoursite.com/${slug} -->
      `.trim();
      navigator.clipboard.writeText(metaTags).then(() => {
        copyBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyBtn.textContent = "📋 Copy Meta Tags"), 2000);
      });
    };
  }

  titleInput.addEventListener("input", update);
  descInput.addEventListener("input", update);
  slugInput.addEventListener("input", update);
});