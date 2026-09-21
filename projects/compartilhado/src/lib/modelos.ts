/** Modelos espelhando os contratos da SGA API. */

export type Perfil = 'ADMIN' | 'GERENTE' | 'ATENDENTE' | 'TRIAGEM';
export type StatusSenha = 'AGUARDANDO' | 'CHAMADA' | 'EM_ATENDIMENTO' | 'FINALIZADA' | 'AUSENTE' | 'CANCELADA';
export type TipoDispositivo = 'TOTEM' | 'PAINEL';
export type TipoMidia = 'YOUTUBE' | 'IMAGEM' | 'VIDEO';
export type TipoPergunta = 'NOTA' | 'SIM_NAO' | 'TEXTO';

export interface UsuarioLogado {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  /** Unidades de lotação (vazio para ADMIN). */
  unidadeIds: string[];
}

export interface RespostaLogin {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioLogado;
}

/** Resposta de GET /auth/me. */
export interface MeuPerfil {
  id: string;
  nome: string;
  login: string;
  email: string;
  perfil: Perfil;
  unidades: { id: string; nome: string }[];
  /** Guichês liberados pelo gerente (relevante para ATENDENTE). */
  guicheIds: string[];
}

export interface Servico {
  id: string;
  nome: string;
  ativo: boolean;
  subservicos: Subservico[];
}

export interface Subservico {
  id: string;
  nome: string;
  prefixo: string;
  servicoId: string;
  ativo: boolean;
}

export interface NivelPrioridade {
  id: string;
  nome: string;
  nivel: number;
  /** Cor da fonte no painel (hex). */
  cor: string;
  prefixo: string;
  ativo: boolean;
}

export interface Unidade {
  id: string;
  nome: string;
  tipo: 'FIXA' | 'MOVEL';
  endereco: string;
  cidade: string;
  uf: string;
  ativo: boolean;
}

export interface UnidadeDetalhe extends Unidade {
  subservicos: (Subservico & { servico?: Servico })[];
  guiches: Guiche[];
  dispositivos: Dispositivo[];
}

export interface Guiche {
  id: string;
  numero: string;
  unidadeId: string;
  ativo: boolean;
  subservicos: Subservico[];
}

export interface Dispositivo {
  id: string;
  nome: string;
  tipo: TipoDispositivo;
  unidadeId: string;
  token: string;
  ativo: boolean;
  config: Record<string, unknown> | null;
  urlAtivacao: string;
}

export interface Usuario {
  id: string;
  nome: string;
  login: string;
  email: string;
  perfil: Perfil;
  unidades: Unidade[];
  guiches: Guiche[];
  ativo: boolean;
}

export interface SenhaResumo {
  id: string;
  codigo: string;
  status: StatusSenha;
  subservico: string;
  prioridade: string;
  prioridadeNivel: number;
  prioridadeCor: string;
  guiche: string | null;
  emitidaEm: string;
  chamadaEm: string | null;
  iniciadaEm: string | null;
  chamadas: number;
}

export interface Senha {
  id: string;
  codigo: string;
  status: StatusSenha;
  subservico?: Subservico;
  prioridade?: NivelPrioridade;
  guiche?: Guiche | null;
  emitidaEm: string;
}

export interface FilaSnapshot {
  unidadeId: string;
  aguardando: SenhaResumo[];
  ultimasChamadas: SenhaResumo[];
  emAtendimento: SenhaResumo[];
  totais: {
    emitidas: number;
    aguardando: number;
    finalizadas: number;
    ausentes: number;
    canceladas: number;
  };
}

export interface ConfigDispositivo {
  id: string;
  nome: string;
  tipo: TipoDispositivo;
  unidadeId: string;
  unidadeNome: string;
  config: Record<string, unknown> | null;
  servicos?: { id: string; nome: string; subservicos: { id: string; nome: string; prefixo: string }[] }[];
  prioridades?: NivelPrioridade[];
}

export interface EventoMidia {
  id: string;
  titulo: string;
  tipo: TipoMidia;
  url: string | null;
  videoId: string | null;
  /** Unidades onde é exibido. Vazio = todas. */
  unidades: Unidade[];
  /** Lado na tela dividida (2 conteúdos no mesmo horário): 1 = esquerda, 2 = direita. */
  posicao: number;
  inicio: string;
  fim: string;
  ativo: boolean;
}

export interface Pesquisa {
  id: string;
  nome: string;
  codigo: string;
  unidadeId: string;
  ativa: boolean;
  urlPublica: string;
  perguntas?: PesquisaPergunta[];
}

export interface PesquisaPergunta {
  id: string;
  ordem: number;
  tipo: TipoPergunta;
  texto: string;
  escalaMax: number | null;
  obrigatoria: boolean;
}

export interface PesquisaPublica {
  nome: string;
  unidade: string;
  perguntas: PesquisaPergunta[];
}

export interface DashboardResumo {
  periodo: { de: string; ate: string };
  totais: {
    emitidas: number;
    finalizadas: number;
    aguardando: number;
    emAtendimento: number;
    ausentes: number;
    canceladas: number;
  };
  tempoMedioEsperaSeg: number | null;
  tempoMedioAtendimentoSeg: number | null;
  porSubservico: { nome: string; emitidas: number; finalizadas: number }[];
  porAtendente: { nome: string; finalizadas: number }[];
}
