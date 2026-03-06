import { DanfeData, ProdutoDanfe, PagamentoDanfe } from './danfe-data';

export function parseDanfeXml(xmlString: string): DanfeData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  // Basic validation
  if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML inválido ou malformado");
  }

  // Detect NF-e (tpImp=1, mod=55) vs NFC-e (tpImp=4 or mod=65)
  const tpImpNode = xmlDoc.getElementsByTagName("tpImp")[0];
  const tpImp = tpImpNode?.textContent || "1";
  const ide = xmlDoc.getElementsByTagName("ide")[0];
  const modelo = ide?.getElementsByTagName("mod")[0]?.textContent || "65";
  const isNfce = tpImp !== "1" || modelo === "65";

  // Emitente (empresa)
  const emit = xmlDoc.getElementsByTagName("emit")[0];
  const empresa = emit?.getElementsByTagName("xNome")[0]?.textContent?.trim() || "";
  const cnpj = emit?.getElementsByTagName("CNPJ")[0]?.textContent?.trim() || "";

  // Endereço (exatamente como no seu código original)
  const enderEmit = emit?.getElementsByTagName("enderEmit")[0];
  const xLgr   = enderEmit?.getElementsByTagName("xLgr")[0]?.textContent?.trim() || "";
  const nro    = enderEmit?.getElementsByTagName("nro")[0]?.textContent?.trim() || "";
  const xCpl   = enderEmit?.getElementsByTagName("xCpl")[0]?.textContent?.trim() || "";
  const xBairro = enderEmit?.getElementsByTagName("xBairro")[0]?.textContent?.trim() || "";
  const endereco = `${xLgr}, ${nro || xCpl}, ${xBairro}`.replace(/,\s*,/g, ",").trim();

  // Telefone
  const telefone = enderEmit?.getElementsByTagName("fone")[0]?.textContent?.trim() || "";

  // Data e hora (prioriza dhRecbto, fallback para dhEmi se existir)
  const dhRecbto = xmlDoc.getElementsByTagName("dhRecbto")[0]?.textContent || "";
  const dhEmi    = ide?.getElementsByTagName("dhEmi")[0]?.textContent || "";
  const dataIso = dhRecbto || dhEmi;
  let dia_e_hora = "";
  if (dataIso) {
    try {
      const date = new Date(dataIso);
      dia_e_hora = date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    } catch {
      dia_e_hora = dataIso;
    }
  }

  // Totais
  const ICMSTot = xmlDoc.getElementsByTagName("ICMSTot")[0];
  const subtotal = Number(ICMSTot?.getElementsByTagName("vProd")[0]?.textContent || "0");
  const extra    = Number(ICMSTot?.getElementsByTagName("vOutro")[0]?.textContent || "0");
  const discount = Number(ICMSTot?.getElementsByTagName("vDesc")[0]?.textContent || "0");
  const total    = Number(ICMSTot?.getElementsByTagName("vNF")[0]?.textContent || "0");

  // Consumidor / Destinatário
  const dest = xmlDoc.getElementsByTagName("dest")[0];
  let consumidor = "CONSUMIDOR NÃO IDENTIFICADO";
  if (dest) {
    const cpf = dest.getElementsByTagName("CPF")[0]?.textContent?.trim();
    const cnpjDest = dest.getElementsByTagName("CNPJ")[0]?.textContent?.trim();
    consumidor = cpf || cnpjDest || consumidor;
  }

  // Protocolo de autorização
  const protocolo_de_autorizacao = xmlDoc.getElementsByTagName("nProt")[0]?.textContent?.trim() || "";

  // QR Code (presente em NFC-e)
  const qrCode = xmlDoc.getElementsByTagName("qrCode")[0]?.textContent?.trim() || "";

  // Tributos aproximados
  const tributos = Number(ICMSTot?.getElementsByTagName("vTotTrib")[0]?.textContent || "0");

  // Chave de acesso (formatação com espaços a cada 4 dígitos)
  const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
  let chaveRaw = infNFe?.getAttribute("Id")?.replace(/^NFe/, "") || "";
  const chave_de_acesso = chaveRaw.match(/.{4}/g)?.join(" ") || chaveRaw;

  // Produtos
  const prods = xmlDoc.getElementsByTagName("prod");
  const produtos: ProdutoDanfe[] = [];
  for (let i = 0; i < prods.length; i++) {
    const p = prods[i];
    produtos.push({
      qty: p.getElementsByTagName("qCom")[0]?.textContent?.trim() || "0",
      name: p.getElementsByTagName("xProd")[0]?.textContent?.trim() || "",
      unitary_value: p.getElementsByTagName("vUnCom")[0]?.textContent?.trim() || "0.00",
      total_value: p.getElementsByTagName("vProd")[0]?.textContent?.trim() || "0.00"
    });
  }

  // Pagamentos – com tradução do código para nome legível
  const detPags = xmlDoc.getElementsByTagName("detPag");
  const pagamentos: PagamentoDanfe[] = [];

  const formaPagamentoMap: Record<string, string> = {
    "01": "Dinheiro",
    "02": "Cheque",
    "03": "Cartão de Crédito",
    "04": "Cartão de Débito",
    "05": "Crédito Loja",
    "10": "Vale Alimentação",
    "11": "Vale Refeição",
    "12": "Vale Presente",
    "13": "Vale Combustível",
    "14": "Duplicata Mercantil",
    "15": "Boleto Bancário",
    "16": "Depósito em Conta",
    "17": "PIX",
    "90": "Sem pagamento",
    "99": "Outros"
  };

  for (let i = 0; i < detPags.length; i++) {
    const pag = detPags[i];
    const code = pag.getElementsByTagName("tPag")[0]?.textContent?.trim() || "99";
    const valor = pag.getElementsByTagName("vPag")[0]?.textContent?.trim() || "0.00";

    pagamentos.push({
      value_payed: valor,
      payment_method_code: code,
      payment_method_name: formaPagamentoMap[code] || `Forma não identificada (${code})`
    });
  }

  // Retorno final
  return {
    tipo: isNfce ? "nfce" : "nfe",
    empresa,
    cnpj,
    endereco,
    telefone,
    dia_e_hora,
    subtotal,
    extra,
    discount,
    total,
    consumidor,
    protocolo_de_autorizacao,
    qrCode,
    tributos,
    chave_de_acesso,
    produtos,
    pagamentos
  };
}