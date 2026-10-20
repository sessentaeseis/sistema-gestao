import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api.jsx";

const emptyTask = {
  titulo: "",
  descricao: "",
  status: "PENDENTE",
  prazo: "",
  lista_id: "",
  responsavel_id: "",
};

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function dateToInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function ErrorMessage({ children }) {
  return children ? <div className="notice error" role="alert">{children}</div> : null;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-panel">
        <div className="brand-mark">GT</div>
        <p className="eyebrow">GESTÃO DE PROJETOS</p>
        <h1>Gestão de tarefas</h1>
        <p className="muted">Entre para acessar suas listas, responsáveis e prazos.</p>
        <form onSubmit={submit} className="form-stack">
          <label>
            E-mail
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Senha
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" required />
          </label>
          <ErrorMessage>{error}</ErrorMessage>
          <button className="primary full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="small muted login-footnote">
          Acesso com uma conta já cadastrada no banco de dados.
        </p>
      </section>
    </main>
  );
}

function App() {
  const [auth, setAuth] = useState(null);
  const [page, setPage] = useState("inicio");
  const [listas, setListas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState("");
  const [usuarioForm, setUsuarioForm] = useState({ nome: "", email: "", senha: "", cpf: "" });
  const [listaNome, setListaNome] = useState("");
  const [listaDescricao, setListaDescricao] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const token = auth?.token;
  const user = auth?.usuario;

  const notifyError = useCallback((message) => {
    setError(message);
    setSuccess("");
  }, []);

  const loadCore = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const [listsData, tasksData, usersData] = await Promise.all([
        apiFetch("/listas", { token }),
        apiFetch("/tarefas", { token }),
        apiFetch("/usuarios", { token }),
      ]);
      setListas(listsData);
      setTarefas(tasksData);
      setUsuarios(usersData);
    } catch (err) {
      notifyError(err.message);
      if (/token|sessão/i.test(err.message)) {
        setAuth(null);
      }
    }
  }, [token, notifyError]);

  useEffect(() => {
    if (token) loadCore();
  }, [token, loadCore]);

  const tarefasOrdenadas = useMemo(
    () => [...tarefas].sort((a, b) => new Date(a.prazo) - new Date(b.prazo)),
    [tarefas]
  );

  const atrasadas = tarefas.filter(
    tarefa => tarefa.status !== "CONCLUIDA" && new Date(tarefa.prazo) < new Date()
  );

  async function runAction(action, successMessage) {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await action();
      await loadCore();
      setSuccess(successMessage);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createList(event) {
    event.preventDefault();
    await runAction(async () => {
      await apiFetch("/listas", {
        method: "POST",
        token,
        body: JSON.stringify({
          nome: listaNome.trim(),
          descricao: listaDescricao.trim() || null,
        }),
      });
      setListaNome("");
      setListaDescricao("");
    }, "Lista criada com sucesso.");
  }

  async function createTask(event) {
    event.preventDefault();
    await runAction(async () => {
      await apiFetch("/tarefas", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...taskForm,
          prazo: new Date(taskForm.prazo).toISOString(),
          lista_id: Number(taskForm.lista_id),
          responsavel_id: Number(taskForm.responsavel_id),
        }),
      });
      setTaskForm(emptyTask);
    }, "Tarefa cadastrada com sucesso.");
  }

  async function createUser(event) {
    event.preventDefault();
    await runAction(async () => {
      await apiFetch("/usuarios", {
        method: "POST",
        token,
        body: JSON.stringify(usuarioForm),
      });
      setUsuarioForm({ nome: "", email: "", senha: "", cpf: "" });
      const result = await apiFetch("/usuarios", { token });
      setUsuarios(result);
    }, "Responsável cadastrado com sucesso.");
  }

  async function searchUsers(event) {
    event.preventDefault();
    setError("");
    try {
      const query = busca.trim()
        ? `?busca=${encodeURIComponent(busca.trim())}`
        : "";
      const result = await apiFetch(`/usuarios${query}`, { token });
      setUsuarios(result);
    } catch (err) {
      notifyError(err.message);
    }
  }

  async function logout() {
    try {
      await apiFetch("/logout", { method: "POST", token });
    } catch {
      // Limpa a sessão local mesmo se a sessão já tiver expirado no servidor.
    }
    setAuth(null);
    setPage("inicio");
    setListas([]);
    setTarefas([]);
    setUsuarios([]);
    setError("");
    setSuccess("");
  }

  if (!auth) {
    return <Login onLogin={result => { setAuth(result); setPage("inicio"); }} />;
  }

  const navItems = [
    ["inicio", "Visão geral"],
    ["listas", "Listas"],
    ["tarefas", "Tarefas"],
    ["agendamentos", "Agendamentos"],
    ["responsaveis", "Responsáveis"],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small-mark">GT</div>
          <div><strong>Gestão</strong><span>de tarefas</span></div>
        </div>
        <div className="nav-label">MENU PRINCIPAL</div>
        <nav>
          {navItems.map(([key, label]) => (
            <button key={key} className={`nav-item ${page === key ? "active" : ""}`} onClick={() => { setPage(key); setError(""); setSuccess(""); }}>
              <span className="nav-dot" />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{(user?.nome || "U").slice(0, 1).toUpperCase()}</div>
          <div className="user-meta"><strong>{user?.nome}</strong><span>{user?.email}</span></div>
          <button className="logout-button" onClick={logout} title="Sair" aria-label="Sair">↪</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">PAINEL DE CONTROLE</p>
            <h1>{navItems.find(([key]) => key === page)?.[1] || "Visão geral"}</h1>
          </div>
          <div className="topbar-user">
            <span className="status-dot" /> Sessão ativa
          </div>
        </header>

        <section className="content">
          <ErrorMessage>{error}</ErrorMessage>
          {success && <div className="notice success">{success}</div>}

          {page === "inicio" && (
            <>
              <div className="welcome-card">
                <div>
                  <p className="eyebrow light">BEM-VINDO(A)</p>
                  <h2>{user?.nome}</h2>
                  <p>Organize atividades, responsáveis e prazos em um só lugar.</p>
                </div>
                <div className="welcome-symbol">✓</div>
              </div>
              <div className="stats-grid">
                <Stat label="Listas cadastradas" value={listas.length} detail="Listas criadas por você" />
                <Stat label="Tarefas cadastradas" value={tarefas.length} detail="Atividades nas suas listas" />
                <Stat label="Responsáveis" value={usuarios.length} detail="Registros encontrados" />
                <Stat label="Tarefas atrasadas" value={atrasadas.length} detail="Prazo anterior ao momento atual" />
              </div>
              <section className="panel">
                <div className="panel-heading"><div><h2>Próximos prazos</h2><p>Atividades ordenadas pela data de entrega.</p></div><button className="secondary" onClick={() => setPage("agendamentos")}>Ver cronograma</button></div>
                <TaskTable tarefas={tarefasOrdenadas.slice(0, 5)} />
              </section>
            </>
          )}

          {page === "listas" && (
            <div className="two-column">
              <section className="panel">
                <div className="panel-heading"><div><h2>Nova lista</h2><p>Crie uma lista para agrupar tarefas.</p></div></div>
                <form className="form-stack" onSubmit={createList}>
                  <label>Nome da lista<input value={listaNome} onChange={e => setListaNome(e.target.value)} required maxLength={120} /></label>
                  <label>Descrição<textarea value={listaDescricao} onChange={e => setListaDescricao(e.target.value)} rows="4" /></label>
                  <button className="primary" disabled={loading}>Criar lista</button>
                </form>
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Suas listas</h2><p>{listas.length} lista(s) cadastrada(s).</p></div></div>
                {listas.length === 0 ? <EmptyState text="Ainda não há listas cadastradas." /> : (
                  <div className="list-stack">
                    {listas.map(lista => <article className="list-card" key={lista.id}>
                      <div className="list-icon">▤</div><div className="grow"><h3>{lista.nome}</h3><p>{lista.descricao || "Sem descrição"}</p><span className="small muted">{lista.tarefas?.length ?? 0} tarefa(s) · Criada em {formatDate(lista.criada_em)}</span></div>
                    </article>)}
                  </div>
                )}
              </section>
            </div>
          )}

          {page === "tarefas" && (
            <div className="two-column task-layout">
              <section className="panel">
                <div className="panel-heading"><div><h2>Nova tarefa</h2><p>Associe a tarefa a uma lista e a um responsável.</p></div></div>
                <form className="form-stack" onSubmit={createTask}>
                  <label>Título<input value={taskForm.titulo} onChange={e => setTaskForm({...taskForm, titulo: e.target.value})} required maxLength={160} /></label>
                  <label>Descrição<textarea value={taskForm.descricao} onChange={e => setTaskForm({...taskForm, descricao: e.target.value})} rows="3" /></label>
                  <div className="form-row">
                    <label>Prazo<input type="datetime-local" value={taskForm.prazo} onChange={e => setTaskForm({...taskForm, prazo: e.target.value})} required /></label>
                    <label>Status<select value={taskForm.status} onChange={e => setTaskForm({...taskForm, status: e.target.value})}><option value="PENDENTE">Pendente</option><option value="EM_ANDAMENTO">Em andamento</option><option value="CONCLUIDA">Concluída</option></select></label>
                  </div>
                  <label>Lista<select value={taskForm.lista_id} onChange={e => setTaskForm({...taskForm, lista_id: e.target.value})} required><option value="">Selecione uma lista</option>{listas.map(lista => <option key={lista.id} value={lista.id}>{lista.nome}</option>)}</select></label>
                  <label>Responsável<select value={taskForm.responsavel_id} onChange={e => setTaskForm({...taskForm, responsavel_id: e.target.value})} required><option value="">Selecione um responsável</option>{usuarios.map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nome} ({usuario.email})</option>)}</select></label>
                  <button className="primary" disabled={loading || !listas.length || !usuarios.length}>Cadastrar tarefa</button>
                  {!listas.length && <p className="small muted">Crie uma lista antes de cadastrar tarefas.</p>}
                  {!usuarios.length && <p className="small muted">É necessário ter um responsável cadastrado.</p>}
                </form>
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Tarefas</h2><p>Ordenadas pelo prazo.</p></div><span className="count-pill">{tarefas.length}</span></div>
                <TaskTable tarefas={tarefasOrdenadas} />
              </section>
            </div>
          )}

          {page === "agendamentos" && (
            <section className="panel">
              <div className="panel-heading"><div><h2>Cronograma de tarefas</h2><p>Lista completa com responsável e data de entrega.</p></div><span className="count-pill">{tarefasOrdenadas.length} atividades</span></div>
              <TaskTable tarefas={tarefasOrdenadas} showList />
            </section>
          )}

          {page === "responsaveis" && (
            <div className="two-column">
              <section className="panel">
                <div className="panel-heading"><div><h2>Novo responsável</h2><p>Cadastre um colaborador no sistema.</p></div></div>
                <form className="form-stack" onSubmit={createUser}>
                  <label>Nome<input value={usuarioForm.nome} onChange={e => setUsuarioForm({...usuarioForm, nome: e.target.value})} required /></label>
                  <label>E-mail<input type="email" value={usuarioForm.email} onChange={e => setUsuarioForm({...usuarioForm, email: e.target.value})} required /></label>
                  <label>Senha<input type="password" minLength="6" value={usuarioForm.senha} onChange={e => setUsuarioForm({...usuarioForm, senha: e.target.value})} required /></label>
                  <label>CPF (11 dígitos)<input inputMode="numeric" pattern="[0-9]{11}" maxLength="11" value={usuarioForm.cpf} onChange={e => setUsuarioForm({...usuarioForm, cpf: e.target.value.replace(/\\D/g, "").slice(0, 11)})} required /></label>
                  <button className="primary" disabled={loading}>Cadastrar responsável</button>
                </form>
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Responsáveis cadastrados</h2><p>Pesquise pelo nome ou pelo e-mail.</p></div><span className="count-pill">{usuarios.length} registros</span></div>
                <form className="search-row" onSubmit={searchUsers}>
                  <input placeholder="Digite um nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
                  <button className="primary">Buscar</button>
                  <button type="button" className="secondary" onClick={() => { setBusca(""); apiFetch("/usuarios", { token }).then(setUsuarios).catch(err => notifyError(err.message)); }}>Limpar</button>
                </form>
                <div className="table-wrap">
                  <table><thead><tr><th>Responsável</th><th>E-mail</th><th>ID</th></tr></thead><tbody>
                    {usuarios.map(usuario => <tr key={usuario.id}><td><div className="person-cell"><div className="avatar light-avatar">{usuario.nome.slice(0,1).toUpperCase()}</div><strong>{usuario.nome}</strong></div></td><td>{usuario.email}</td><td>#{usuario.id}</td></tr>)}
                  </tbody></table>
                  {!usuarios.length && <EmptyState text="Nenhum responsável encontrado." />}
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, detail }) {
  return <article className="stat-card"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function EmptyState({ text }) {
  return <div className="empty-state"><div className="empty-icon">▤</div><p>{text}</p></div>;
}

function TaskTable({ tarefas, showList = false }) {
  if (!tarefas?.length) return <EmptyState text="Nenhuma tarefa cadastrada." />;

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Tarefa</th>{showList && <th>Lista</th>}<th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
        <tbody>
          {tarefas.map(tarefa => (
            <tr key={tarefa.id}>
              <td><div className="task-title"><strong>{tarefa.titulo}</strong>{tarefa.descricao && <span>{tarefa.descricao}</span>}</div></td>
              {showList && <td>{tarefa.lista?.nome || "—"}</td>}
              <td>{tarefa.responsavel?.nome || "—"}</td>
              <td className="date-cell">{formatDate(tarefa.prazo)}</td>
              <td><span className={`status status-${String(tarefa.status || "PENDENTE").toLowerCase()}`}>{(tarefa.status || "PENDENTE").replaceAll("_", " ")}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
