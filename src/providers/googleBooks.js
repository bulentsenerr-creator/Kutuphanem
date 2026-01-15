export async function fetchGoogleBooksByIsbn(isbn13, apiKey){
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `isbn:${isbn13}`);
  if(apiKey) url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error(`Google Books hata: ${res.status}`);
  const data = await res.json();
  const item = data.items && data.items[0];
  if(!item) return { matched: false, raw: data };

  const vi = item.volumeInfo || {};
  const industry = vi.industryIdentifiers || [];
  const isbn10 = industry.find(x=>x.type==='ISBN_10')?.identifier || null;
  const isbn13Found = industry.find(x=>x.type==='ISBN_13')?.identifier || isbn13;

  return {
    matched: true,
    raw: data,
    mapped: {
      title: vi.title || '',
      subtitle: vi.subtitle || '',
      authors: vi.authors || [],
      publisher: vi.publisher || '',
      publishedDate: vi.publishedDate || '',
      description: vi.description || '',
      language: vi.language || '',
      pageCount: vi.pageCount || null,
      categories: vi.categories || [],
      imageLinks: vi.imageLinks || null,
      isbn10,
      isbn13: isbn13Found,
      googleVolumeId: item.id || null
    }
  };
}
