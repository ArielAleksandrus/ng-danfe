export interface ProdutoDanfe {
  qty: string;
  name: string;
  unitary_value: string;
  total_value: string;
}

export interface PagamentoDanfe {
  value_payed: string;
  payment_method_code: string;
  payment_method_name: string;
}

export interface DanfeData {
  tipo: 'nfe' | 'nfce';
  empresa: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  dia_e_hora: string;
  subtotal: number;
  extra: number;
  discount: number;
  total: number;
  consumidor: string;
  protocolo_de_autorizacao: string;
  qrCode: string;
  tributos: number;
  chave_de_acesso: string;
  produtos: ProdutoDanfe[];
  pagamentos: PagamentoDanfe[];
}