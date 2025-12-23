// loadPublications.js (diagnostic + fallback)
(async function(){
  const BIB_PATH = 'https://zaap38.github.io/benoit-alcaraz.io/publications.bib'; // adjust if needed
  const listEl = document.getElementById('pub-list');
  const sortEl = document.getElementById('pub-sort');
  const downloadBtn = document.getElementById('download-bib');
  const showFirstAuthorOnly = document.getElementById('show-only-first-author');

  // UI helper to show messages
  function showMessage(html) {
    if (!listEl) {
      console.warn('pub-list element not found in DOM.');
      return;
    }
    listEl.innerHTML = `<li class="muted">${html}</li>`;
  }

  // fetch the bib file with diagnostics
  async function fetchBib(path) {
    try {
      console.log('[pubs] fetching', path);
      const res = await fetch(path, {cache: "no-cache"});
      console.log('[pubs] response', res.status, res.statusText, res.headers.get('content-type'));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      console.log('[pubs] fetched length', text.length);
      return text;
    } catch (err) {
      console.error('[pubs] fetch error:', err);
      throw err;
    }
  }

  // Try to parse using bibtex-parse-js (if available)
  function parseWithLibrary(text) {
    try {
      // some builds expose bibtexParse, others bibtexParse or window.bibtexParse
      const p = window.bibtexParse || window.bibtexParseJS || window.bibtexParseJ || window.bibtexparse || window.bibtexParse;
      if (typeof p !== 'undefined' && typeof p.toJSON === 'function') {
        console.log('[pubs] using parser: bibtexParse.toJSON');
        return p.toJSON(text);
      }
      // some CDN expose bibtexParse as global named 'bibtexParse'
      if (typeof bibtexParse !== 'undefined' && typeof bibtexParse.toJSON === 'function') {
        console.log('[pubs] using parser: bibtexParse.toJSON (global)');
        return bibtexParse.toJSON(text);
      }
      console.warn('[pubs] parser library not found (bibtex-parse-js).');
      return null;
    } catch (err) {
      console.error('[pubs] parser threw:', err);
      return null;
    }
  }

//   // very small fallback parser: split on @, extract key fields by regex
//   function fallbackParse(text) {
//     console.log('[pubs] using fallback parser');
//     const entries = [];
//     // split by @ but preserve starting @
//     const parts = text.split(/\n@/).map((p,i) => (i===0 ? p.trim() : '@'+p.trim())).filter(Boolean);
//     for (const part of parts) {
//       // ensure starts with @type{key,
//       const headMatch = part.match(/^@([a-zA-Z]+)\s*\{\s*([^,]+),/);
//       if (!headMatch) continue;
//       const entryType = headMatch[1];
//       const key = headMatch[2];
//       // extract some fields
//       const titleMatch = part.match(/title\s*=\s*[{"]([^"}]+)[}"]/i);
//       const authorMatch = part.match(/author\s*=\s*[{"]([^"}]+)[}"]/i);
//       const yearMatch = part.match(/year\s*=\s*[{"]?(\d{4})/i);
//       const urlMatch = part.match(/url\s*=\s*[{"]([^"}]+)[}"]/i);
//       const doiMatch = part.match(/doi\s*=\s*[{"]?([^",}\s]+)[}"]/i);
//       const booktitleMatch = part.match(/booktitle\s*=\s*[{"]([^"}]+)[}"]/i);
//       const journalMatch = part.match(/journal\s*=\s*[{"]([^"}]+)[}"]/i);
//       entries.push({
//         citationKey: key,
//         entryType,
//         entryTags: {
//           title: titleMatch ? titleMatch[1].trim() : '',
//           author: authorMatch ? authorMatch[1].trim() : '',
//           year: yearMatch ? yearMatch[1] : '',
//           url: urlMatch ? urlMatch[1] : '',
//           doi: doiMatch ? doiMatch[1] : '',
//           booktitle: booktitleMatch ? booktitleMatch[1] : (journalMatch ? journalMatch[1] : '')
//         }
//       });
//     }
//     return entries;
//   }

// very small fallback parser: split on @, extract key fields by regex
function fallbackParse(text) {
  console.log('[pubs] using fallback parser');
  const entries = [];
  // split by @ but preserve starting @
  const parts = text.split(/\n@/).map((p,i) => (i===0 ? p.trim() : '@'+p.trim())).filter(Boolean);
  for (const part of parts) {
    // ensure starts with @type{key,
    const headMatch = part.match(/^@([a-zA-Z]+)\s*\{\s*([^,]+),/);
    if (!headMatch) continue;
    const entryType = headMatch[1];
    const key = headMatch[2];
    // extract some fields
    const titleMatch = part.match(/title\s*=\s*[{"]([^"}]+)[}"]/i);
    const authorMatch = part.match(/author\s*=\s*[{"]([^"}]+)[}"]/i);
    const yearMatch = part.match(/year\s*=\s*[{"]?(\d{4})/i);
    const urlMatch = part.match(/url\s*=\s*[{"]([^"}]+)[}"]/i);
    const doiMatch = part.match(/doi\s*=\s*[{"]?([^",}\s]+)[}"]/i);
    const booktitleMatch = part.match(/booktitle\s*=\s*[{"]([^"}]+)[}"]/i);
    const journalMatch = part.match(/journal\s*=\s*[{"]([^"}]+)[}"]/i);
    
    entries.push({
      citationKey: key,
      entryType,
      entryTags: {
        title: titleMatch ? titleMatch[1].trim() : '',
        author: authorMatch ? authorMatch[1].trim() : '',
        year: yearMatch ? yearMatch[1] : '',
        url: urlMatch ? urlMatch[1] : '',
        doi: doiMatch ? doiMatch[1] : '',
        booktitle: booktitleMatch ? booktitleMatch[1] : (journalMatch ? journalMatch[1] : '')
      },
      raw: part.trim()  // <-- add raw BibTeX text here
    });
  }
  return entries;
}


  function normalizeEntry(e) {
    const fields = e.entryTags || e.fields || e;
    console.log(e)

    // title, authors, etc.
    const titleRaw = (fields.title || '') + '';
    const title = titleRaw.replace(/^\s*[{"]\s*/, '').replace(/\s*[}"]\s*$/, '').trim();
    const authorsRaw = fields.author || fields.authors || '';
    const authors = (authorsRaw+'').split(/\s+and\s+/i).map(a => a.trim()).filter(Boolean);
    const year = fields.year || '';
    const doi = fields.doi ? (fields.doi.startsWith('http') ? fields.doi : 'https://doi.org/' + fields.doi.replace(/^doi:\s*/i,'')) : (fields.doi || '');
    const url = fields.url || fields.pdf || '';
    const booktitle = fields.booktitle || fields.journal || '';
    const raw = e.raw;

    return {
        id: e.citationKey || e.citationkey || e.citationKey || (title.substring(0,20).replace(/\W/g,'')),
        type: e.entryType || e.entrytype || 'article',
        title,
        authors,
        year,
        doi,
        url,
        booktitle,
        raw
    };
  }

  // Render entries with year splitters
function renderEntriesWithYearSplit(entries) {
  if (!entries || entries.length === 0) return '';

  // Sort by year descending
  entries.sort((a,b) => parseInt(b.year||0) - parseInt(a.year||0));

  let lastYear = null;
  const html = [];

  for (const e of entries) {
    if (e.year && e.year !== lastYear) {
      html.push(`<li class="year-splitter">${e.year}</li>`);
      lastYear = e.year;
    }
    html.push(renderEntryHTML(e));
  }

  return html.join('\n');
}


  function renderEntryHTML(e) {
    const authorHtml = e.authors
        .map(a => `<span class="pub-author">${escapeHtml(decodeLaTeX(a))}</span>`)
        .join(', ');

    const titleHtml = `<span class="pub-title">${escapeHtml(decodeLaTeX(e.title))}</span>`;

    const metaParts = [];

    // Safely get booktitle/conference from any field
    const booktitle = e.booktitle;
    if (booktitle) metaParts.push(`<span class="pub-conference"><em>${escapeHtml(decodeLaTeX(booktitle))}</em></span>`);
    if (e.year) metaParts.push(`<span class="pub-year">${escapeHtml(e.year)}</span>`);

    const links = [];
    if (e.doi) links.push(`<a class="pub-link" href="${encodeURI(e.doi)}" target="_blank" rel="noopener">DOI</a>`);
    if (e.url) links.push(`<a class="pub-link" href="${encodeURI(e.url)}" target="_blank" rel="noopener">PDF</a>`);
    links.push(`<a class="pub-link bibtex-toggle" href="#" data-key="${e.raw}">BibTeX</a>`);

    return `
    <li class="pub-entry" id="pub-${e.id}">
        <div class="pub-main">${titleHtml}</div>
        <div class="pub-meta">${authorHtml}${metaParts.length ? " • " + metaParts.join(' • ') : ''}</div>
        <div class="pub-actions">${links.join(' • ')}</div>
        <pre class="pub-bib hidden" id="bib-${e.raw}">${escapeHtml(renderBib(e))}</pre>
    </li>`;
  }



  function renderBib(e) {
    const k = e.raw || 'key';
    return `@${e.type}{${k}`;
  }

  function escapeHtml(s) {
    return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // main flow
  try {
    // quick DOM checks
    if (!listEl) {
      console.error('[pubs] #pub-list element not found. Aborting.');
      return;
    }

    showMessage('Loading publications…');

    const bibText = await fetchBib(BIB_PATH);

    // First, try library parser
    let parsed = parseWithLibrary(bibText);
    if (!parsed) {
      try {
        // fallback: some parsers expose global 'bibtexParse' without toJSON, try that shape
        if (Array.isArray(window.bibtexParse)) {
          parsed = window.bibtexParse;
        }
      } catch(e) {}
    }

    // final fallback parser
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      console.warn('[pubs] library parse returned empty. Running fallback parse.');
      parsed = fallbackParse(bibText);
    }

    if (!parsed || parsed.length === 0) {
      console.warn('[pubs] no entries parsed.');
      showMessage('No publications found (parsed 0 entries). Check browser console and network tab.');
      return;
    }

    console.log(parsed)

    // map & normalize
    // Suppose 'parsed' is the array returned by your parser
    const entries = parsed.map(normalizeEntry);
    console.log(entries)

    console.log('[pubs] parsed entries count:', entries.length);
    // render simple list (default sort: year desc)
    entries.sort((a,b) => (parseInt(b.year||0) - parseInt(a.year||0)));
    const html = renderEntriesWithYearSplit(entries);
    listEl.innerHTML = html;

    // basic interactivity: toggle bibtex
    listEl.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.classList.contains('bibtex-toggle')) {
        ev.preventDefault();
        const key = t.dataset.key;
        const pre = document.getElementById('bib-' + key);
        if (!pre) return;
        pre.classList.toggle('hidden');
      }
    });

    // download button if present
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const blob = new Blob([bibText], {type: 'text/plain'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'publications.bib';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('[pubs] download failed', err);
        }
      });
    }

  } catch (err) {
    console.error('[pubs] top-level error', err);
    showMessage('Error loading publications. See console for details.');
  }
})();

function decodeLaTeX(str) {
  if (!str) return '';

  // Remove outer braces around single LaTeX sequences
  str = str.replace(/\{\\([^\}]+)\}/g, '\\$1');

  // Replace specific accents
  str = str
    .replace(/\\\^i/g, 'î')
    .replace(/\\'e/g, 'é')
    .replace(/\\`e/g, 'è')
    .replace(/\\"o/g, 'ö')
    .replace(/\\"u/g, 'ü')
    .replace(/\\'a/g, 'á')
    .replace(/\\`a/g, 'à')
    .replace(/\\~n/g, 'ñ')
    .replace(/\\c c/g, 'ç');

  // Remove any remaining braces
  str = str.replace(/[{}]/g, '');

  // Remove leftover backslashes
  str = str.replace(/\\([a-zA-Z])/g, '$1');

  str = str.replace('$\pi$', 'π');

  return str;
}


