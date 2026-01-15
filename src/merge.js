function uniq(arr){
  return Array.from(new Set((arr||[]).map(x=>String(x).trim()).filter(Boolean)));
}
function pick(a,b){
  return (a!==null && a!==undefined && String(a).trim()!=='') ? a : b;
}

export function mergeProviders(isbn13, google, ol){
  const g = google?.mapped || {};
  const o = ol?.mapped || {};

  const title = pick(g.title, o.title);
  const subtitle = pick(g.subtitle, o.subtitle);
  const publisher = pick(o.publisher, g.publisher);
  const publishedDate = pick(o.publishedDate, g.publishedDate);
  const description = pick(g.description, o.description);
  const language = pick(g.language, o.language);
  const pageCount = g.pageCount || o.pageCount || null;
  const categories = uniq([...(g.categories||[]), ...(o.categories||[])]);
  const authors = uniq([...(g.authors||[]), ...(o.authors||[])]);

  const cover = pickBestCover(isbn13, g.imageLinks, o.cover);

  const ed = {
    isbn13,
    isbn10: g.isbn10 || null,
    title: title || '',
    subtitle: subtitle || '',
    authors,
    language: language || '',
    description: description || '',
    categories,
    publisher: publisher || '',
    editionStatement: '',
    publishedDate: publishedDate || '',
    pageCount,
    format: '',
    coverRemoteUrl: cover.url || '',
    coverSource: cover.source || '',
    confidence: 0,
    sources: {
      google: { matched: !!google?.matched, volumeId: g.googleVolumeId || null },
      openlibrary: { matched: !!ol?.matched, url: o.openLibraryUrl || null }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  ed.confidence = computeConfidence(ed, google, ol);
  return { edition: ed };
}

function pickBestCover(isbn13, imageLinks, olCover){
  if(imageLinks){
    const order=['extraLarge','large','medium','small','thumbnail','smallThumbnail'];
    for(const k of order){
      if(imageLinks[k]) return { url: imageLinks[k], source: 'google' };
    }
  }
  if(olCover?.large) return { url: olCover.large, source: 'openlibrary' };
  return { url: `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`, source: 'openlibrary' };
}

function computeConfidence(ed, google, ol){
  let score=50;
  if(google?.matched || ol?.matched) score += 15;
  if(google?.matched && ol?.matched) score += 5;
  if(ed.title) score += 5;
  if(ed.authors?.length) score += 5;
  if(ed.publisher) score += 10;
  if(ed.publishedDate) score += 5;
  if(ed.pageCount) score += 10;
  if(ed.coverRemoteUrl) score += 5;
  const gt = google?.mapped?.title || '';
  const ot = ol?.mapped?.title || '';
  if(gt && ot && normalize(gt) !== normalize(ot)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function normalize(s){
  return String(s).toLowerCase().replace(/\s+/g,' ').trim();
}
