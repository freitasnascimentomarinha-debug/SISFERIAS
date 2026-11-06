// Requerimento de parcelas de férias (adiantamento do adicional natalino, adicional
// de férias e remuneração de férias), no modelo usado pela OM, em Word editável.
// A biblioteca docx só é carregada quando o requerimento é gerado.
import brasaoUrl from '../assets/brasao-armas-nacionais.png';

export type SimNao = 'S' | 'N';

export interface DadosRequerimento {
  om: string;                 // nome da Organização Militar
  nup: string;                // NUP do requerimento (SIGAD)
  destinatario: string;       // "Ao:"
  nome: string;
  posto: string;              // posto/graduação, ex.: 1SG
  especialidade: string;      // quadro/especialidade, ex.: BA
  nip: string;
  anoFerias: number;          // ano a que as férias se referem
  inicio: string;             // AAAA-MM-DD
  fim: string;                // AAAA-MM-DD
  adiantamentoNatalino: SimNao;
  anoNatalino: number;
  adicionalFerias: SimNao;
  remuneracaoFerias: SimNao;
  local: string;              // ex.: Rio de Janeiro, RJ
}

/**
 * Exercício (para efeito de pagamento) que contém a data: de 1º de dezembro de um ano
 * a 30 de novembro do seguinte, com o nome do ano em que termina. É o ano do 13º
 * cujo adiantamento é pedido. Ex.: 20/12/2025 → 2026; 06/07/2026 → 2026.
 */
export const exercicioPagamento = (isoData: string) => {
  const [a, m] = (isoData || '').split('-').map(Number);
  return m === 12 ? a + 1 : a;
};

/** 1SG → 1ºSG; CB → CB. */
export const formatarPosto = (posto: string) => (posto || '').trim().toUpperCase().replace(/^(\d)\s*º?\s*/, '$1º');

/** 12345678 → 12.3456.78 (outros formatos ficam como estão). */
export const formatarNip = (nip: string) => {
  const d = (nip || '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 2)}.${d.slice(2, 6)}.${d.slice(6)}` : (nip || '').trim();
};

const dataBR = (iso: string) => {
  const [a, m, d] = (iso || '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

/** Identificação na assinatura: "1ºSG (BA)". */
export const identificacaoAssinatura = (posto: string, esp: string) =>
  `${formatarPosto(posto)}${esp.trim() ? ` (${esp.trim().toUpperCase()})` : ''}`;

export function nomeArquivoRequerimento(d: DadosRequerimento) {
  const nome = (d.nome.split(' ')[0] || 'militar').normalize('NFD').replace(/[^\w]/g, '');
  return `Requerimento_Ferias_${nome}_${d.anoFerias}.docx`;
}

export async function gerarRequerimento(d: DadosRequerimento): Promise<Blob> {
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } = D;
  const FONT = 'Calibri';
  const SIZE = 22; // 11 pt
  const RECUO = 1701; // 3 cm: recuo do texto, como no modelo

  const t = (text: string, o: { bold?: boolean } = {}) => new TextRun({ text, font: FONT, size: SIZE, bold: o.bold });
  const p = (children: InstanceType<typeof TextRun>[] | string, o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; indent?: number; firstLine?: number; after?: number } = {}) =>
    new Paragraph({
      children: typeof children === 'string' ? [t(children)] : children,
      alignment: o.align ?? AlignmentType.JUSTIFIED,
      indent: { left: o.indent, firstLine: o.firstLine },
      spacing: { after: o.after ?? 0, line: 276 },
    });
  const vazio = () => p('');

  let brasao: InstanceType<typeof Paragraph> | null = null;
  try {
    const buf = await (await fetch(brasaoUrl)).arrayBuffer();
    brasao = new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width: 64, height: 64 } })],
    });
  } catch { /* sem o brasão, o documento sai assim mesmo */ }

  const esp = d.especialidade.trim().toUpperCase();
  const identificacao = `${formatarPosto(d.posto)}${esp ? `-${esp}` : ''}`;
  const item = (marca: SimNao, titulo: string, artigo: string) => [
    p([t(`( ${marca} ) ${titulo}`)], { indent: RECUO }),
    p(artigo, { indent: RECUO }),
    vazio(),
  ];

  const doc = new Document({
    creator: 'SISFERIAS',
    title: `Requerimento de férias – ${d.nome}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } } },
      children: [
        ...(brasao ? [brasao] : []),
        p([t('MARINHA DO BRASIL', { bold: true })], { align: AlignmentType.CENTER }),
        p([t(d.om.toUpperCase(), { bold: true })], { align: AlignmentType.CENTER }),
        vazio(), vazio(),
        p('REQUERIMENTO', { align: AlignmentType.LEFT }),
        p(d.nup, { align: AlignmentType.LEFT }),
        vazio(),
        p(`Ao: ${d.destinatario}`, { align: AlignmentType.LEFT }),
        vazio(),
        p(`${d.nome.toUpperCase()}, ${identificacao}, ${formatarNip(d.nip)}, servindo presentemente nesta Organização Militar, `
          + 'requer que se digne conceder as parcelas assinaladas abaixo, em virtude de suas férias, relativas ao ano de '
          + `${d.anoFerias}, estarem programadas para o período de ${dataBR(d.inicio)} a ${dataBR(d.fim)}.`, { firstLine: RECUO }),
        vazio(),
        ...item(d.adiantamentoNatalino, `Adiantamento do Adicional Natalino do ano de ${d.anoNatalino} (50%)`,
          '(Artigo 24.3 da SGM-302 - Volume II = preencher com S(Sim) ou N(Não))'),
        ...item(d.adicionalFerias, 'Adicional de Férias (1/3)',
          '(Artigo 24.4 da SGM-302 - Volume II = preencher com S(Sim) - não depende de solicitação, será pago ao sair de Férias)'),
        ...item(d.remuneracaoFerias, 'Remuneração de Férias (70%)',
          '(Artigo 24.7 da SGM-302 - Volume II = preencher com S(Sim) ou N(Não))'),
        p('Nestes termos, pede deferimento.', { indent: RECUO }),
        vazio(),
        p(`${d.local}, na data da assinatura.`, { indent: RECUO }),
        vazio(), vazio(), vazio(), vazio(),
        p(d.nome.toUpperCase(), { align: AlignmentType.CENTER }),
        p(identificacaoAssinatura(d.posto, d.especialidade), { align: AlignmentType.CENTER }),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
