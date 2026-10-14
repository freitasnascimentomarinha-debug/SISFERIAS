import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api';

// Aviso de Privacidade (LGPD, art. 9º): finalidade, base legal, dados tratados e
// contato do Encarregado. O Encarregado é configurado por cada OM em
// Segurança > Sistema; sem configuração, o aviso usa um texto genérico.

interface PrivacyInfo {
  institution_name: string;
  privacy_officer: string;
  privacy_contact: string;
}

export const DEFAULT_PRIVACY_OFFICER = 'Encarregado pelo Tratamento de Dados Pessoais da OM';

const Item: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</h4>
    <p className="text-sm text-slate-700 leading-relaxed">{children}</p>
  </div>
);

export const PrivacyNoticeModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [info, setInfo] = useState<PrivacyInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    api.get<PrivacyInfo>('/privacidade').then(setInfo).catch(() => setInfo(null));
  }, [open]);

  if (!open) return null;
  const om = info?.institution_name?.trim() || 'a Organização Militar';
  const officer = info?.privacy_officer?.trim() || DEFAULT_PRIVACY_OFFICER;
  const contact = info?.privacy_contact?.trim() || 'procure a Secretaria ou o Departamento de Pessoal da OM';

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="aviso-privacidade-titulo">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-slate-100">
          <h3 id="aviso-privacidade-titulo" className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-orange-500" size={22} /> Aviso de Privacidade
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="px-8 py-6 space-y-4 overflow-y-auto">
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>{om}</strong> trata dados pessoais no SISFERIAS conforme a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais – LGPD).
          </p>
          <Item title="Dados tratados">
            Nome, nome de guerra, NIP, e-mail funcional, posto ou graduação, setor, foto, períodos de férias, endereço e telefone durante as férias e justificativas informadas.
          </Item>
          <Item title="Finalidade">
            Exclusivamente planejar, controlar e documentar as férias do efetivo da OM: lançamento, papeleta e acompanhamento do trâmite.
          </Item>
          <Item title="Base legal">
            Execução de atribuições legais da administração pública na gestão de pessoal (LGPD, art. 7º, inciso III, e art. 23).
          </Item>
          <Item title="Compartilhamento e armazenamento">
            Os dados não são compartilhados com terceiros nem usados para outra finalidade. Ficam em servidor da rede interna da Marinha do Brasil.
          </Item>
          <Item title="Quem tem acesso">
            Cada usuário vê apenas os próprios dados. Os dados do efetivo são acessados somente pela administração da OM (Direção, Departamento de Pessoal e encarregados, conforme o setor). Todas as operações ficam registradas.
          </Item>
          <Item title="Segurança">
            Acesso por conexão protegida (HTTPS), senha forte com bloqueio após tentativas inválidas e dados pessoais cifrados no banco de dados e nas cópias de segurança.
          </Item>
          <Item title="Seus direitos">
            Você pode confirmar o tratamento, acessar e corrigir seus dados (LGPD, art. 18) pelo próprio sistema ou pelo contato abaixo.
          </Item>
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <h4 className="text-[11px] font-black text-orange-700 uppercase tracking-widest mb-1">Encarregado pelo tratamento de dados</h4>
            <p className="text-sm text-slate-800 font-semibold" data-testid="privacy-officer">{officer}</p>
            <p className="text-sm text-slate-700" data-testid="privacy-contact">Contato: {contact}</p>
          </div>
        </div>
        <div className="px-8 pb-7 pt-2">
          <button type="button" onClick={onClose} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
