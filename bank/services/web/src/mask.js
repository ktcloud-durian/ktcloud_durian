// 화면에 보여 줄 때 개인정보 가리기
export const maskPhone = (p) => String(p || '').replace(/^(\d{3})-(\d{3,4})-(\d{4})$/, '$1-****-$3');
export const maskName = (n) => {
  const s = String(n || '');
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
};
