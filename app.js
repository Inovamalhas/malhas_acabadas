/* Malhas Acabadas - app simples (HTML + JS + Supabase) */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ETAPAS = ["producao", "tinturaria", "estamparia", "entrega", "concluida"];
const NOMES = {
  producao: "1 · Produção", tinturaria: "2 · Tinturaria", estamparia: "3 · Estamparia",
  entrega: "4 · Entrega", concluida: "Concluída"
};
const CORES = {
  producao: "var(--producao)", tinturaria: "var(--tinturaria)", estamparia: "var(--estamparia)",
  entrega: "var(--entrega)", concluida: "var(--concluida)"
};

let encomendas = [];
let filtro = "ativas";
let atual = null; // encomenda aberta no modal

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hoje = () => new Date().toISOString().slice(0, 10);
const fmtData = (d) => (d ? d.split("-").reverse().slice(0, 2).join("/") + "/" + d.slice(2, 4) : "—");

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2500);
}

/* ---------- Autenticação ---------- */
async function arrancar() {
  const { data } = await db.auth.getSession();
  mostrar(!!data.session);
  db.auth.onAuthStateChange((_e, s) => mostrar(!!s));
}
function mostrar(logado) {
  $("#login").classList.toggle("hidden", logado);
  $("#app").classList.toggle("hidden", !logado);
  if (logado) carregar();
}
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginErro").textContent = "";
  const { error } = await db.auth.signInWithPassword({
    email: $("#loginEmail").value.trim(), password: $("#loginPass").value
  });
  if (error) $("#loginErro").textContent = "Email ou palavra-passe incorretos.";
});
$("#btnSair").addEventListener("click", () => db.auth.signOut());

/* ---------- Dados ---------- */
async function carregar() {
  const { data, error } = await db.from("encomendas").select("*").order("data_prev_entrega_cliente", { ascending: true, nullsFirst: false });
  if (error) { toast("Erro a carregar: " + error.message); return; }
  encomendas = data; desenhar();
}

function atrasado(e, campo) {
  const i = ETAPAS.indexOf(e.estado);
  const feito = campo === "data_prev_entrega_cliente" ? i >= 4 : i >= 1;
  return !feito && e[campo] && e[campo] < hoje();
}
function temAtraso(e) {
  return ["data_prev_fim_malha", "data_prev_envio_tinturaria", "data_prev_entrega_cliente"].some((c) => atrasado(e, c));
}

