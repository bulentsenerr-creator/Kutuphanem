export function normalizeIsbn(input){
  if(!input) return '';
  return String(input).replace(/[^0-9Xx]/g,'').toUpperCase();
}

export function isValidIsbn13(isbn13){
  if(!/^\d{13}$/.test(isbn13)) return false;
  const digits = isbn13.split('').map(Number);
  let sum=0;
  for(let i=0;i<12;i++) sum += digits[i] * (i%2===0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

export function isValidIsbn10(isbn10){
  if(!/^[0-9]{9}[0-9X]$/.test(isbn10)) return false;
  let sum=0;
  for(let i=0;i<9;i++) sum += (i+1) * Number(isbn10[i]);
  let check = sum % 11;
  const last = isbn10[9] === 'X' ? 10 : Number(isbn10[9]);
  return check === last;
}

export function isbn10to13(isbn10){
  const core = '978' + isbn10.slice(0,9);
  const digits = core.split('').map(Number);
  let sum=0;
  for(let i=0;i<12;i++) sum += digits[i] * (i%2===0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return core + String(check);
}

export function parseIsbn(input){
  const norm = normalizeIsbn(input);
  if(norm.length===13 && /^\d{13}$/.test(norm)){
    return { isbn13: norm, isbn10: null, valid: isValidIsbn13(norm) };
  }
  if(norm.length===10){
    const valid10 = isValidIsbn10(norm);
    return { isbn13: valid10 ? isbn10to13(norm) : null, isbn10: norm, valid: valid10 };
  }
  return { isbn13: null, isbn10: norm.length===10?norm:null, valid: false };
}
