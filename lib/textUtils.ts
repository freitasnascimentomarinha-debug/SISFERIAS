// Remove acentos/diacríticos e normaliza para comparação de buscas por nome
export const normalizeText = (value: string): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};
