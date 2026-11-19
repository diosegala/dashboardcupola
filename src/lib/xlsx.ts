// Leitor mínimo de .xlsx (primeira aba) só com recursos do navegador: o arquivo é um ZIP com XMLs.
// Lê o diretório do ZIP, descompacta (DecompressionStream) a aba e os textos compartilhados, e monta a tabela.

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function arquivosDoZip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("Arquivo .xlsx inválido");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const arquivos = new Map<string, () => Promise<string>>();
  const dec = new TextDecoder();
  for (let i = 0; i < total; i++) {
    const metodo = v.getUint16(p + 10, true);
    const tamanho = v.getUint32(p + 20, true);
    const nomeLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const comLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = dec.decode(bytes.subarray(p + 46, p + 46 + nomeLen));
    arquivos.set(nome, async () => {
      const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const dados = bytes.subarray(ini, ini + tamanho);
      return dec.decode(metodo === 0 ? dados : await inflar(dados));
    });
    p += 46 + nomeLen + extraLen + comLen;
  }
  return arquivos;
}

// Coluna "AB12" → índice 27.
function indiceColuna(ref: string): number {
  const letras = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function lerXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const arquivos = await arquivosDoZip(buf);
  const xml = (t: string) => new DOMParser().parseFromString(t, "application/xml");
  const textos: string[] = [];
  const shared = arquivos.get("xl/sharedStrings.xml");
  if (shared) {
    xml(await shared()).querySelectorAll("si").forEach((si) => {
      textos.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
    });
  }
  // Primeira aba pela ordem do livro (workbook + rels); se falhar, sheet1.
  let caminho = "xl/worksheets/sheet1.xml";
  try {
    const wb = xml(await arquivos.get("xl/workbook.xml")!());
    const rid = wb.getElementsByTagName("sheet")[0]?.getAttribute("r:id");
    const rels = xml(await arquivos.get("xl/_rels/workbook.xml.rels")!());
    const alvo = Array.from(rels.getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (alvo) caminho = "xl/" + alvo.replace(/^\/?xl\//, "").replace(/^\//, "");
  } catch { /* usa sheet1 */ }
  const aba = arquivos.get(caminho) ?? arquivos.get("xl/worksheets/sheet1.xml");
  if (!aba) throw new Error("Não encontrei a aba da planilha");
  const tabela: string[][] = [];
  xml(await aba()).querySelectorAll("sheetData > row").forEach((row) => {
    const linha: string[] = [];
    row.querySelectorAll("c").forEach((c) => {
      const tipo = c.getAttribute("t");
      const vEl = c.getElementsByTagName("v")[0];
      let valor = "";
      if (tipo === "s") valor = textos[Number(vEl?.textContent ?? -1)] ?? "";
      else if (tipo === "inlineStr") valor = Array.from(c.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");
      else valor = vEl?.textContent ?? "";
      linha[indiceColuna(c.getAttribute("r") ?? "A")] = valor;
    });
    const r = Number(row.getAttribute("r") ?? tabela.length + 1);
    while (tabela.length < r - 1) tabela.push([]);
    tabela.push(Array.from(linha, (x) => x ?? ""));
  });
  return tabela;
}
