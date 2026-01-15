export async function fetchOpenLibraryByIsbn(isbn13){
  const url = new URL('https://openlibrary.org/api/books');
  url.searchParams.set('bibkeys', `ISBN:${isbn13}`);
  url.searchParams.set('jscmd', 'data');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error(`OpenLibrary hata: ${res.status}`);
  const data = await res.json();
  const key = `ISBN:${isbn13}`;
  const book = data[key];
  if(!book) return { matched: false, raw: data };

  const authors = (book.authors||[]).map(a=>a.name).filter(Boolean);
  const publishers = (book.publishers||[]).map(p=>p.name).filter(Boolean);
  const subjects = (book.subjects||[]).map(s=>s.name).filter(Boolean);

  const cover = book.cover || null;

  return {
    matched: true,
    raw: data,
    mapped: {
      title: book.title || '',
      subtitle: book.subtitle || '',
      authors,
      publisher: publishers[0] || '',
      publishedDate: book.publish_date || '',
      description: typeof book.description === 'string' ? book.description : (book.description?.value || ''),
      language: (book.languages && book.languages[0] && book.languages[0].key) ? book.languages[0].key.replace('/languages/','') : '',
      pageCount: book.number_of_pages || null,
      categories: subjects,
      cover,
      openLibraryUrl: book.url || null
    }
  };
}

export function openLibraryCoverUrl(isbn13, size='L'){
  return `https://covers.openlibrary.org/b/isbn/${isbn13}-${size}.jpg?default=false`;
}