/* ---------- Lista ---------- */
function desenhar() {
  // separadores
  const conta = (f) => encomendas.filter(f).length;
  const tabs = [
    { id: "ativas", nome: "Ativas", cor: "#374151", n: conta((e) => e.estado !== "concluida") },
    ...ETAPAS.map((s) => ({ id: s, nome: NOMES[s], cor: CORES[s], n: conta((e) => e.estado === s) }))
  ];
  $("#tabs").innerHTML = tabs.map((t) =>
    `<button class="tab ${filtro === t.id ? "ativo" : ""}" style="--c:${t.cor}" data-tab="${t.id}">${t.nome} (${t.n})</button>`).join("");
  document.querySelectorAll(".tab").forEach((b) => b.onclick = () => { filtro = b.dataset.tab; desenhar(); });

  const q = $("#pesquisa").value.trim().toLowerCase();
  const so = $("#soAtrasadas").checked;
  const lista = encomendas.filter((e) => {
    if (filtro === "ativas" ? e.estado === "concluida" : e.estado !== filtro) return false;
    if (so && !temAtraso(e)) return false;
    if (!q) return true;
    return [e.referencia, e.cliente, e.artigo, e.cor, e.malharia, e.tinturaria, e.estamparia]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  $("#lista").innerHTML = lista.length ? lista.map(cartao).join("") : `<div class="vazio">Sem encomendas.</div>`;
  document.querySelectorAll(".card").forEach((c) => c.onclick = (ev) => {
    if (ev.target.closest("[data-avancar]")) return;
    abrir(encomendas.find((e) => e.id === c.dataset.id));
  });
  document.querySelectorAll("[data-avancar]").forEach((b) => b.onclick = () => avancar(b.dataset.avancar));
}

function passo(e, titulo, campo, cor) {
  const i = ETAPAS.indexOf(e.estado);
  const feito = campo === "data_prev_entrega_cliente" ? i >= 4 : i >= 1;
  const pedida = campo === "data_prev_entrega_cliente" && e.data_pedida_cliente && e[campo] && e[campo] > e.data_pedida_cliente;
  const cls = feito ? "feito" : (atrasado(e, campo) || pedida) ? "atraso" : "";
  return `<div class="passo ${cls}" style="--c:${cor}"><b>${titulo}</b><span class="d">${fmtData(e[campo])}</span></div>`;
}

function cartao(e) {
  const onde = e.estado === "producao" ? (e.origem_malha === "subcontratada" ? e.malharia : "Interna")
    : e.estado === "tinturaria" ? e.tinturaria : e.estado === "estamparia" ? e.estamparia : "";
  return `<div class="card estado-${e.estado}" data-id="${e.id}">
    <div class="linha1"><span class="ref">${esc(e.referencia)}</span><span class="badge">${NOMES[e.estado]}</span></div>
    <div class="sub">${esc(e.cliente)} — ${esc(e.artigo)}${e.cor ? " · " + esc(e.cor) : ""}${e.quantidade_kg ? " · " + e.quantidade_kg + " kg" : ""}${onde ? "<br>📍 " + esc(onde) : ""}</div>
    <div class="passos">
      <div class="passo pedida"><b>Cliente quer</b><span class="d">${fmtData(e.data_pedida_cliente)}</span></div>
      ${passo(e, "Fim malha", "data_prev_fim_malha", "var(--producao)")}
      ${passo(e, "Envio tint.", "data_prev_envio_tinturaria", "var(--tinturaria)")}
      ${passo(e, "Entrega", "data_prev_entrega_cliente", "var(--entrega)")}
    </div>
    ${e.estado !== "concluida" ? `<div class="rodape"><span></span><button class="btn small" data-avancar="${e.id}">Avançar etapa →</button></div>` : ""}
  </div>`;
}

async function avancar(id) {
  const e = encomendas.find((x) => x.id === id);
  let i = ETAPAS.indexOf(e.estado) + 1;
  if (ETAPAS[i] === "estamparia" && !e.tem_estamparia) i++;
  const { error } = await db.from("encomendas").update({ estado: ETAPAS[i] }).eq("id", id);
  if (error) return toast("Erro: " + error.message);
  toast("Passou para: " + NOMES[ETAPAS[i]]);
  carregar();
}

$("#pesquisa").addEventListener("input", desenhar);
$("#soAtrasadas").addEventListener("change", desenhar);

/* ---------- Modal / formulário ---------- */
const form = $("#form");
function ajustarCampos() {
  $("#lblMalharia").classList.toggle("hidden", form.origem_malha.value !== "subcontratada");
  $("#boxEstamparia").classList.toggle("hidden", !form.tem_estamparia.checked);
}
form.origem_malha.addEventListener("change", ajustarCampos);
form.tem_estamparia.addEventListener("change", ajustarCampos);

const CAMPOS = ["referencia", "cliente", "artigo", "cor", "quantidade_kg", "estado", "origem_malha", "malharia", "data_pedida_cliente",
  "data_prev_fim_malha", "tinturaria", "data_prev_envio_tinturaria", "estamparia", "data_prev_entrega_cliente", "notas"];

function abrir(e) {
  atual = e || null;
  form.reset();
  $("#formErro").textContent = "";
  $("#modalTitulo").textContent = e ? "Encomenda " + e.referencia : "Nova encomenda";
  if (e) {
    CAMPOS.forEach((c) => form[c].value = e[c] ?? "");
    form.tem_estamparia.checked = !!e.tem_estamparia;
  }
  $("#btnApagar").classList.toggle("hidden", !e);
  $("#guiasBox").classList.toggle("hidden", !e);
  ajustarCampos();
  if (e) { $("#guiaForm").data.value = hoje(); carregarGuias(); }
  if (!$("#modal").open) $("#modal").showModal();
}
$("#btnNova").onclick = () => abrir(null);
$("#btnFechar").onclick = () => $("#modal").close();

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const dados = {};
  CAMPOS.forEach((c) => { const v = form[c].value; dados[c] = v === "" ? null : v; });
  dados.quantidade_kg = dados.quantidade_kg === null ? null : Number(dados.quantidade_kg);
  dados.tem_estamparia = form.tem_estamparia.checked;
  if (dados.origem_malha !== "subcontratada") dados.malharia = null;
  if (!dados.tem_estamparia) dados.estamparia = null;
  if (dados.estado === "estamparia" && !dados.tem_estamparia) {
    $("#formErro").textContent = "Marque 'tem estamparia' ou escolha outro estado."; return;
  }
  $("#btnGuardar").disabled = true;
  const q = atual ? db.from("encomendas").update(dados).eq("id", atual.id).select().single()
                  : db.from("encomendas").insert(dados).select().single();
  const { data, error } = await q;
  $("#btnGuardar").disabled = false;
  if (error) { $("#formErro").textContent = error.message; return; }
  toast("Guardado");
  await carregar();
  if (!atual) abrir(data); // abre a nova para poder juntar guias
  else $("#modal").close();
});

$("#btnApagar").onclick = async () => {
  if (!atual || !confirm("Apagar esta encomenda e as suas guias?")) return;
  const { error } = await db.from("encomendas").delete().eq("id", atual.id);
  if (error) return toast("Erro: " + error.message);
  $("#modal").close(); toast("Apagada"); carregar();
};

/* ---------- Guias ---------- */
async function carregarGuias() {
  const { data, error } = await db.from("guias").select("*").eq("encomenda_id", atual.id).order("data", { ascending: false });
  if (error) { $("#guiasLista").textContent = error.message; return; }
  $("#guiasLista").innerHTML = data.length ? data.map((g) => `
    <div class="guia d-${g.destino}">
      <span><span class="tag">→ ${esc(g.destino)}</span><b>${esc(g.tipo === "remessa" ? "Remessa" : "Transporte")} ${esc(g.numero)}</b>
      · ${g.data.split("-").reverse().join("/")}${g.quantidade_kg ? " · " + g.quantidade_kg + " kg" : ""}${g.notas ? " · " + esc(g.notas) : ""}</span>
      <button class="btn small danger" data-gdel="${g.id}">✕</button>
    </div>`).join("") : `<p class="muted">Ainda sem guias.</p>`;
  document.querySelectorAll("[data-gdel]").forEach((b) => b.onclick = async () => {
    if (!confirm("Apagar esta guia?")) return;
    await db.from("guias").delete().eq("id", b.dataset.gdel); carregarGuias();
  });
}
$("#guiaForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const { error } = await db.from("guias").insert({
    encomenda_id: atual.id, tipo: f.tipo.value, destino: f.destino.value, numero: f.numero.value.trim(),
    data: f.data.value, quantidade_kg: f.quantidade_kg.value === "" ? null : Number(f.quantidade_kg.value),
    notas: f.notas.value.trim() || null
  });
  if (error) return toast("Erro: " + error.message);
  f.numero.value = ""; f.quantidade_kg.value = ""; f.notas.value = "";
  toast("Guia adicionada"); carregarGuias();
});

/* ---------- PWA (instalar no telemóvel) ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

arrancar();
